import { Injectable } from "@nestjs/common";
import {
  db,
  eq,
  and,
  ne,
  isNull,
  asc,
  sql,
  categories,
  memos,
  type DbTransaction,
  type DbExecutor,
} from "@ideamory/db";
import type { OwnerIdentity } from "../../common/types/owner.type";

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
}
