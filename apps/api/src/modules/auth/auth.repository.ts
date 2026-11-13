import { Injectable, Inject, Optional } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import {
  db as defaultDb,
  DatabaseInstance,
  categories,
  memos,
  ogpCaches,
  authUsers,
  eq,
} from "@ideamory/db";

/**
 * AuthModule 전용 데이터베이스 리포지토리 (Drizzle ORM 전담 계층)
 * BaaS 종속적인 Stored Function/RPC 대신 NestJS 서비스/리포지토리 레이어에서
 * db.transaction()을 통해 원자적(Atomic) 데이터 생성, 이관, 영구 파기를 수행합니다.
 */
@Injectable()
export class AuthRepository {
  private readonly db: DatabaseInstance;

  constructor(
    @Optional()
    @Inject("DATABASE_INSTANCE")
    injectedDb?: DatabaseInstance
  ) {
    this.db = injectedDb ?? defaultDb;
  }

  /**
   * 익명 게스트 세션용 온보딩 가이드 OGP 캐시, [사용 가이드] 카테고리, 시드 메모를
   * 단일 데이터베이스 트랜잭션으로 원자적 생성합니다.
   *
   * @param params.guestToken 발급된 익명 게스트 세션 식별자 (VARCHAR 64)
   * @param params.memoId 클라이언트/DTO에서 선발급된 가이드 메모 UUID v7
   * @param params.categoryId 클라이언트/DTO에서 선발급된 [사용 가이드] 카테고리 UUID v7
   * @param params.guideUrl 환경변수 기반 동적 가이드 페이지 URL
   * @param params.guideContent 가이드 시드 메모 본문 텍스트
   * @returns 생성 완료된 시드 메모의 UUID v7 식별자
   */
  async createGuestSessionWithSeed(params: {
    guestToken: string;
    memoId: string;
    categoryId: string;
    guideUrl: string;
    guideContent: string;
  }): Promise<string> {
    const { guestToken, memoId, categoryId, guideUrl, guideContent } = params;

    return await this.db.transaction(async (tx) => {
      // 1. Pre-seeded OGP 캐시 존재 여부 확인 (URL 중심 N:1 공유 캐시 재사용)
      const existingOgp = await tx
        .select({ id: ogpCaches.id })
        .from(ogpCaches)
        .where(eq(ogpCaches.targetUrl, guideUrl))
        .limit(1);

      let ogpId: string;

      if (existingOgp.length > 0) {
        ogpId = existingOgp[0].id;
      } else {
        // 미존재 시 신규 OGP 캐시 생성: 온보딩 가이드 URL은 크롤러 청소 대상에서 제외하기 위해
        // 100년 영구 만료(expiresAt = NOW + 100년) 정책을 적용하여 0ms 지연시간을 보장합니다.
        ogpId = uuidv7();
        const hundredYearsLater = new Date();
        hundredYearsLater.setFullYear(hundredYearsLater.getFullYear() + 100);

        await tx.insert(ogpCaches).values({
          id: ogpId,
          targetUrl: guideUrl,
          title: "Ideamory 사용 가이드 — 0.1초 만에 생각 캡처하기",
          description:
            "뇌의 캐시 메모리, 아이디모리를 200% 활용하는 방법을 확인해 보세요.",
          thumbnailUrl: `${guideUrl}/thumb.png`,
          expiresAt: hundredYearsLater,
        });
      }

      // 2. [사용 가이드] 기본 카테고리 생성 (배타적 소유권 준수: guestToken만 설정, userId는 null)
      await tx.insert(categories).values({
        id: categoryId,
        userId: null,
        guestToken,
        name: "사용 가이드",
        normalizedName: "사용가이드",
      });

      // 3. 온보딩 가이드 시드 메모 생성 (Pre-seeded OGP 연동 및 카테고리 매핑)
      await tx.insert(memos).values({
        id: memoId,
        userId: null,
        guestToken,
        categoryId,
        ogpId,
        content: guideContent,
        embedding: null,
        deletedAt: null,
      });

      return memoId;
    });
  }

  /**
   * 익명 게스트 세션이 보유한 모든 메모 및 카테고리를 단일 트랜잭션으로 완전 영구 삭제(Hard Delete)합니다.
   *
   * @param guestToken 초기화 대상 익명 게스트 세션 토큰
   */
  async resetGuestData(guestToken: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 외래키 무결성 제약(memos.category_id REFERENCES categories.id ON DELETE RESTRICT)으로 인해
      // 반드시 자식 테이블인 memos 레코드를 먼저 삭제한 뒤 categories를 삭제해야 합니다.
      await tx.delete(memos).where(eq(memos.guestToken, guestToken));
      await tx.delete(categories).where(eq(categories.guestToken, guestToken));

      // ogp_caches 테이블은 다수 유저가 URL 키를 공유하는 N:1 구조이므로
      // 게스트 초기화 시 직접 삭제하지 않고 만료 스케줄러(14일 TTL)에 위임합니다.
    });
  }

  /**
   * 익명 게스트 세션에 보관 중이던 모든 카테고리와 메모를 정식 소셜 계정(userId)으로
   * 데이터 손실 및 소유권 제약 위반 없이 단일 트랜잭션으로 일괄 이관(마이그레이션)합니다.
   *
   * @param params.guestToken 이관 대상 게스트 세션 토큰
   * @param params.targetUserId 검증된 Supabase Auth 정회원 UUID (payload.sub)
   */
  async migrateGuestToSocialAccount(params: {
    guestToken: string;
    targetUserId: string;
  }): Promise<void> {
    const { guestToken, targetUserId } = params;

    await this.db.transaction(async (tx) => {
      // 1. 기존 소셜 계정에 이미 존재하는 카테고리 목록 조회 (공백 정규화 키 기준 매핑용)
      const existingSocialCategories = await tx
        .select({
          id: categories.id,
          normalizedName: categories.normalizedName,
        })
        .from(categories)
        .where(eq(categories.userId, targetUserId));

      const socialCategoryMap = new Map<string, string>();
      for (const cat of existingSocialCategories) {
        socialCategoryMap.set(cat.normalizedName, cat.id);
      }

      // 2. 이관할 게스트 세션의 카테고리 목록 조회
      const guestCategories = await tx
        .select({
          id: categories.id,
          normalizedName: categories.normalizedName,
        })
        .from(categories)
        .where(eq(categories.guestToken, guestToken));

      const now = new Date();

      // 3. 카테고리 중복 충돌 해결 및 소유권 이전
      // idx_categories_user_normalized 유니크 인덱스 위반을 방지하기 위해
      // 동일한 normalizedName이 이미 소셜 계정에 존재할 경우 기존 소셜 카테고리로 병합합니다.
      for (const guestCat of guestCategories) {
        const existingSocialCatId = socialCategoryMap.get(
          guestCat.normalizedName
        );

        if (existingSocialCatId) {
          // 게스트 메모들이 기존 소셜 카테고리를 참조하도록 먼저 재매핑 (ON DELETE RESTRICT 방어)
          await tx
            .update(memos)
            .set({
              categoryId: existingSocialCatId,
              updatedAt: now,
            })
            .where(eq(memos.categoryId, guestCat.id));

          // 참조가 해제된 중복 게스트 카테고리 레코드 삭제
          await tx.delete(categories).where(eq(categories.id, guestCat.id));
        } else {
          // 중복이 없는 게스트 카테고리는 소유권을 소셜 계정으로 이전
          // DB CHECK 제약(chk_categories_owner) 준수를 위해 userId 설정과 guestToken=null을 동시 반영
          await tx
            .update(categories)
            .set({
              userId: targetUserId,
              guestToken: null,
              updatedAt: now,
            })
            .where(eq(categories.id, guestCat.id));
        }
      }

      // 4. 게스트의 모든 메모 소유권을 정식 소셜 계정으로 일괄 이전
      // DB CHECK 제약(chk_memos_owner) 준수를 위해 userId 설정과 guestToken=null을 원자적으로 동시 반영
      await tx
        .update(memos)
        .set({
          userId: targetUserId,
          guestToken: null,
          updatedAt: now,
        })
        .where(eq(memos.guestToken, guestToken));
    });
  }

  /**
   * 소셜 회원 탈퇴 요청 시 회원이 소유한 모든 메모, 카테고리 및 인증 계정 레코드를
   * 단일 트랜잭션으로 완전 영구 삭제(Hard Delete)합니다.
   *
   * @param userId 탈퇴를 요청한 정회원 UUID (payload.sub)
   */
  async deleteSocialAccountData(userId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      // 외래키 제약(memos.category_id -> categories.id ON DELETE RESTRICT) 방어를 위해
      // 반드시 memos -> categories -> auth.users 순으로 영구 삭제를 수행합니다.
      await tx.delete(memos).where(eq(memos.userId, userId));
      await tx.delete(categories).where(eq(categories.userId, userId));
      await tx.delete(authUsers).where(eq(authUsers.id, userId));
    });
  }
}

