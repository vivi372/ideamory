import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { HttpStatus } from "@nestjs/common";
import { ERROR_CODES } from "@ideamory/api-spec";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AiService } from "../ai/ai.service";
import { CategoryService } from "./category.service";
import { CategoryRepository } from "./category.repository";

describe("CategoryService (텍스트 전용 카테고리 CRUD, 공백 정규화, AI 유사 카테고리 탐지/제안 큐, 트랜잭션 병합)", () => {
  const owner = { userId: "018d0000-0000-7000-8000-000000000001" };
  let categoryService: CategoryService;
  let storedCategories: Array<{
    id: string;
    name: string;
    normalizedName: string;
    memoCount: number;
  }>;
  let deletedCategoryIds: string[];
  let reassignedCalls: Array<{ sourceId: string; targetId: string }>;
  let updatedEmbeddingCalls: Array<{ categoryId: string; dims: number }>;
  let detectedCategoryIds: string[];
  let storedSuggestions: Array<{
    id: string;
    sourceCategoryId: string;
    sourceCategoryName: string;
    targetCategoryId: string;
    targetCategoryName: string;
    similarity: number;
  }>;

  beforeEach(() => {
    storedCategories = [
      {
        id: "018d0000-0000-7000-8000-000000000010",
        name: "개발 메모",
        normalizedName: "개발메모",
        memoCount: 3,
      },
      {
        id: "018d0000-0000-7000-8000-000000000011",
        name: "구매 계획",
        normalizedName: "구매계획",
        memoCount: 5,
      },
      {
        id: "018d0000-0000-7000-8000-000000000012",
        name: "빈 카테고리",
        normalizedName: "빈카테고리",
        memoCount: 0,
      },
    ];
    deletedCategoryIds = [];
    reassignedCalls = [];
    updatedEmbeddingCalls = [];
    detectedCategoryIds = [];
    storedSuggestions = [
      {
        id: "018d0000-0000-7000-8000-000000000099",
        sourceCategoryId: "018d0000-0000-7000-8000-000000000011",
        sourceCategoryName: "구매 계획",
        targetCategoryId: "018d0000-0000-7000-8000-000000000010",
        targetCategoryName: "쇼핑",
        similarity: 0.881234,
      },
    ];

    const mockRepo: Partial<CategoryRepository> = {
      withTransaction: async (cb) => cb({} as any),
      findActiveCategoriesWithMemoCount: async () =>
        storedCategories
          .filter((c) => c.memoCount > 0)
          .map(({ id, name, memoCount }) => ({ id, name, memoCount })),
      countActiveMemosByCategoryId: async (categoryId) =>
        storedCategories.find((c) => c.id === categoryId)?.memoCount ?? 0,
      findCategoryByNormalizedName: async (
        _owner,
        normalizedName,
        excludeCategoryId
      ) => {
        const found = storedCategories.find(
          (c) =>
            c.normalizedName === normalizedName && c.id !== excludeCategoryId
        );
        return found ? { id: found.id, name: found.name } : null;
      },
      findCategoryByIdAndOwner: async (categoryId) => {
        const found = storedCategories.find((c) => c.id === categoryId);
        return found ? { id: found.id, name: found.name } : null;
      },
      insertCategory: async ({ id, name, normalizedName }) => {
        storedCategories.push({ id, name, normalizedName, memoCount: 0 });
        return { id, name };
      },
      updateCategoryName: async (categoryId, _owner, name, normalizedName) => {
        const found = storedCategories.find((c) => c.id === categoryId)!;
        found.name = name;
        found.normalizedName = normalizedName;
        return { id: found.id, name: found.name };
      },
      reassignMemosCategory: async (sourceId, targetId) => {
        reassignedCalls.push({ sourceId, targetId });
        const source = storedCategories.find((c) => c.id === sourceId);
        const count = source?.memoCount ?? 0;
        if (source) {
          source.memoCount = 0;
        }
        return count;
      },
      deleteCategoryById: async (categoryId) => {
        deletedCategoryIds.push(categoryId);
        storedCategories = storedCategories.filter((c) => c.id !== categoryId);
      },
      hasCategoryEmbedding: async () => false,
      updateCategoryEmbedding: async (categoryId, embedding) => {
        updatedEmbeddingCalls.push({ categoryId, dims: embedding.length });
      },
      detectAndQueueSimilarCategories: async (categoryId) => {
        detectedCategoryIds.push(categoryId);
      },
      findMergeSuggestions: async () => storedSuggestions,
      deleteMergeSuggestionById: async (suggestionId) => {
        const before = storedSuggestions.length;
        storedSuggestions = storedSuggestions.filter(
          (s) => s.id !== suggestionId
        );
        return storedSuggestions.length < before ? [{ id: suggestionId }] : [];
      },
      deleteSuggestionsByCategoryId: async (categoryId) => {
        storedSuggestions = storedSuggestions.filter(
          (s) =>
            s.sourceCategoryId !== categoryId &&
            s.targetCategoryId !== categoryId
        );
      },
    };

    const mockAiService: Partial<AiService> = {
      generateEmbedding: async () => new Array(768).fill(0.05),
    };

    categoryService = new CategoryService(
      mockRepo as CategoryRepository,
      mockAiService as AiService
    );
  });

  it("시나리오 1: getCategories는 활성 메모가 1건 이상인 카테고리만 반환하고, 소유자 미지정 시 401 예외를 발생시켜야 한다", async () => {
    const result = await categoryService.getCategories(owner);

    assert.equal(result.length, 2);
    assert.deepEqual(
      result.map((c) => c.name),
      ["개발 메모", "구매 계획"]
    );

    await assert.rejects(
      () => categoryService.getCategories({}),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.UNAUTHORIZED);
        assert.equal(err.errorCode, ERROR_CODES.AUTH_ALERT_UNAUTHORIZED);
        return true;
      }
    );
  });

  it("시나리오 2: createCategory는 신규 생성 시 memoCount: 0을 반환하고, 공백 정규화 중복 시 409 CATEGORY_WARN_DUPLICATE를 발생시켜야 한다", async () => {
    const newId = "018d0000-0000-7000-8000-000000000020";
    const created = await categoryService.createCategory(owner, {
      id: newId,
      name: "  독서 노트  ",
    });

    assert.equal(created.id, newId);
    assert.equal(created.name, "독서 노트");
    assert.equal(created.memoCount, 0);

    // 띄어쓰기가 다른 동일 정규화 키("구매계획") 중복 시도
    await assert.rejects(
      () =>
        categoryService.createCategory(owner, {
          id: "018d0000-0000-7000-8000-000000000021",
          name: "구매계획",
        }),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.CONFLICT);
        assert.equal(err.errorCode, ERROR_CODES.CATEGORY_WARN_DUPLICATE);
        return true;
      }
    );
  });

  it("시나리오 3: updateCategory는 명칭 수정 및 활성 메모 수를 반환하며, 미존재 시 404 / 타 카테고리 중복 시 409 예외를 발생시켜야 한다", async () => {
    const updated = await categoryService.updateCategory(
      owner,
      "018d0000-0000-7000-8000-000000000010",
      { name: "백엔드" }
    );
    assert.equal(updated.name, "백엔드");
    assert.equal(updated.memoCount, 3);

    // 미존재 카테고리 수정 시 404
    await assert.rejects(
      () =>
        categoryService.updateCategory(
          owner,
          "018d0000-0000-7000-8000-999999999999",
          { name: "신규" }
        ),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.NOT_FOUND);
        assert.equal(err.errorCode, ERROR_CODES.CATEGORY_WARN_NOT_FOUND);
        return true;
      }
    );

    // 다른 카테고리와 정규화 키 중복 시 409
    await assert.rejects(
      () =>
        categoryService.updateCategory(
          owner,
          "018d0000-0000-7000-8000-000000000010",
          { name: "구매계획" }
        ),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.CONFLICT);
        assert.equal(err.errorCode, ERROR_CODES.CATEGORY_WARN_DUPLICATE);
        return true;
      }
    );
  });

  it("시나리오 4: mergeCategories는 동일 ID 병합(400)과 미존재 대상(404)을 차단하고, 정상 병합 시 메모 이전 및 원본 삭제를 수행해야 한다", async () => {
    // 동일 ID 병합 시도 -> 400
    await assert.rejects(
      () =>
        categoryService.mergeCategories(owner, {
          sourceCategoryId: "018d0000-0000-7000-8000-000000000010",
          targetCategoryId: "018d0000-0000-7000-8000-000000000010",
        }),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
        assert.equal(err.errorCode, ERROR_CODES.CATEGORY_ERROR_MERGE_SAME);
        return true;
      }
    );

    // 존재하지 않는 카테고리 병합 시도 -> 404
    await assert.rejects(
      () =>
        categoryService.mergeCategories(owner, {
          sourceCategoryId: "018d0000-0000-7000-8000-999999999999",
          targetCategoryId: "018d0000-0000-7000-8000-000000000010",
        }),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.NOT_FOUND);
        assert.equal(err.errorCode, ERROR_CODES.CATEGORY_WARN_NOT_FOUND);
        return true;
      }
    );

    // 정상 병합 (구매 계획 5건 -> 개발 메모)
    const mergeResult = await categoryService.mergeCategories(owner, {
      sourceCategoryId: "018d0000-0000-7000-8000-000000000011",
      targetCategoryId: "018d0000-0000-7000-8000-000000000010",
    });

    assert.deepEqual(mergeResult, { success: true, affectedMemosCount: 5 });
    assert.deepEqual(reassignedCalls, [
      {
        sourceId: "018d0000-0000-7000-8000-000000000011",
        targetId: "018d0000-0000-7000-8000-000000000010",
      },
    ]);
    assert.deepEqual(deletedCategoryIds, [
      "018d0000-0000-7000-8000-000000000011",
    ]);
  });

  it("시나리오 5: 카테고리 생성/수정 시 비동기 백그라운드에서 임베딩 저장 및 유사 카테고리 탐지 쿼리가 트리거되어야 한다", async () => {
    const newId = "018d0000-0000-7000-8000-000000000030";
    await categoryService.createCategory(owner, { id: newId, name: "쇼핑" });
    await new Promise((r) => setTimeout(r, 15));

    assert.deepEqual(updatedEmbeddingCalls, [{ categoryId: newId, dims: 768 }]);
    assert.deepEqual(detectedCategoryIds, [newId]);

    await categoryService.updateCategory(owner, newId, { name: "장보기" });
    await new Promise((r) => setTimeout(r, 15));

    assert.equal(updatedEmbeddingCalls.length, 2);
    assert.deepEqual(detectedCategoryIds, [newId, newId]);

    // 기존 제안 큐에 포함된 카테고리 수정 시 해당 제안이 즉시 정리되어야 한다
    await categoryService.updateCategory(
      owner,
      "018d0000-0000-7000-8000-000000000011",
      { name: "쇼핑 리스트" }
    );
    const remainingSuggestions = await categoryService.getMergeSuggestions(owner);
    assert.equal(remainingSuggestions.length, 0);
  });

  it("시나리오 6: getMergeSuggestions는 대기 제안 큐를 반올림된 similarity와 함께 반환하고, dismissMergeSuggestion은 즉시 삭제 또는 404 예외를 발생시켜야 한다", async () => {
    const list = await categoryService.getMergeSuggestions(owner);
    assert.equal(list.length, 1);
    assert.equal(list[0].similarity, 0.8812);

    await categoryService.dismissMergeSuggestion(
      owner,
      "018d0000-0000-7000-8000-000000000099"
    );
    const afterDismiss = await categoryService.getMergeSuggestions(owner);
    assert.equal(afterDismiss.length, 0);

    await assert.rejects(
      () =>
        categoryService.dismissMergeSuggestion(
          owner,
          "018d0000-0000-7000-8000-000000000099"
        ),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.NOT_FOUND);
        assert.equal(err.errorCode, ERROR_CODES.CATEGORY_WARN_NOT_FOUND);
        return true;
      }
    );
  });
});
