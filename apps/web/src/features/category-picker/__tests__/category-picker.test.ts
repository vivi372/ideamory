import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CreateCategorySchema,
  type CategoryResponseDto,
  type MemoResponseDto,
} from "@ideamory/api-spec";
import { generateUuidV7 } from "../../../shared/lib/uuid-v7";
import {
  applyCategoryCountOptimisticUpdate,
  applyMemoCategoryOptimisticUpdate,
  filterCategoriesByTerm,
  hasNormalizedCategoryMatch,
} from "../lib/category-picker.helper";

describe("0ms 카테고리 피커 헬퍼 및 생성 검증", () => {
  const catIdea: CategoryResponseDto = {
    id: generateUuidV7(),
    name: "아이디어",
    memoCount: 1,
  };
  const catShopping: CategoryResponseDto = {
    id: generateUuidV7(),
    name: "쇼핑",
    memoCount: 2,
  };
  const catDev: CategoryResponseDto = {
    id: generateUuidV7(),
    name: "개발 메모",
    memoCount: 5,
  };
  const sampleCategories = [catIdea, catShopping, catDev];

  it("filterCategoriesByTerm은 네트워크 호출 없이 0ms로 카테고리 목록을 필터링해야 한다", () => {
    const filtered = filterCategoriesByTerm(sampleCategories, "쇼핑");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.name, "쇼핑");

    const devFiltered = filterCategoriesByTerm(sampleCategories, "개발");
    assert.equal(devFiltered.length, 1);
    assert.equal(devFiltered[0]?.name, "개발 메모");
  });

  it("hasNormalizedCategoryMatch는 공백·대소문자 차이를 무시하고 중복 카테고리를 탐지해야 한다", () => {
    assert.equal(hasNormalizedCategoryMatch(sampleCategories, "개발메모"), true);
    assert.equal(hasNormalizedCategoryMatch(sampleCategories, "새분류"), false);
  });

  it("낙관적 캐시 헬퍼는 메모 배지를 교체하고 0건이 된 카테고리를 즉시 숨겨야 한다", () => {
    const memoId = generateUuidV7();
    const memos: MemoResponseDto[] = [
      {
        id: memoId,
        content: "테스트 메모",
        categoryId: catIdea.id,
        categoryName: catIdea.name,
        ogpId: null,
        ogp: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
      },
    ];

    const { updatedMemos, sourceCategoryId } =
      applyMemoCategoryOptimisticUpdate(memos, memoId, catShopping);
    assert.equal(sourceCategoryId, catIdea.id);
    assert.equal(updatedMemos?.[0]?.categoryId, catShopping.id);
    assert.equal(updatedMemos?.[0]?.categoryName, "쇼핑");

    const updatedCats = applyCategoryCountOptimisticUpdate(
      sampleCategories,
      sourceCategoryId,
      catShopping
    );
    // memoCount가 1 -> 0이 된 '아이디어'는 즉시 숨김 처리되고 '쇼핑'은 2 -> 3으로 증가
    assert.equal(
      updatedCats?.some((c) => c.id === catIdea.id),
      false
    );
    assert.equal(
      updatedCats?.find((c) => c.id === catShopping.id)?.memoCount,
      3
    );
  });

  it("CreateCategorySchema는 1~10자 및 이모지 배제 규칙을 강제해야 한다", () => {
    const valid = CreateCategorySchema.safeParse({
      id: generateUuidV7(),
      name: "업무노트",
    });
    assert.equal(valid.success, true);

    const tooLong = CreateCategorySchema.safeParse({
      id: generateUuidV7(),
      name: "열한글자카테고리이름임",
    });
    assert.equal(tooLong.success, false);

    const withEmoji = CreateCategorySchema.safeParse({
      id: generateUuidV7(),
      name: "쇼핑🛒",
    });
    assert.equal(withEmoji.success, false);
  });
});
