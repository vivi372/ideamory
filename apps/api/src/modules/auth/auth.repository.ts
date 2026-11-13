import { Injectable } from "@nestjs/common";
import {
  db,
  eq,
  and,
  inArray,
  ogpCaches,
  categories,
  memos,
  authUsers,
} from "@ideamory/db";

/** Drizzle 트랜잭션 컨텍스트 타입 */
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** 일반 DB 클라이언트 또는 트랜잭션 컨텍스트를 아우르는 실행기 타입 */
export type DbExecutor = typeof db | DbTransaction;

/**
 * 인증 및 유저 데이터 라이프사이클 원자적 데이터 접근(Repository) 계층
 * 트랜잭션 경계 관리 및 유즈케이스 오케스트레이션은 Service 계층에 위임하고,
 * 각 메서드는 선택적 트랜잭션 컨텍스트(tx)를 주입받아 단일 테이블 단위의 쿼리만 수행합니다.
 */
@Injectable()
export class AuthRepository {
  /**
   * 단일 PostgreSQL 트랜잭션 경계를 시작하여 콜백을 실행합니다.
   *
   * @param callback 트랜잭션 컨텍스트(tx)를 인자로 받는 비동기 작업
   * @returns 콜백 반환값
   */
  async withTransaction<T>(
    callback: (tx: DbTransaction) => Promise<T>
  ): Promise<T> {
    return db.transaction(callback);
  }

  /**
   * 대상 URL로 캐싱된 OGP 메타데이터 레코드를 조회합니다.
   *
   * @param targetUrl 조회할 대상 URL
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns OGP 캐시 ID 또는 null
   */
  async findOgpCacheByTargetUrl(
    targetUrl: string,
    tx: DbExecutor = db
  ): Promise<{ id: string } | null> {
    const rows = await tx
      .select({ id: ogpCaches.id })
      .from(ogpCaches)
      .where(eq(ogpCaches.targetUrl, targetUrl))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * 신규 OGP 메타데이터 캐시 레코드를 삽입합니다.
   *
   * @param params OGP 캐시 UUID, 대상 URL, 제목, 설명, 만료 시각
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async insertOgpCache(
    params: {
      id: string;
      targetUrl: string;
      title: string;
      description: string;
      expiresAt: Date;
    },
    tx: DbExecutor = db
  ): Promise<void> {
    await tx.insert(ogpCaches).values({
      id: params.id,
      targetUrl: params.targetUrl,
      title: params.title,
      description: params.description,
      expiresAt: params.expiresAt,
    });
  }

  /**
   * 신규 카테고리 레코드를 삽입합니다.
   *
   * @param params 카테고리 ID, 소유자(guestToken 또는 userId), 이름, 정규화 이름
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async insertCategory(
    params: {
      id: string;
      guestToken?: string | null;
      userId?: string | null;
      name: string;
      normalizedName: string;
    },
    tx: DbExecutor = db
  ): Promise<void> {
    await tx.insert(categories).values({
      id: params.id,
      guestToken: params.guestToken ?? null,
      userId: params.userId ?? null,
      name: params.name,
      normalizedName: params.normalizedName,
    });
  }

  /**
   * 신규 메모 레코드를 삽입합니다.
   *
   * @param params 메모 ID, 소유자(guestToken 또는 userId), 카테고리 ID, OGP 캐시 ID, 본문
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async insertMemo(
    params: {
      id: string;
      guestToken?: string | null;
      userId?: string | null;
      categoryId: string;
      ogpId?: string | null;
      content: string;
    },
    tx: DbExecutor = db
  ): Promise<void> {
    await tx.insert(memos).values({
      id: params.id,
      guestToken: params.guestToken ?? null,
      userId: params.userId ?? null,
      categoryId: params.categoryId,
      ogpId: params.ogpId ?? null,
      content: params.content,
      deletedAt: null,
    });
  }

  /**
   * 특정 게스트 토큰 소유의 모든 메모를 영구 삭제(Hard Delete)합니다.
   *
   * @param guestToken 익명 게스트 세션 토큰
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async deleteMemosByGuestToken(
    guestToken: string,
    tx: DbExecutor = db
  ): Promise<void> {
    await tx.delete(memos).where(eq(memos.guestToken, guestToken));
  }

  /**
   * 특정 게스트 토큰 소유의 모든 카테고리를 영구 삭제(Hard Delete)합니다.
   *
   * @param guestToken 익명 게스트 세션 토큰
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async deleteCategoriesByGuestToken(
    guestToken: string,
    tx: DbExecutor = db
  ): Promise<void> {
    await tx.delete(categories).where(eq(categories.guestToken, guestToken));
  }

  /**
   * 게스트 토큰이 보유한 카테고리 목록(id, normalizedName)을 조회합니다.
   *
   * @param guestToken 익명 게스트 세션 토큰
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 게스트 카테고리 목록
   */
  async findCategoriesByGuestToken(
    guestToken: string,
    tx: DbExecutor = db
  ): Promise<Array<{ id: string; normalizedName: string }>> {
    return tx
      .select({
        id: categories.id,
        normalizedName: categories.normalizedName,
      })
      .from(categories)
      .where(eq(categories.guestToken, guestToken));
  }

  /**
   * 정식 소셜 유저가 보유한 카테고리 목록(id, normalizedName)을 조회합니다.
   *
   * @param userId 정식 소셜 유저 UUID
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 소셜 유저 카테고리 목록
   */
  async findCategoriesByUserId(
    userId: string,
    tx: DbExecutor = db
  ): Promise<Array<{ id: string; normalizedName: string }>> {
    return tx
      .select({
        id: categories.id,
        normalizedName: categories.normalizedName,
      })
      .from(categories)
      .where(eq(categories.userId, userId));
  }

  /**
   * 게스트 메모의 카테고리 참조(categoryId)를 다른 카테고리로 일괄 재매핑합니다.
   *
   * @param guestToken 익명 게스트 세션 토큰
   * @param fromCategoryId 기존 게스트 카테고리 ID
   * @param toCategoryId 이관 대상 소셜 카테고리 ID
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async reassignMemosCategory(
    guestToken: string,
    fromCategoryId: string,
    toCategoryId: string,
    tx: DbExecutor = db
  ): Promise<void> {
    await tx
      .update(memos)
      .set({ categoryId: toCategoryId })
      .where(
        and(
          eq(memos.guestToken, guestToken),
          eq(memos.categoryId, fromCategoryId)
        )
      );
  }

  /**
   * 지정된 ID 목록에 해당하는 카테고리들을 일괄 삭제합니다.
   *
   * @param categoryIds 삭제할 카테고리 UUID 목록
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async deleteCategoriesByIds(
    categoryIds: string[],
    tx: DbExecutor = db
  ): Promise<void> {
    if (categoryIds.length === 0) {
      return;
    }
    await tx.delete(categories).where(inArray(categories.id, categoryIds));
  }

  /**
   * 게스트 소유의 카테고리를 소셜 유저 소유로 일괄 전환합니다 (배타적 소유권 준수: guestToken = null).
   *
   * @param guestToken 익명 게스트 세션 토큰
   * @param userId 정식 소셜 유저 UUID
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async transferCategoriesToUser(
    guestToken: string,
    userId: string,
    tx: DbExecutor = db
  ): Promise<void> {
    await tx
      .update(categories)
      .set({ userId, guestToken: null })
      .where(eq(categories.guestToken, guestToken));
  }

  /**
   * 게스트 소유의 메모를 소셜 유저 소유로 일괄 전환합니다 (배타적 소유권 준수: guestToken = null).
   *
   * @param guestToken 익명 게스트 세션 토큰
   * @param userId 정식 소셜 유저 UUID
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async transferMemosToUser(
    guestToken: string,
    userId: string,
    tx: DbExecutor = db
  ): Promise<void> {
    await tx
      .update(memos)
      .set({ userId, guestToken: null })
      .where(eq(memos.guestToken, guestToken));
  }

  /**
   * 정식 소셜 유저 소유의 모든 메모를 영구 삭제(Hard Delete)합니다.
   *
   * @param userId 정식 소셜 유저 UUID
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async deleteMemosByUserId(
    userId: string,
    tx: DbExecutor = db
  ): Promise<void> {
    await tx.delete(memos).where(eq(memos.userId, userId));
  }

  /**
   * 정식 소셜 유저 소유의 모든 카테고리를 영구 삭제(Hard Delete)합니다.
   *
   * @param userId 정식 소셜 유저 UUID
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async deleteCategoriesByUserId(
    userId: string,
    tx: DbExecutor = db
  ): Promise<void> {
    await tx.delete(categories).where(eq(categories.userId, userId));
  }

  /**
   * Supabase Auth 유저 레코드(auth.users)를 영구 삭제합니다.
   *
   * @param userId 정식 소셜 유저 UUID
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async deleteAuthUserById(
    userId: string,
    tx: DbExecutor = db
  ): Promise<void> {
    await tx.delete(authUsers).where(eq(authUsers.id, userId));
  }
}
