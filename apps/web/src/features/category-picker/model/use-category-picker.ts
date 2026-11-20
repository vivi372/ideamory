"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CreateCategorySchema,
  type CategoryResponseDto,
} from "@ideamory/api-spec";
import { queryKeys } from "@/shared/api";
import { generateUuidV7 } from "@/shared/lib/uuid-v7";
import { useViewStore } from "@/shared/model/view-store";
import { fetchCategoriesListApi } from "../api/category.api";
import {
  filterCategoriesByTerm,
  hasNormalizedCategoryMatch,
} from "../lib/category-picker.helper";
import { useAssignCategory } from "./use-assign-category";

/**
 * `match-sorter` 기반 0ms 인메모리 카테고리 필터링과 바텀시트 UI 상태를 조율하는 훅입니다.
 *
 * 순수 필터링·낙관적 캐시 계산 로직은 `category-picker.helper.ts`로,
 * 서버 CUD 뮤테이션은 `use-assign-category.ts`로 분리하여 단일 책임을 유지합니다.
 *
 * @returns 피커 열림 상태, 필터링된 카테고리 목록, 검색어 제어, 변경/생성 액션
 */
export function useCategoryPicker() {
  const categoryPickerTarget = useViewStore(
    (state) => state.categoryPickerTarget
  );
  const closeCategoryPicker = useViewStore(
    (state) => state.closeCategoryPicker
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // 바텀시트가 열릴 때 캐시된 활성 카테고리 목록을 0ms로 구독 (staleTime: Infinity로 불필요한 재조회 방지)
  const { data: cachedCategories } = useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: fetchCategoriesListApi,
    enabled: Boolean(categoryPickerTarget),
    staleTime: Infinity,
  });
  const categories = useMemo(
    () => cachedCategories ?? [],
    [cachedCategories]
  );

  const filteredCategories = useMemo(
    () => filterCategoriesByTerm(categories, searchTerm),
    [categories, searchTerm]
  );

  const hasExactNormalizedMatch = useMemo(
    () => hasNormalizedCategoryMatch(categories, searchTerm),
    [categories, searchTerm]
  );

  const assignMutation = useAssignCategory();

  const handleClose = () => {
    setSearchTerm("");
    setValidationError(null);
    closeCategoryPicker();
  };

  const handleSelectCategory = (category: CategoryResponseDto) => {
    if (!categoryPickerTarget) {
      return;
    }
    const { memoId, currentCategoryId } = categoryPickerTarget;
    handleClose();
    if (category.id === currentCategoryId) {
      return;
    }
    assignMutation.mutate({ memoId, targetCategory: category });
  };

  const handleCreateAndAssign = () => {
    if (!categoryPickerTarget) {
      return;
    }
    const parsed = CreateCategorySchema.safeParse({
      id: generateUuidV7(),
      name: searchTerm.trim(),
    });
    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ??
          "카테고리명은 이모지 없이 1~10자로 입력해 주세요."
      );
      return;
    }

    const { memoId } = categoryPickerTarget;
    handleClose();
    assignMutation.mutate({
      memoId,
      targetCategory: {
        id: parsed.data.id,
        name: parsed.data.name,
        memoCount: 1,
      },
      isNew: true,
    });
  };

  return {
    isOpen: Boolean(categoryPickerTarget),
    currentCategoryId: categoryPickerTarget?.currentCategoryId ?? null,
    searchTerm,
    setSearchTerm: (next: string) => {
      setSearchTerm(next);
      if (validationError) {
        setValidationError(null);
      }
    },
    validationError,
    filteredCategories,
    canCreateNew:
      searchTerm.trim().length > 0 && !hasExactNormalizedMatch,
    handleClose,
    handleSelectCategory,
    handleCreateAndAssign,
  };
}
