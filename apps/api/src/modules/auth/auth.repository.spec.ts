import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { categories, memos, ogpCaches, authUsers } from "@ideamory/db";
import { AuthRepository } from "./auth.repository";

/**
 * Drizzle ORM 트랜잭션 쿼리 추적용 Mock DB 빌더
 */
function createMockDb(selectResponses: any[][] = []) {
  const ops: Array<{ type: string; table: any; values?: any; where?: any }> = [];
  let selectIdx = 0;

  const tx = {
    select: () => ({
      from: (table: any) => ({
        where: () => {
          const rows = selectResponses[selectIdx++] || [];
          const resultPromise: any = Promise.resolve(rows);
          resultPromise.limit = async () => rows;
          return resultPromise;
        },
      }),
    }),
    insert: (table: any) => ({
      values: async (values: any) => {
        ops.push({ type: "insert", table, values });
      },
    }),
    update: (table: any) => ({
      set: (values: any) => ({
        where: async (where: any) => {
          ops.push({ type: "update", table, values, where });
        },
      }),
    }),
    delete: (table: any) => ({
      where: async (where: any) => {
        ops.push({ type: "delete", table, where });
      },
    }),
  };

  const mockDb: any = {
    transaction: async (callback: (txObj: any) => Promise<any>) => {
      return await callback(tx);
    },
  };

  return { mockDb, ops };
}

describe("AuthRepository (Drizzle 트랜잭션 무결성 및 외래키 순서 검증)", () => {
  it("시나리오 1: createGuestSessionWithSeed는 Pre-seeded OGP(100년 TTL) ➔ [사용 가이드] 카테고리 ➔ 시드 메모 순으로 삽입해야 한다", async () => {
    // 1. ogpCaches 조회 결과 빈 배열 (신규 삽입 유도)
    const { mockDb, ops } = createMockDb([[]]);
    const repo = new AuthRepository(mockDb);

    const memoId = "018d0000-0000-7000-8000-000000000001";
    const categoryId = "018d0000-0000-7000-8000-000000000002";

    const resultId = await repo.createGuestSessionWithSeed({
      guestToken: "gst_test123",
      memoId,
      categoryId,
      guideUrl: "https://ideamory.app/guide",
      guideContent: "테스트 가이드 본문",
    });

    assert.equal(resultId, memoId);
    assert.equal(ops.length, 3);

    // 1) OGP 캐시 삽입 (100년 뒤 만료 확인)
    assert.equal(ops[0].type, "insert");
    assert.equal(ops[0].table, ogpCaches);
    const diffYears =
      ops[0].values.expiresAt.getFullYear() - new Date().getFullYear();
    assert.ok(diffYears >= 99 && diffYears <= 101);

    // 2) 카테고리 삽입 (배타적 소유권: userId=null, guestToken 존재)
    assert.equal(ops[1].type, "insert");
    assert.equal(ops[1].table, categories);
    assert.equal(ops[1].values.name, "사용 가이드");
    assert.equal(ops[1].values.normalizedName, "사용가이드");
    assert.equal(ops[1].values.userId, null);
    assert.equal(ops[1].values.guestToken, "gst_test123");

    // 3) 메모 삽입 (배타적 소유권: userId=null, guestToken 존재)
    assert.equal(ops[2].type, "insert");
    assert.equal(ops[2].table, memos);
    assert.equal(ops[2].values.id, memoId);
    assert.equal(ops[2].values.categoryId, categoryId);
    assert.equal(ops[2].values.ogpId, ops[0].values.id);
    assert.equal(ops[2].values.deletedAt, null);
  });

  it("시나리오 2: createGuestSessionWithSeed는 이미 guideUrl OGP 캐시가 존재하면 신규 생성 없이 기존 ogpId를 재사용해야 한다", async () => {
    const existingOgpId = "018d0000-0000-7000-8000-999999999999";
    const { mockDb, ops } = createMockDb([[{ id: existingOgpId }]]);
    const repo = new AuthRepository(mockDb);

    await repo.createGuestSessionWithSeed({
      guestToken: "gst_test123",
      memoId: "018d0000-0000-7000-8000-000000000001",
      categoryId: "018d0000-0000-7000-8000-000000000002",
      guideUrl: "https://ideamory.app/guide",
      guideContent: "테스트 가이드 본문",
    });

    // OGP INSERT 없이 category와 memo만 INSERT 되어야 함
    assert.equal(ops.length, 2);
    assert.equal(ops[0].table, categories);
    assert.equal(ops[1].table, memos);
    assert.equal(ops[1].values.ogpId, existingOgpId);
  });

  it("시나리오 3: resetGuestData는 외래키 RESTRICT 방어를 위해 반드시 memos 먼저 삭제한 뒤 categories를 삭제하고 ogpCaches는 보존해야 한다", async () => {
    const { mockDb, ops } = createMockDb();
    const repo = new AuthRepository(mockDb);

    await repo.resetGuestData("gst_reset_me");

    assert.equal(ops.length, 2);
    assert.equal(ops[0].type, "delete");
    assert.equal(ops[0].table, memos);
    assert.equal(ops[1].type, "delete");
    assert.equal(ops[1].table, categories);
  });

  it("시나리오 4: migrateGuestToSocialAccount는 중복 카테고리를 재매핑 후 삭제하고, 나머지 카테고리와 메모는 userId 설정 및 guestToken=null로 동시 업데이트해야 한다", async () => {
    // 1번째 select: 기존 소셜 카테고리 ('아이디어' 이미 존재)
    // 2번째 select: 게스트 카테고리 ('아이디어' 충돌, '할일' 비충돌)
    const { mockDb, ops } = createMockDb([
      [{ id: "social-cat-idea", normalizedName: "아이디어" }],
      [
        { id: "guest-cat-idea", normalizedName: "아이디어" },
        { id: "guest-cat-todo", normalizedName: "할일" },
      ],
    ]);
    const repo = new AuthRepository(mockDb);

    await repo.migrateGuestToSocialAccount({
      guestToken: "gst_migrate",
      targetUserId: "social-user-123",
    });

    // 예상 연산 순서:
    // 0: 충돌한 '아이디어' 카테고리를 참조하는 게스트 메모들의 categoryId를 'social-cat-idea'로 재매핑
    // 1: 중복 게스트 카테고리 'guest-cat-idea' 삭제
    // 2: 비충돌 게스트 카테고리 'guest-cat-todo'의 소유권을 userId='social-user-123', guestToken=null로 변경
    // 3: 모든 게스트 메모의 소유권을 userId='social-user-123', guestToken=null로 일괄 변경
    assert.equal(ops.length, 4);

    assert.equal(ops[0].type, "update");
    assert.equal(ops[0].table, memos);
    assert.equal(ops[0].values.categoryId, "social-cat-idea");

    assert.equal(ops[1].type, "delete");
    assert.equal(ops[1].table, categories);

    assert.equal(ops[2].type, "update");
    assert.equal(ops[2].table, categories);
    assert.equal(ops[2].values.userId, "social-user-123");
    assert.equal(ops[2].values.guestToken, null);

    assert.equal(ops[3].type, "update");
    assert.equal(ops[3].table, memos);
    assert.equal(ops[3].values.userId, "social-user-123");
    assert.equal(ops[3].values.guestToken, null);
  });

  it("시나리오 5: deleteSocialAccountData는 외래키 RESTRICT 방어를 위해 memos ➔ categories ➔ authUsers 순으로 영구 삭제해야 한다", async () => {
    const { mockDb, ops } = createMockDb();
    const repo = new AuthRepository(mockDb);

    await repo.deleteSocialAccountData("user-delete-123");

    assert.equal(ops.length, 3);
    assert.equal(ops[0].type, "delete");
    assert.equal(ops[0].table, memos);
    assert.equal(ops[1].type, "delete");
    assert.equal(ops[1].table, categories);
    assert.equal(ops[2].type, "delete");
    assert.equal(ops[2].table, authUsers);
  });
});

