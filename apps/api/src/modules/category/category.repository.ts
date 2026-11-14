import { Injectable } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import {
  db,
  eq,
  and,
  or,
  ne,
  isNull,
  asc,
  sql,
  categories,
  categoryMergeSuggestions,
  memos,
  type DbTransaction,
  type DbExecutor,
} from "@ideamory/db";
import type { OwnerIdentity } from "../../common/types/owner.type";
import type { MergeSuggestionJoinedRow } from "./category.helper";

/**
 * 카테고리 도메인 데이터 접근(Repository) 계층
 * 배타적 소유권(userId 또는 guestToken) 필터링, 활성 메모 INNER JOIN 가시성 제어,
 * 공백 정규화 중복 조회 및 단일 트랜잭션 기반 카테고리 병합 쿼리를 담당합니다.
 */
@Injectable()
export class CategoryRepository {
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
   * 소유자 식별자(소셜 정회원 UUID 우선, 부재 시 게스트 토큰)에 따른 categories 테이블 조건절을 생성합니다.
   */
  private buildCategoryOwnerCondition(owner: OwnerIdentity) {
    return owner.userId
      ? eq(categories.userId, owner.userId)
      : eq(categories.guestToken, owner.guestToken!);
  }

  /**
   * 소유자 식별자에 따른 memos 테이블 조건절을 생성합니다.
   */
  private buildMemoOwnerCondition(owner: OwnerIdentity) {
    return owner.userId
      ? eq(memos.userId, owner.userId)
      : eq(memos.guestToken, owner.guestToken!);
  }

  /**
   * 활성 메모(deleted_at IS NULL)가 1건 이상 존재하는 소유자의 카테고리 목록과 메모 개수를 조회합니다.
   * INNER JOIN 집계를 사용하여 소속 활성 메모가 0건인 카테고리는 별도 삭제 없이 0ms 즉시 숨김 처리됩니다.
   *
   * @param owner 소유자 식별자
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 활성 카테고리 목록(id, name, memoCount)
   */
  async findActiveCategoriesWithMemoCount(
    owner: OwnerIdentity,
    tx: DbExecutor = db
  ): Promise<Array<{ id: string; name: string; memoCount: number }>> {
    return tx
      .select({
        id: categories.id,
        name: categories.name,
        memoCount: sql<number>`count(${memos.id})::int`,
      })
      .from(categories)
      .innerJoin(
        memos,
        and(
          eq(memos.categoryId, categories.id),
          this.buildMemoOwnerCondition(owner),
          isNull(memos.deletedAt)
        )
      )
      .where(this.buildCategoryOwnerCondition(owner))
      .groupBy(categories.id, categories.name)
      .orderBy(asc(categories.createdAt));
  }

  /**
   * 특정 카테고리에 속한 활성 메모(deleted_at IS NULL) 건수를 조회합니다.
   *
   * @param categoryId 카테고리 UUID
   * @param owner 소유자 식별자
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 활성 메모 개수
   */
  async countActiveMemosByCategoryId(
    categoryId: string,
    owner: OwnerIdentity,
    tx: DbExecutor = db
  ): Promise<number> {
    const rows = await tx
      .select({
        memoCount: sql<number>`count(${memos.id})::int`,
      })
      .from(memos)
      .where(
        and(
          eq(memos.categoryId, categoryId),
          this.buildMemoOwnerCondition(owner),
          isNull(memos.deletedAt)
        )
      );

    return rows[0]?.memoCount ?? 0;
  }

  /**
   * 동일 소유자 스코프 내에서 공백 제거 정규화 키(`normalized_name`)가 일치하는 카테고리를 조회합니다.
   * 이름 수정 시 자기 자신과의 충돌을 피하기 위해 excludeCategoryId를 선택적으로 제외할 수 있습니다.
   *
   * @param owner 소유자 식별자
   * @param normalizedName 공백이 제거된 소문자 정규화 키
   * @param excludeCategoryId 중복 검사에서 제외할 카테고리 ID (수정 시 본인 ID)
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 일치하는 카테고리 요약 또는 null
   */
  async findCategoryByNormalizedName(
    owner: OwnerIdentity,
    normalizedName: string,
    excludeCategoryId?: string,
    tx: DbExecutor = db
  ): Promise<{ id: string; name: string } | null> {
    const conditions = [
      this.buildCategoryOwnerCondition(owner),
      eq(categories.normalizedName, normalizedName),
    ];

    if (excludeCategoryId) {
      conditions.push(ne(categories.id, excludeCategoryId));
    }

    const rows = await tx
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(...conditions))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * 카테고리 ID와 소유권이 모두 일치하는 카테고리를 조회합니다.
   *
   * @param categoryId 카테고리 UUID
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
   * 신규 텍스트 전용 카테고리를 DB에 삽입합니다.
   *
   * @param params 선발급 UUID v7, 소유자, 표시명, 정규화 키
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 생성된 카테고리 요약 정보
   */
  async insertCategory(
    params: {
      id: string;
      owner: OwnerIdentity;
      name: string;
      normalizedName: string;
    },
    tx: DbExecutor = db
  ): Promise<{ id: string; name: string }> {
    const rows = await tx
      .insert(categories)
      .values({
        id: params.id,
        userId: params.owner.userId ?? null,
        guestToken: params.owner.userId
          ? null
          : (params.owner.guestToken ?? null),
        name: params.name,
        normalizedName: params.normalizedName,
      })
      .returning({
        id: categories.id,
        name: categories.name,
      });

    return rows[0];
  }

  /**
   * 소유권 검증이 완료된 카테고리의 이름과 공백 정규화 키를 갱신합니다.
   *
   * @param categoryId 수정할 카테고리 UUID
   * @param owner 소유자 식별자
   * @param name 새 표시명 (1~10자)
   * @param normalizedName 새 공백 정규화 키
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 갱신된 카테고리 요약 정보
   */
  async updateCategoryName(
    categoryId: string,
    owner: OwnerIdentity,
    name: string,
    normalizedName: string,
    tx: DbExecutor = db
  ): Promise<{ id: string; name: string }> {
    const rows = await tx
      .update(categories)
      .set({
        name,
        normalizedName,
        // 이름 변경 후 백그라운드 재임베딩이 실패했을 때 옛 명칭 벡터가 남아 오탐되는 것을 방지하기 위해 NULL로 초기화합니다.
        embedding: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(categories.id, categoryId),
          this.buildCategoryOwnerCondition(owner)
        )
      )
      .returning({
        id: categories.id,
        name: categories.name,
      });

    return rows[0];
  }

  /**
   * 병합 원본 카테고리(sourceCategoryId)에 속한 모든 메모(활성 및 휴지통 포함)를
   * 병합 대상 카테고리(targetCategoryId)로 일괄 이전합니다.
   * 휴지통 메모까지 함께 이전해야 추후 복구 시 삭제된 sourceCategoryId 외래키 참조 오류를 방지할 수 있습니다.
   *
   * @param sourceCategoryId 삭제될 원본 카테고리 UUID
   * @param targetCategoryId 병합 대상 카테고리 UUID
   * @param owner 소유자 식별자
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 카테고리가 변경된 메모 건수
   */
  async reassignMemosCategory(
    sourceCategoryId: string,
    targetCategoryId: string,
    owner: OwnerIdentity,
    tx: DbExecutor = db
  ): Promise<number> {
    const updatedRows = await tx
      .update(memos)
      .set({
        categoryId: targetCategoryId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(memos.categoryId, sourceCategoryId),
          this.buildMemoOwnerCondition(owner)
        )
      )
      .returning({ id: memos.id });

    return updatedRows.length;
  }

  /**
   * 메모 이전이 완료되어 비어 있는 원본 카테고리를 영구 삭제합니다.
   * 외래키 ON DELETE CASCADE 설정에 의해 해당 카테고리와 연결된 병합 제안 레코드도 자동 소멸됩니다.
   *
   * @param categoryId 삭제할 카테고리 UUID
   * @param owner 소유자 식별자
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async deleteCategoryById(
    categoryId: string,
    owner: OwnerIdentity,
    tx: DbExecutor = db
  ): Promise<void> {
    await tx
      .delete(categories)
      .where(
        and(
          eq(categories.id, categoryId),
          this.buildCategoryOwnerCondition(owner)
        )
      );
  }

  /**
   * 특정 카테고리의 임베딩 벡터 보유 여부를 확인합니다.
   *
   * @param categoryId 카테고리 UUID
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns embedding이 NULL이 아니면 true
   */
  async hasCategoryEmbedding(
    categoryId: string,
    tx: DbExecutor = db
  ): Promise<boolean> {
    const rows = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(eq(categories.id, categoryId), sql`${categories.embedding} IS NOT NULL`)
      )
      .limit(1);

    return rows.length > 0;
  }

  /**
   * 카테고리의 768차원 시맨틱 임베딩 벡터를 갱신합니다.
   *
   * @param categoryId 카테고리 UUID
   * @param embedding 768차원 실수 벡터
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async updateCategoryEmbedding(
    categoryId: string,
    embedding: number[],
    tx: DbExecutor = db
  ): Promise<void> {
    await tx
      .update(categories)
      .set({
        embedding,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, categoryId));
  }

  /**
   * 기준 카테고리(`categoryId`)와 동일 소유자(userId 또는 guestToken)에 속하면서
   * 임베딩이 NULL 상태로 남아있는 다른 카테고리들을 최대 `limit`건 조회합니다.
   * 별도 스케줄러 없이 백그라운드 임베딩 동기화 시점에 누락분을 함께 자가 치유(Self-Healing)하기 위해 사용합니다.
   *
   * @param categoryId 기준 카테고리 UUID
   * @param limit 한 번의 배치 임베딩으로 복구할 최대 건수 (기본값: 10)
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 임베딩이 누락된 카테고리(id, name) 목록
   */
  async findMissingEmbeddingCategoriesForSameOwner(
    categoryId: string,
    limit = 10,
    tx: DbExecutor = db
  ): Promise<Array<{ id: string; name: string }>> {
    const result = await tx.execute(sql`
      SELECT
        c2.id AS "id",
        c2.name AS "name"
      FROM public.categories c1
      INNER JOIN public.categories c2
        ON c1.id != c2.id
        AND (
          (c1.user_id IS NOT NULL AND c1.user_id = c2.user_id)
          OR (c1.guest_token IS NOT NULL AND c1.guest_token = c2.guest_token)
        )
      WHERE c1.id = ${categoryId}
        AND c2.embedding IS NULL
      ORDER BY c2.created_at ASC
      LIMIT ${limit}
    `);

    return (result as unknown as Array<{ id: string; name: string }>) ?? [];
  }

  /**
   * pgvector 코사인 유사도(`1 - (c1.embedding <=> c2.embedding) >= 0.85`)를 기반으로
   * 동일 소유자의 유사 카테고리를 탐지하고 `category_merge_suggestions` 큐에 삽입합니다.
   *
   * [0.85 임계값 및 방향성 규칙]
   * - 한국어/영문 단문 카테고리명에서 동의어·유사 표현(예: '구매 계획' vs '쇼핑')은 포착하되,
   *   관련성 낮은 오탐을 억제하기 위해 코사인 유사도 0.85 이상을 채택합니다.
   * - 방금 생성·수정된 `categoryId` (`c1`)를 항상 `source`(삭제/흡수 대상)로 고정하고,
   *   기존의 유사 카테고리(`c2`)를 `target`(유지 대상)으로 일관되게 바인딩합니다.
   * - `NOT EXISTS` 가드로 반대 방향(`source = c2, target = c1`) 제안이 이미 존재할 경우
   *   배치 복구 과정에서 양방향 중복 제안이 삽입되는 현상을 차단합니다.
   *
   * @param categoryId 방금 임베딩이 생성·갱신된 기준 카테고리 UUID
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async detectAndQueueSimilarCategories(
    categoryId: string,
    tx: DbExecutor = db
  ): Promise<void> {
    const result = await tx.execute(sql`
      SELECT
        c1.user_id AS "userId",
        c1.guest_token AS "guestToken",
        c1.id AS "sourceCategoryId",
        c2.id AS "targetCategoryId",
        (1 - (c1.embedding <=> c2.embedding))::float8 AS "similarity"
      FROM public.categories c1
      INNER JOIN public.categories c2
        ON c1.id != c2.id
        AND (
          (c1.user_id IS NOT NULL AND c1.user_id = c2.user_id)
          OR (c1.guest_token IS NOT NULL AND c1.guest_token = c2.guest_token)
        )
      WHERE c1.id = ${categoryId}
        AND c1.embedding IS NOT NULL
        AND c2.embedding IS NOT NULL
        AND (1 - (c1.embedding <=> c2.embedding)) >= 0.85
        AND NOT EXISTS (
          SELECT 1
          FROM public.category_merge_suggestions existing
          WHERE existing.source_category_id = c2.id
            AND existing.target_category_id = c1.id
        )
    `);

    const rows = (result as unknown as Array<{
      userId: string | null;
      guestToken: string | null;
      sourceCategoryId: string;
      targetCategoryId: string;
      similarity: number;
    }>) ?? [];

    if (rows.length === 0) {
      return;
    }

    await tx
      .insert(categoryMergeSuggestions)
      .values(
        rows.map((row) => ({
          id: uuidv7(),
          userId: row.userId,
          guestToken: row.guestToken,
          sourceCategoryId: row.sourceCategoryId,
          targetCategoryId: row.targetCategoryId,
          similarity: row.similarity,
        }))
      )
      .onConflictDoNothing({
        target: [
          categoryMergeSuggestions.sourceCategoryId,
          categoryMergeSuggestions.targetCategoryId,
        ],
      });
  }

  /**
   * 소유자 세션에 대기 중인 유사 카테고리 병합 제안 큐를 유사도 내림차순으로 조회합니다.
   *
   * @param owner 소유자 식별자
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 카테고리명이 조인된 병합 제안 목록
   */
  async findMergeSuggestions(
    owner: OwnerIdentity,
    tx: DbExecutor = db
  ): Promise<MergeSuggestionJoinedRow[]> {
    const ownerFilter = owner.userId
      ? sql`s.user_id = ${owner.userId}`
      : sql`s.guest_token = ${owner.guestToken!}`;

    const result = await tx.execute(sql`
      SELECT
        s.id AS "id",
        s.source_category_id AS "sourceCategoryId",
        src.name AS "sourceCategoryName",
        s.target_category_id AS "targetCategoryId",
        tgt.name AS "targetCategoryName",
        s.similarity::float8 AS "similarity"
      FROM public.category_merge_suggestions s
      INNER JOIN public.categories src ON src.id = s.source_category_id
      INNER JOIN public.categories tgt ON tgt.id = s.target_category_id
      WHERE ${ownerFilter}
      ORDER BY s.similarity DESC, s.created_at DESC
    `);

    return (result as unknown as MergeSuggestionJoinedRow[]) ?? [];
  }

  /**
   * 소유권 검증과 함께 특정 병합 제안 레코드를 DB에서 즉시 영구 삭제(Hard Delete)합니다.
   *
   * @param suggestionId 제안 UUID
   * @param owner 소유자 식별자
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 삭제된 제안 ID 목록 (미존재·소유권 불일치 판별용)
   */
  async deleteMergeSuggestionById(
    suggestionId: string,
    owner: OwnerIdentity,
    tx: DbExecutor = db
  ): Promise<Array<{ id: string }>> {
    const ownerCondition = owner.userId
      ? eq(categoryMergeSuggestions.userId, owner.userId)
      : eq(categoryMergeSuggestions.guestToken, owner.guestToken!);

    return tx
      .delete(categoryMergeSuggestions)
      .where(and(eq(categoryMergeSuggestions.id, suggestionId), ownerCondition))
      .returning({ id: categoryMergeSuggestions.id });
  }

  /**
   * 카테고리명 수정 등으로 기존 병합 제안이 더 이상 유효하지 않을 때
   * 해당 카테고리가 source 또는 target으로 포함된 모든 대기 제안 레코드를 정리합니다.
   *
   * @param categoryId 수정된 카테고리 UUID
   * @param owner 소유자 식별자
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   */
  async deleteSuggestionsByCategoryId(
    categoryId: string,
    owner: OwnerIdentity,
    tx: DbExecutor = db
  ): Promise<void> {
    const ownerCondition = owner.userId
      ? eq(categoryMergeSuggestions.userId, owner.userId)
      : eq(categoryMergeSuggestions.guestToken, owner.guestToken!);

    await tx
      .delete(categoryMergeSuggestions)
      .where(
        and(
          ownerCondition,
          or(
            eq(categoryMergeSuggestions.sourceCategoryId, categoryId),
            eq(categoryMergeSuggestions.targetCategoryId, categoryId)
          )
        )
      );
  }
}
