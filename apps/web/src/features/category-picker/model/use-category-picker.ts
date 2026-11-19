"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { matchSorter } from "match-sorter";
import {
  CreateCategorySchema,
  type CategoryResponseDto,
  type MemoResponseDto,
} from "@ideamory/api-spec";
import { updateMemoApi } from "../../../entities/memo";
import { ApiClientError, queryKeys } from "../../../shared/api";
import { useFeedback } from "../../../shared/lib/feedback/use-feedback";
import { generateUuidV7 } from "../../../shared/lib/uuid-v7";
import { useViewStore } from "../../../shared/model/view-store";
import {
  createCategoryApi,
  fetchCategoriesListApi,
} from "../api/category.api";

interface AssignCategoryVariables {
  memoId: string;
  targetCategory: CategoryResponseDto;
  isNew?: boolean;
}

interface AssignCategoryContext {
  previousMemoQueries: Array<[readonly unknown[], MemoResponseDto[] | undefined]>;
  previousCategories: CategoryResponseDto[] | undefined;
}

/**
 * `match-sorter` 기반 0ms 인메모리 카테고리 필터링 및 낙관적 카테고리 변경/신규 생성을
 * 수행하는 커스텀 훅입니다.
 *
 * [Zero-Token & Zero-Friction 원칙]
 * - 카테고리 검색 입력 중 백엔드 API를 전혀 호출하지 않고 이미 캐시된 활성 카테고리 목록을
 *   `match-sorter`로 0ms 필터링합니다.
 * - 기존 카테고리 선택 시 확인 모달 없이 타임라인 카드 배지를 낙관적으로 즉시 교체하고,
 *   일치하는 카테고리가 없을 경우 `CreateCategorySchema`(1~10자, 이모지 배제) 검증 후
 *   즉석 생성 및 매핑합니다.
 *
 * @returns 피커 열림 상태, 필터링된 카테고리 목록, 검색어 제어, 변경/생성 액션
 */
export function useCategoryPicker() {
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();

  const categoryPickerTarget = useViewStore(
    (state) => state.categoryPickerTarget
  );
  const closeCategoryPicker = useViewStore(
    (state) => state.closeCategoryPicker
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

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

  const filteredCategories = useMemo(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      return categories;
    }
    return matchSorter(categories, trimmed, { keys: ["name"] });
  }, [categories, searchTerm]);

  const normalizedInput = searchTerm.replace(/\s+/g, "").toLowerCase();
  const hasExactNormalizedMatch = useMemo(
    () =>
      normalizedInput.length > 0 &&
      categories.some(
        (cat) => cat.name.replace(/\s+/g, "").toLowerCase() === normalizedInput
      ),
    [categories, normalizedInput]
  );

  const assignMutation = useMutation<
    MemoResponseDto,
    unknown,
    AssignCategoryVariables,
    AssignCategoryContext
  >({
    mutationFn: async ({ memoId, targetCategory, isNew }) => {
      if (isNew) {
        const created = await createCategoryApi({
          id: targetCategory.id,
          name: targetCategory.name,
        });
        return updateMemoApi(memoId, { categoryId: created.id });
      }
      return updateMemoApi(memoId, { categoryId: targetCategory.id });
    },
    onMutate: async ({ memoId, targetCategory }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.memos.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.list() });

      const previousMemoQueries = queryClient.getQueriesData<MemoResponseDto[]>({
        queryKey: queryKeys.memos.all,
      });
      const previousCategories = queryClient.getQueryData<
        CategoryResponseDto[]
      >(queryKeys.categories.list());

      let sourceCategoryId: string | null = null;
      queryClient.setQueriesData<MemoResponseDto[]>(
        { queryKey: queryKeys.memos.all },
        (old) =>
          old?.map((memo) => {
            if (memo.id === memoId) {
              sourceCategoryId = memo.categoryId;
              return {
                ...memo,
                categoryId: targetCategory.id,
                categoryName: targetCategory.name,
              };
            }
            return memo;
          })
      );

      queryClient.setQueryData<CategoryResponseDto[]>(
        queryKeys.categories.list(),
        (old) => {
          if (!old) {
            return old;
          }
          const exists = old.some((cat) => cat.id === targetCategory.id);
          const adjusted = old
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
      );

      return { previousMemoQueries, previousCategories };
    },
    onError: (error, _variables, context) => {
      if (context?.previousMemoQueries) {
        for (const [key, data] of context.previousMemoQueries) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.previousCategories !== undefined) {
        queryClient.setQueryData(
          queryKeys.categories.list(),
          context.previousCategories
        );
      }
      if (!(error instanceof ApiClientError) || error.uxTag === "FIELD") {
        showToast(
          "error",
          error instanceof ApiClientError
            ? error.message
            : "카테고리 변경에 실패했습니다. 다시 시도해 주세요."
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.memos.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.list(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.mergeSuggestions(),
      });
    },
  });

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
    const trimmed = searchTerm.trim();
    const newId = generateUuidV7();
    const parsed = CreateCategorySchema.safeParse({
      id: newId,
      name: trimmed,
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
