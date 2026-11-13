import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { categories, memos, ogpCaches, authUsers } from "@ideamory/db";
import { AuthRepository } from "./auth.repository";

/**
 * Drizzle ORM 원자적 쿼리 추적용 Mock Executor(tx) 빌더
 */
function createMockExecutor(selectRows: any[] = []) {
  const ops: Array<{
    type: string;
    table: any;
    values?: any;
    where?: any;
  }> = [];

  const tx: any = {
    select: () => ({
      from: (table: any) => ({
        where: (where: any) => {
          ops.push({ type: "select", table, where });
          const resultPromise: any = Promise.resolve(selectRows);
          resultPromise.limit = async () => selectRows;
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

  return { tx, ops };
}

describe("AuthRepository (원자적 데이터 접근 및 tx 컨텍스트 주입 검증)", () => {
  const repo = new AuthRepository();

  it("시나리오 1: findOgpCacheByTargetUrl 및 insertOgpCache는 ogpCaches 테이블에서 targetUrl 조회 및 삽입을 수행해야 한다", async () => {
    const { tx, ops } = createMockExecutor([{ id: "ogp-1" }]);
    const found = await repo.findOgpCacheByTargetUrl(
      "https://ideamory.app/guide",
      tx
    );
    assert.deepEqual(found, { id: "ogp-1" });
    assert.equal(ops[0].type, "select");
    assert.equal(ops[0].table, ogpCaches);

    const expiresAt = new Date("2126-01-01T00:00:00.000Z");
    await repo.insertOgpCache(
      {
        id: "ogp-2",
        targetUrl: "https://ideamory.app/guide",
        title: "Ideamory 사용 가이드",
        description: "설명",
        expiresAt,
      },
      tx
    );

    assert.equal(ops[1].type, "insert");
    assert.equal(ops[1].table, ogpCaches);
    assert.equal(ops[1].values.id, "ogp-2");
    assert.equal(ops[1].values.targetUrl, "https://ideamory.app/guide");
    assert.equal(ops[1].values.expiresAt, expiresAt);
  });

  it("시나리오 2: insertCategory 및 insertMemo는 배타적 소유권(guestToken 지정 시 userId=null)으로 삽입해야 한다", async () => {
    const { tx, ops } = createMockExecutor();

    await repo.insertCategory(
      {
        id: "cat-1",
        guestToken: "gst_test",
        name: "사용 가이드",
        normalizedName: "사용가이드",
      },
      tx
    );
    await repo.insertMemo(
      {
        id: "memo-1",
        guestToken: "gst_test",
        categoryId: "cat-1",
        ogpId: "ogp-1",
        content: "가이드 본문",
      },
      tx
    );

    assert.equal(ops.length, 2);
    assert.equal(ops[0].table, categories);
    assert.equal(ops[0].values.userId, null);
    assert.equal(ops[0].values.guestToken, "gst_test");

    assert.equal(ops[1].table, memos);
    assert.equal(ops[1].values.userId, null);
    assert.equal(ops[1].values.guestToken, "gst_test");
    assert.equal(ops[1].values.categoryId, "cat-1");
    assert.equal(ops[1].values.ogpId, "ogp-1");
  });

  it("시나리오 3: transferCategoriesToUser 및 transferMemosToUser는 userId를 설정하고 guestToken을 반드시 null로 초기화해야 한다", async () => {
    const { tx, ops } = createMockExecutor();

    await repo.transferCategoriesToUser("gst_test", "user-123", tx);
    await repo.transferMemosToUser("gst_test", "user-123", tx);

    assert.equal(ops.length, 2);
    assert.equal(ops[0].type, "update");
    assert.equal(ops[0].table, categories);
    assert.deepEqual(ops[0].values, { userId: "user-123", guestToken: null });

    assert.equal(ops[1].type, "update");
    assert.equal(ops[1].table, memos);
    assert.deepEqual(ops[1].values, { userId: "user-123", guestToken: null });
  });

  it("시나리오 4: deleteCategoriesByIds는 빈 배열이 전달되면 DB DELETE 쿼리를 실행하지 않고 즉시 반환해야 한다", async () => {
    const { tx, ops } = createMockExecutor();

    await repo.deleteCategoriesByIds([], tx);
    assert.equal(ops.length, 0);

    await repo.deleteCategoriesByIds(["cat-dup-1"], tx);
    assert.equal(ops.length, 1);
    assert.equal(ops[0].type, "delete");
    assert.equal(ops[0].table, categories);
  });

  it("시나리오 5: deleteMemosByUserId, deleteCategoriesByUserId, deleteAuthUserById는 각각 올바른 대상 테이블에서 삭제를 수행해야 한다", async () => {
    const { tx, ops } = createMockExecutor();

    await repo.deleteMemosByUserId("user-123", tx);
    await repo.deleteCategoriesByUserId("user-123", tx);
    await repo.deleteAuthUserById("user-123", tx);

    assert.equal(ops.length, 3);
    assert.equal(ops[0].table, memos);
    assert.equal(ops[1].table, categories);
    assert.equal(ops[2].table, authUsers);
  });
});
