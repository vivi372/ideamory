import { Injectable } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import {
  db,
  eq,
  and,
  gt,
  lt,
  isNull,
  isNotNull,
  desc,
  sql,
  categories,
  memos,
  ogpCaches,
  type DbTransaction,
  type DbExecutor,
} from "@ideamory/db";
import type { OwnerIdentity } from "../../common/types/owner.type";
import { toPgVectorLiteral } from "./memo.helper";
import type {
  HybridSearchRawRow,
  MemoWithRelations,
  RelatedMemoRawRow,
} from "./memo.type";

/**
 * 메모 및 카테고리 코어 데이터 접근(Repository) 계층
 * 배타적 소유권 필터링, 트랜잭션 컨텍스트(tx) 주입, OGP LEFT JOIN 조회 및 휴지통/고아 카테고리 정리를 수행합니다.
 */
@Injectable()
export class MemoRepository {
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
   * 소유자 식별자(userId 우선, 부재 시 guestToken)에 따른 memos 테이블 조건절을 생성합니다.
   */
  private buildMemoOwnerCondition(owner: OwnerIdentity) {
    return owner.userId
      ? eq(memos.userId, owner.userId)
      : eq(memos.guestToken, owner.guestToken!);
  }

  /**
   * 소유자 식별자에 따른 categories 테이블 조건절을 생성합니다.
   */
  private buildCategoryOwnerCondition(owner: OwnerIdentity) {
    return owner.userId
      ? eq(categories.userId, owner.userId)
      : eq(categories.guestToken, owner.guestToken!);
  }

  /**
   * 특정 소유자가 보유한 활성 카테고리 목록(id, name, normalizedName)을 조회합니다.
   *
   * @param owner 소유자 식별자
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 카테고리 목록
   */
  async findCategoriesByOwner(
    owner: OwnerIdentity,
    tx: DbExecutor = db
  ): Promise<Array<{ id: string; name: string; normalizedName: string }>> {
    return tx
      .select({
        id: categories.id,
        name: categories.name,
        normalizedName: categories.normalizedName,
      })
      .from(categories)
      .where(this.buildCategoryOwnerCondition(owner));
  }

  /**
   * 특정 소유자의 정규화 카테고리명으로 기존 카테고리를 조회하고, 없으면 동시성 안전하게 생성합니다.
   *
   * @param owner 소유자 식별자
   * @param name 표시용 카테고리 이름 (1~10자)
   * @param normalizedName 정규화 키
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 조회 또는 생성된 카테고리(id, name)
   */
  async findOrCreateCategory(
    owner: OwnerIdentity,
    name: string,
    normalizedName: string,
    tx: DbExecutor = db
  ): Promise<{ id: string; name: string }> {
    const existing = await tx
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(
        and(
          this.buildCategoryOwnerCondition(owner),
          eq(categories.normalizedName, normalizedName)
        )
      )
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    const newId = uuidv7();
    await tx
      .insert(categories)
      .values({
        id: newId,
        userId: owner.userId ?? null,
        guestToken: owner.userId ? null : (owner.guestToken ?? null),
        name,
        normalizedName,
      })
      .onConflictDoNothing();

    // 동시 요청으로 먼저 생성된 경우를 포함하여 최종 레코드 재조회
    const resolved = await tx
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(
        and(
          this.buildCategoryOwnerCondition(owner),
          eq(categories.normalizedName, normalizedName)
        )
      )
      .limit(1);

    return resolved[0] ?? { id: newId, name };
  }

  /**
   * 특정 카테고리 ID가 해당 소유자의 소유인지 검증합니다.
   *
   * @param categoryId 검증할 카테고리 UUID
   * @param owner 소유자 식별자
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 카테고리 요약 정보 또는 null
   */
  async findCategoryByIdAndOwner(
    categoryId: string,
    owner: OwnerIdentity,
    tx: DbExecutor = db
  ): Promise<{ id: string; name: string } | null> {
    const rows = await tx
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          this.buildCategoryOwnerCondition(owner)
        )
      )
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * 신규 메모를 DB에 즉시 삽입합니다 (0.1초 퀵 캡처 1단계).
   *
   * @param params 메모 ID, 소유자, 카테고리 ID, 본문
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 생성된 메모 타임스탬프
   */
  async insertMemo(
    params: {
      id: string;
      owner: OwnerIdentity;
      categoryId: string;
      content: string;
    },
    tx: DbExecutor = db
  ): Promise<{ createdAt: Date; updatedAt: Date }> {
    const rows = await tx
      .insert(memos)
      .values({
        id: params.id,
        userId: params.owner.userId ?? null,
        guestToken: params.owner.userId
          ? null
          : (params.owner.guestToken ?? null),
        categoryId: params.categoryId,
        content: params.content,
        deletedAt: null,
      })
      .returning({
        createdAt: memos.createdAt,
        updatedAt: memos.updatedAt,
      });

    return rows[0];
  }

  /**
   * 소유자의 메모 타임라인 목록을 카테고리 및 유효 OGP 캐시와 조인하여 최신순으로 조회합니다.
   *
   * @param owner 소유자 식별자
   * @param options 카테고리 필터 및 휴지통(deleted) 조회 여부
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 조인된 메모 목록
   */
  async findMemosWithOgp(
    owner: OwnerIdentity,
    options: { categoryId?: string; deleted: boolean },
    tx: DbExecutor = db
  ): Promise<MemoWithRelations[]> {
    const conditions = [
      this.buildMemoOwnerCondition(owner),
      options.deleted ? isNotNull(memos.deletedAt) : isNull(memos.deletedAt),
    ];

    if (options.categoryId) {
      conditions.push(eq(memos.categoryId, options.categoryId));
    }

    const rows = await tx
      .select({
        id: memos.id,
        content: memos.content,
        categoryId: memos.categoryId,
        categoryName: categories.name,
        ogpId: memos.ogpId,
        ogp: ogpCaches,
        deletedAt: memos.deletedAt,
        createdAt: memos.createdAt,
        updatedAt: memos.updatedAt,
      })
      .from(memos)
      .innerJoin(categories, eq(memos.categoryId, categories.id))
      .leftJoin(
        ogpCaches,
        and(eq(memos.ogpId, ogpCaches.id), gt(ogpCaches.expiresAt, sql`NOW()`))
      )
      .where(and(...conditions))
      .orderBy(desc(memos.createdAt));

    return rows;
  }

  /**
   * 단일 메모를 소유권 검증과 함께 관계 정보(카테고리, OGP)까지 조회합니다.
   *
   * @param memoId 메모 UUID
   * @param owner 소유자 식별자
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 조인된 메모 정보 또는 null
   */
  async findMemoByIdAndOwner(
    memoId: string,
    owner: OwnerIdentity,
    tx: DbExecutor = db
  ): Promise<MemoWithRelations | null> {
    const rows = await tx
      .select({
        id: memos.id,
        content: memos.content,
        categoryId: memos.categoryId,
        categoryName: categories.name,
        ogpId: memos.ogpId,
        ogp: ogpCaches,
        deletedAt: memos.deletedAt,
        createdAt: memos.createdAt,
        updatedAt: memos.updatedAt,
      })
      .from(memos)
      .innerJoin(categories, eq(memos.categoryId, categories.id))
      .leftJoin(
        ogpCaches,
        and(eq(memos.ogpId, ogpCaches.id), gt(ogpCaches.expiresAt, sql`NOW()`))
      )
      .where(and(eq(memos.id, memoId), this.buildMemoOwnerCondition(owner)))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * 메모 본문 또는 카테고리를 수정합니다.
   *
   * @param memoId 메모 UUID
   * @param owner 소유자 식별자
   * @param updates 변경할 본문/카테고리 ID
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async updateMemoById(
    memoId: string,
    owner: OwnerIdentity,
    updates: { content?: string; categoryId?: string },
    tx: DbExecutor = db
  ): Promise<void> {
    await tx
      .update(memos)
      .set({
        ...(updates.content !== undefined ? { content: updates.content } : {}),
        ...(updates.categoryId !== undefined
          ? { categoryId: updates.categoryId }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(memos.id, memoId), this.buildMemoOwnerCondition(owner)));
  }

  /**
   * 메모의 Soft Delete 상태(`deletedAt`)를 갱신합니다 (삭제 시 현재 시각, 복구 시 null).
   *
   * @param memoId 메모 UUID
   * @param owner 소유자 식별자
   * @param deletedAt 삭제 일시 또는 복구 시 null
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 갱신된 메모 ID 목록 (존재 여부 판별용)
   */
  async updateMemoDeletedAt(
    memoId: string,
    owner: OwnerIdentity,
    deletedAt: Date | null,
    tx: DbExecutor = db
  ): Promise<Array<{ id: string }>> {
    return tx
      .update(memos)
      .set({
        deletedAt,
        updatedAt: new Date(),
      })
      .where(and(eq(memos.id, memoId), this.buildMemoOwnerCondition(owner)))
      .returning({ id: memos.id });
  }

  /**
   * 2단계 비동기 백그라운드 파이프라인 결과(AI 카테고리, 768차원 임베딩, OGP ID)를 메모에 반영합니다.
   *
   * @param memoId 메모 UUID
   * @param updates 비동기 파이프라인 산출물
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async updateMemoBackgroundEnrichment(
    memoId: string,
    updates: {
      categoryId?: string;
      embedding?: number[];
      ogpId?: string;
    },
    tx: DbExecutor = db
  ): Promise<void> {
    const setPayload: Record<string, any> = {};
    if (updates.categoryId !== undefined) {
      setPayload.categoryId = updates.categoryId;
    }
    if (updates.embedding !== undefined) {
      setPayload.embedding = updates.embedding;
    }
    if (updates.ogpId !== undefined) {
      setPayload.ogpId = updates.ogpId;
    }

    if (Object.keys(setPayload).length === 0) {
      return;
    }

    await tx.update(memos).set(setPayload).where(eq(memos.id, memoId));
  }

  /**
   * 30일 보관 기간이 만료된 휴지통 메모를 완전 영구 삭제(Hard Delete)합니다.
   *
   * @param cutoffDate 만료 기준 시각 (현재 시각 - 30일)
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 영구 삭제된 메모 ID 목록
   */
  async deleteExpiredTrashMemos(
    cutoffDate: Date,
    tx: DbExecutor = db
  ): Promise<Array<{ id: string }>> {
    return tx
      .delete(memos)
      .where(lt(memos.deletedAt, cutoffDate))
      .returning({ id: memos.id });
  }

  /**
   * 활성/휴지통 메모 어느 쪽에서도 참조되지 않는(참조 카운트 0건) 고아 카테고리를 일괄 영구 삭제합니다.
   *
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 정리된 고아 카테고리 ID 목록
   */
  async deleteOrphanCategories(
    tx: DbExecutor = db
  ): Promise<Array<{ id: string }>> {
    return tx
      .delete(categories)
      .where(
        sql`NOT EXISTS (SELECT 1 FROM memos m WHERE m.category_id = ${categories.id})`
      )
      .returning({ id: categories.id });
  }

  /**
   * Drizzle Raw SQL 기반 FTS(0.4) + pgvector 코사인 유사도(0.6) 하이브리드 검색을 실행합니다.
   *
   * [하이브리드 스코어링 및 인덱스 설계 근거]
   * - PostgreSQL `simple` 사전: 형태소 분석기 의존 없이 한·영 혼용 본문을 공백·구두점 토큰화하고
   *   `idx_memos_content_fts` GIN 인덱스를 안정적으로 활용하기 위해 사용합니다.
   * - 가중치 결합(FTS 0.4 + Vector 0.6): 정확한 키워드 일치와 문맥·동의어 기반 시맨틱 유사도를 균형 있게 반영합니다.
   * - NULL 벡터 방어: 아직 백그라운드 임베딩이 생성되지 않은 메모(`embedding IS NULL`)가 FTS로 매칭되었을 때
   *   코사인 연산 결과가 `NULL`이 되어 `finalScore` 정렬 최상단에 노출(`NULLS FIRST`)되는 현상을 막기 위해
   *   `CASE WHEN m.embedding IS NOT NULL` 분기로 `0.0`을 보정합니다.
   * - AI 폴백 지원: Gemini 임베딩 생성이 불가해 `queryVector`가 `null`이면 FTS 단독 검색(가중치 0.4)으로 동작합니다.
   *
   * @param params 소유자, 정제된 검색어, 768차원 검색 벡터(또는 null), 유사도 임계값, 최대 반환 건수
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 하이브리드 스코어 및 유효 OGP 캐시가 포함된 검색 결과 행 목록
   */
  async searchMemosHybrid(
    params: {
      owner: OwnerIdentity;
      queryText: string;
      queryVector: number[] | null;
      threshold: number;
      limit: number;
    },
    tx: DbExecutor = db
  ): Promise<HybridSearchRawRow[]> {
    const ownerFilter = params.owner.userId
      ? sql`m.user_id = ${params.owner.userId}`
      : sql`m.guest_token = ${params.owner.guestToken!}`;

    if (!params.queryVector) {
      const ftsOnlyResult = await tx.execute(sql`
        SELECT
          m.id AS "id",
          m.content AS "content",
          m.category_id AS "categoryId",
          c.name AS "categoryName",
          LEAST(
            1.0,
            COALESCE(
              ts_rank_cd(
                to_tsvector('simple', m.content),
                plainto_tsquery('simple', ${params.queryText})
              ),
              0.0
            )
          )::float8 AS "ftsScore",
          0.0::float8 AS "vectorScore",
          (
            LEAST(
              1.0,
              COALESCE(
                ts_rank_cd(
                  to_tsvector('simple', m.content),
                  plainto_tsquery('simple', ${params.queryText})
                ),
                0.0
              )
            ) * 0.4
          )::float8 AS "finalScore",
          ogp.id AS "ogpId",
          ogp.target_url AS "ogpTargetUrl",
          ogp.title AS "ogpTitle",
          ogp.thumbnail_url AS "ogpThumbnailUrl",
          ogp.description AS "ogpDescription",
          ogp.expires_at AS "ogpExpiresAt",
          ogp.fetched_at AS "ogpFetchedAt",
          m.created_at AS "createdAt"
        FROM public.memos m
        INNER JOIN public.categories c ON c.id = m.category_id
        LEFT JOIN public.ogp_caches ogp
          ON ogp.id = m.ogp_id AND ogp.expires_at > NOW()
        WHERE m.deleted_at IS NULL
          AND ${ownerFilter}
          AND to_tsvector('simple', m.content) @@ plainto_tsquery('simple', ${params.queryText})
        ORDER BY "finalScore" DESC, m.created_at DESC
        LIMIT ${params.limit}
      `);

      return (ftsOnlyResult as unknown as HybridSearchRawRow[]) ?? [];
    }

    const vectorLiteral = toPgVectorLiteral(params.queryVector);
    const hybridResult = await tx.execute(sql`
      SELECT
        m.id AS "id",
        m.content AS "content",
        m.category_id AS "categoryId",
        c.name AS "categoryName",
        LEAST(
          1.0,
          COALESCE(
            ts_rank_cd(
              to_tsvector('simple', m.content),
              plainto_tsquery('simple', ${params.queryText})
            ),
            0.0
          )
        )::float8 AS "ftsScore",
        CASE
          WHEN m.embedding IS NOT NULL THEN
            GREATEST(
              0.0,
              LEAST(1.0, (1 - (m.embedding <=> ${vectorLiteral}::vector)))
            )::float8
          ELSE 0.0
        END AS "vectorScore",
        (
          (
            LEAST(
              1.0,
              COALESCE(
                ts_rank_cd(
                  to_tsvector('simple', m.content),
                  plainto_tsquery('simple', ${params.queryText})
                ),
                0.0
              )
            ) * 0.4
          ) +
          (
            CASE
              WHEN m.embedding IS NOT NULL THEN
                GREATEST(
                  0.0,
                  LEAST(1.0, (1 - (m.embedding <=> ${vectorLiteral}::vector)))
                )
              ELSE 0.0
            END * 0.6
          )
        )::float8 AS "finalScore",
        ogp.id AS "ogpId",
        ogp.target_url AS "ogpTargetUrl",
        ogp.title AS "ogpTitle",
        ogp.thumbnail_url AS "ogpThumbnailUrl",
        ogp.description AS "ogpDescription",
        ogp.expires_at AS "ogpExpiresAt",
        ogp.fetched_at AS "ogpFetchedAt",
        m.created_at AS "createdAt"
      FROM public.memos m
      INNER JOIN public.categories c ON c.id = m.category_id
      LEFT JOIN public.ogp_caches ogp
        ON ogp.id = m.ogp_id AND ogp.expires_at > NOW()
      WHERE m.deleted_at IS NULL
        AND ${ownerFilter}
        AND (
          to_tsvector('simple', m.content) @@ plainto_tsquery('simple', ${params.queryText})
          OR (
            m.embedding IS NOT NULL
            AND (1 - (m.embedding <=> ${vectorLiteral}::vector)) >= ${params.threshold}
          )
        )
      ORDER BY "finalScore" DESC, m.created_at DESC
      LIMIT ${params.limit}
    `);

    return (hybridResult as unknown as HybridSearchRawRow[]) ?? [];
  }

  /**
   * 연관 메모 추출을 위해 기준 메모의 소유권, 삭제 상태 및 768차원 임베딩 벡터를 조회합니다.
   *
   * @param memoId 기준 메모 UUID
   * @param owner 소유자 식별자
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 메모 임베딩 및 삭제 여부 정보 또는 null
   */
  async findMemoEmbeddingByIdAndOwner(
    memoId: string,
    owner: OwnerIdentity,
    tx: DbExecutor = db
  ): Promise<{
    id: string;
    embedding: number[] | null;
    deletedAt: Date | null;
  } | null> {
    const rows = await tx
      .select({
        id: memos.id,
        embedding: memos.embedding,
        deletedAt: memos.deletedAt,
      })
      .from(memos)
      .where(and(eq(memos.id, memoId), this.buildMemoOwnerCondition(owner)))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * 기준 메모의 768차원 임베딩 벡터와 pgvector 코사인 유사도(`>= threshold`, 기본 0.8)를 만족하는
   * 동일 소유자의 1-Depth 연관 메모 목록을 유사도 내림차순으로 조회합니다.
   *
   * @param params 소유자, 기준 메모 ID, 기준 벡터, 최소 유사도 임계값, 최대 반환 건수
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 유사도 및 유효 OGP 캐시가 조인된 연관 메모 행 목록
   */
  async findRelatedMemos(
    params: {
      owner: OwnerIdentity;
      sourceMemoId: string;
      sourceVector: number[];
      threshold: number;
      limit: number;
    },
    tx: DbExecutor = db
  ): Promise<RelatedMemoRawRow[]> {
    const ownerFilter = params.owner.userId
      ? sql`m.user_id = ${params.owner.userId}`
      : sql`m.guest_token = ${params.owner.guestToken!}`;
    const sourceVectorLiteral = toPgVectorLiteral(params.sourceVector);

    const result = await tx.execute(sql`
      SELECT
        m.id AS "id",
        m.content AS "content",
        m.category_id AS "categoryId",
        c.name AS "categoryName",
        GREATEST(
          0.0,
          LEAST(1.0, (1 - (m.embedding <=> ${sourceVectorLiteral}::vector)))
        )::float8 AS "similarity",
        ogp.id AS "ogpId",
        ogp.target_url AS "ogpTargetUrl",
        ogp.title AS "ogpTitle",
        ogp.thumbnail_url AS "ogpThumbnailUrl",
        ogp.description AS "ogpDescription",
        ogp.expires_at AS "ogpExpiresAt",
        ogp.fetched_at AS "ogpFetchedAt",
        m.created_at AS "createdAt"
      FROM public.memos m
      INNER JOIN public.categories c ON c.id = m.category_id
      LEFT JOIN public.ogp_caches ogp
        ON ogp.id = m.ogp_id AND ogp.expires_at > NOW()
      WHERE m.id != ${params.sourceMemoId}
        AND m.deleted_at IS NULL
        AND m.embedding IS NOT NULL
        AND ${ownerFilter}
        AND (1 - (m.embedding <=> ${sourceVectorLiteral}::vector)) >= ${params.threshold}
      ORDER BY "similarity" DESC, m.created_at DESC
      LIMIT ${params.limit}
    `);

    return (result as unknown as RelatedMemoRawRow[]) ?? [];
  }
}

