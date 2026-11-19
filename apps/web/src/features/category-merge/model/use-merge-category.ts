"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CategoryResponseDto,
  MemoResponseDto,
  MergeCategoryResponseDto,
  MergeSuggestionResponseDto,
} from "@ideamory/api-spec";
import { ApiClientError, queryKeys } from "../../../shared/api";
import { useFeedback } from "../../../shared/lib/feedback/use-feedback";
import { useViewStore } from "../../../shared/model/view-store";
import {
  dismissMergeSuggestionApi,
  mergeCategoriesApi,
} from "../api/merge.api";

interface MergeActionVariables {
  suggestionId: string;
  sourceCategoryId: string;
  targetCategoryId: string;
  targetCategoryName: string;
}

interface MergeContext {
  previousMemoQueries: Array<[readonly unknown[], MemoResponseDto[] | undefined]>;
  previousCategories: CategoryResponseDto[] | undefined;
  previousSuggestions: MergeSuggestionResponseDto[] | undefined;
}

interface DismissContext {
  previousSuggestions: MergeSuggestionResponseDto[] | undefined;
}

/**
 * AI 유사 카테고리 병합 제안의 `[합치기]` / `[합치지 않기]` 액션을
 * 낙관적 UI(Optimistic UI)로 처리하는 커스텀 훅입니다.
 *
 * - `[합치기]`: 확인 모달 없이 배너와 제안 큐를 즉시 소멸시키고 타임라인 메모의 카테고리 배지를
 *   `targetCategory`로 일괄 전환한 뒤, `POST /api/v1/categories/merge`를 백그라운드 호출합니다.
 * - `[합치지 않기]`: `DELETE /api/v1/categories/merge-suggestions/:id`를 호출하여
 *   배너 및 사이드바 오렌지 닷을 즉시 영구 소멸시킵니다.
 *
 * @returns 병합 실행 및 제안 거절 뮤테이션 핸들러
 */
export function useMergeCategory() {
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();
  const selectedCategoryId = useViewStore((state) => state.selectedCategoryId);
  const setSelectedCategory = useViewStore(
    (state) => state.setSelectedCategory
  );

  const mergeMutation = useMutation<
    MergeCategoryResponseDto,
    unknown,
    MergeActionVariables,
    MergeContext
  >({
    mutationFn: ({ sourceCategoryId, targetCategoryId }) =>
      mergeCategoriesApi({ sourceCategoryId, targetCategoryId }),
    onMutate: async ({
      suggestionId,
      sourceCategoryId,
      targetCategoryId,
      targetCategoryName,
    }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.memos.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.all });

      const previousMemoQueries = queryClient.getQueriesData<MemoResponseDto[]>({
        queryKey: queryKeys.memos.all,
      });
      const previousCategories = queryClient.getQueryData<
        CategoryResponseDto[]
      >(queryKeys.categories.list());
      const previousSuggestions = queryClient.getQueryData<
        MergeSuggestionResponseDto[]
      >(queryKeys.categories.mergeSuggestions());

      queryClient.setQueryData<MergeSuggestionResponseDto[]>(
        queryKeys.categories.mergeSuggestions(),
        (old) =>
          old?.filter(
            (item) =>
              item.id !== suggestionId &&
              item.sourceCategoryId !== sourceCategoryId &&
              item.targetCategoryId !== sourceCategoryId
          )
      );

      queryClient.setQueriesData<MemoResponseDto[]>(
        { queryKey: queryKeys.memos.all },
        (old) =>
          old?.map((memo) =>
            memo.categoryId === sourceCategoryId
              ? {
                  ...memo,
                  categoryId: targetCategoryId,
                  categoryName: targetCategoryName,
                }
              : memo
          )
      );

      queryClient.setQueryData<CategoryResponseDto[]>(
        queryKeys.categories.list(),
        (old) => {
          if (!old) {
            return old;
          }
          const sourceCount =
            old.find((cat) => cat.id === sourceCategoryId)?.memoCount ?? 0;
          return old
            .filter((cat) => cat.id !== sourceCategoryId)
            .map((cat) =>
              cat.id === targetCategoryId
                ? { ...cat, memoCount: (cat.memoCount ?? 0) + sourceCount }
                : cat
            );
        }
      );

      if (selectedCategoryId === sourceCategoryId) {
        setSelectedCategory(targetCategoryId);
      }

      return { previousMemoQueries, previousCategories, previousSuggestions };
    },
    onSuccess: (_data, { targetCategoryName }) => {
      showToast("info", `'${targetCategoryName}' 카테고리로 통합되었습니다.`, 3000);
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
      if (context?.previousSuggestions !== undefined) {
        queryClient.setQueryData(
          queryKeys.categories.mergeSuggestions(),
          context.previousSuggestions
        );
      }
      if (!(error instanceof ApiClientError) || error.uxTag === "FIELD") {
        showToast(
          "error",
          error instanceof ApiClientError
            ? error.message
            : "카테고리 통합에 실패했습니다. 다시 시도해 주세요."
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.memos.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.all,
      });
    },
  });

  const dismissMutation = useMutation<void, unknown, string, DismissContext>({
    mutationFn: (suggestionId) => dismissMergeSuggestionApi(suggestionId),
    onMutate: async (suggestionId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.categories.mergeSuggestions(),
      });

      const previousSuggestions = queryClient.getQueryData<
        MergeSuggestionResponseDto[]
      >(queryKeys.categories.mergeSuggestions());

      queryClient.setQueryData<MergeSuggestionResponseDto[]>(
        queryKeys.categories.mergeSuggestions(),
        (old) => old?.filter((item) => item.id !== suggestionId)
      );

      return { previousSuggestions };
    },
    onError: (error, _suggestionId, context) => {
      if (context?.previousSuggestions !== undefined) {
        queryClient.setQueryData(
          queryKeys.categories.mergeSuggestions(),
          context.previousSuggestions
        );
      }
      if (!(error instanceof ApiClientError) || error.uxTag === "FIELD") {
        showToast(
          "error",
          error instanceof ApiClientError
            ? error.message
            : "제안 숨김 처리에 실패했습니다."
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.mergeSuggestions(),
      });
    },
  });

  return {
    mergeCategories: mergeMutation.mutate,
    dismissSuggestion: dismissMutation.mutate,
    isMerging: mergeMutation.isPending,
    isDismissing: dismissMutation.isPending,
  };
}
