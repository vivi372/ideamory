"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CategoryResponseDto, MemoResponseDto } from "@ideamory/api-spec";
import { softDeleteMemoApi } from "../../../entities/memo";
import { ApiClientError, queryKeys } from "../../../shared/api";
import { useFeedback } from "../../../shared/lib/feedback/use-feedback";
import { useViewStore } from "../../../shared/model/view-store";

interface SoftDeleteVariables {
  id: string;
  categoryId: string;
}

interface SoftDeleteContext {
  previousMemoQueries: Array<[readonly unknown[], MemoResponseDto[] | undefined]>;
  previousCategories: CategoryResponseDto[] | undefined;
}

/**
 * 확인 팝업 없이 0ms 즉시 카드를 타임라인에서 제거하는 Soft Delete 뮤테이션 훅입니다.
 *
 * 활성 메모가 0건이 된 카테고리는 Zero-Friction 원칙에 따라 사이드바 목록에서
 * 즉시 자동 숨김 처리되며, 현재 선택된 카테고리가 비게 되면 전체 메모 뷰로 안전하게 복귀합니다.
 *
 * @returns TanStack Query `useMutation` 결과 객체
 */
export function useSoftDeleteMemo() {
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();
  const selectedCategoryId = useViewStore((state) => state.selectedCategoryId);
  const setViewMode = useViewStore((state) => state.setViewMode);

  return useMutation<void, unknown, SoftDeleteVariables, SoftDeleteContext>({
    mutationFn: ({ id }) => softDeleteMemoApi(id),
    onMutate: async ({ id, categoryId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.memos.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.list() });

      const previousMemoQueries = queryClient.getQueriesData<MemoResponseDto[]>({
        queryKey: queryKeys.memos.all,
      });
      const previousCategories = queryClient.getQueryData<
        CategoryResponseDto[]
      >(queryKeys.categories.list());

      queryClient.setQueriesData<MemoResponseDto[]>(
        { queryKey: queryKeys.memos.all },
        (old) => old?.filter((memo) => memo.id !== id)
      );

      let emptiedSelectedCategory = false;
      queryClient.setQueryData<CategoryResponseDto[]>(
        queryKeys.categories.list(),
        (old) => {
          if (!old) {
            return old;
          }
          const updated = old
            .map((cat) =>
              cat.id === categoryId
                ? { ...cat, memoCount: Math.max(0, (cat.memoCount ?? 1) - 1) }
                : cat
            )
            .filter((cat) => (cat.memoCount ?? 0) > 0);

          if (
            selectedCategoryId === categoryId &&
            !updated.some((cat) => cat.id === categoryId)
          ) {
            emptiedSelectedCategory = true;
          }
          return updated;
        }
      );

      if (emptiedSelectedCategory) {
        setViewMode("ALL");
      }

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
      // 비-FIELD ApiClientError는 response.interceptor.ts에서 이미 전역 dispatchApiError로 발행되므로 중복 토스트 방지
      if (!(error instanceof ApiClientError) || error.uxTag === "FIELD") {
        showToast(
          "error",
          error instanceof ApiClientError
            ? error.message
            : "메모 삭제에 실패했습니다. 다시 시도해 주세요."
        );
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.memos.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.list(),
      });
    },
  });
}
