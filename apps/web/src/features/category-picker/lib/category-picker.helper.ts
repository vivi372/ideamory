import { matchSorter } from "match-sorter";
import type { CategoryResponseDto, MemoResponseDto } from "@ideamory/api-spec";

/**
 * 검색어를 공백 제거·소문자 정규화 키로 변환합니다.
 * (`'예외 사항'` vs `'예외사항'` 띄어쓰기 파편화 방지용)
 *
 * @param rawName 원본 카테고리명 또는 검색어
 * @returns 공백이 제거된 소문자 정규화 문자열
 */
export function normalizeCategoryKey(rawName: string): string {
  return rawName.replace(/\s+/g, "").toLowerCase();
}

/**
 * 네트워크 요청 없이 클라이언트 메모리에서 `match-sorter`로 카테고리 목록을 즉시 필터링합니다.
 *
 * @param categories 캐시된 활성 카테고리 목록
 * @param searchTerm 사용자가 입력한 검색어
 * @returns 필터링된 카테고리 목록
 */
export function filterCategoriesByTerm(
  categories: CategoryResponseDto[],
  searchTerm: string
): CategoryResponseDto[] {
  const trimmed = searchTerm.trim();
  if (!trimmed) {
    return categories;
  }
  return matchSorter(categories, trimmed, { keys: ["name"] });
}

/**
 * 공백·대소문자 정규화 기준으로 이미 동일한 카테고리가 존재하는지 판별합니다.
 *
 * @param categories 캐시된 활성 카테고리 목록
 * @param searchTerm 사용자가 입력한 검색어
 * @returns 정규화 일치 카테고리 존재 여부
 */
export function hasNormalizedCategoryMatch(
  categories: CategoryResponseDto[],
  searchTerm: string
): boolean {
  const normalized = normalizeCategoryKey(searchTerm);
  if (!normalized) {
    return false;
  }
  return categories.some(
    (cat) => normalizeCategoryKey(cat.name) === normalized
  );
}

/**
 * 메모 목록 캐시에서 대상 메모의 카테고리를 낙관적으로 즉시 교체하고,
 * 기존 카테고리 ID(`sourceCategoryId`)를 함께 반환합니다.
 *
 * @param memos 기존 메모 목록 캐시
 * @param memoId 변경 대상 메모 UUID v7
 * @param targetCategory 새로 적용할 카테고리 정보
 * @returns 갱신된 메모 목록과 기존 카테고리 ID
 */
export function applyMemoCategoryOptimisticUpdate(
  memos: MemoResponseDto[] | undefined,
  memoId: string,
  targetCategory: CategoryResponseDto
): { updatedMemos: MemoResponseDto[] | undefined; sourceCategoryId: string | null } {
  let sourceCategoryId: string | null = null;
  if (!memos) {
    return { updatedMemos: memos, sourceCategoryId };
  }

  const updatedMemos = memos.map((memo) => {
    if (memo.id === memoId) {
      sourceCategoryId = memo.categoryId;
      return {
        ...memo,
        categoryId: targetCategory.id,
        categoryName: targetCategory.name,
      };
    }
    return memo;
  });

  return { updatedMemos, sourceCategoryId };
}

/**
 * 카테고리 변경 직후 사이드바 활성 카테고리 목록의 `memoCount`를 낙관적으로 증감하고,
 * 활성 메모가 0건이 된 기존 카테고리는 0ms 즉시 숨김 처리합니다.
 *
 * @param categories 기존 활성 카테고리 목록 캐시
 * @param sourceCategoryId 이동 전 기존 카테고리 UUID v7
 * @param targetCategory 이동 후 대상 카테고리 정보
 * @returns 갱신된 활성 카테고리 목록
 */
export function applyCategoryCountOptimisticUpdate(
  categories: CategoryResponseDto[] | undefined,
  sourceCategoryId: string | null,
  targetCategory: CategoryResponseDto
): CategoryResponseDto[] | undefined {
  if (!categories) {
    return categories;
  }

  const exists = categories.some((cat) => cat.id === targetCategory.id);
  const adjusted = categories
    .map((cat) => {
      if (cat.id === sourceCategoryId && cat.id !== targetCategory.id) {
        return {
          ...cat,
          memoCount: Math.max(0, (cat.memoCount ?? 1) - 1),
        };
      }
      if (cat.id === targetCategory.id && cat.id !== sourceCategoryId) {
        return { ...cat, memoCount: (cat.memoCount ?? 0) + 1 };
      }
      return cat;
    })
    .filter((cat) => (cat.memoCount ?? 0) > 0);

  if (!exists) {
    return [...adjusted, { ...targetCategory, memoCount: 1 }];
  }
  return adjusted;
}
