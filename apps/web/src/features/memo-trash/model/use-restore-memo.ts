"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MemoResponseDto } from "@ideamory/api-spec";
import { restoreMemoApi } from "@/entities/memo";
import { ApiClientError, queryKeys } from "@/shared/api";
import { useFeedback } from "@/shared/lib/feedback/use-feedback";

interface RestoreMemoContext {
  previousTrash: MemoResponseDto[] | undefined;
}

/**
 * 30일 휴지통에 보관 중인 메모를 0ms 낙관적 UI로 원클릭 복구하는 뮤테이션 훅입니다.
 *
 * @returns TanStack Query `useMutation` 결과 객체
 */
export function useRestoreMemo() {
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();

  return useMutation<MemoResponseDto, unknown, string, RestoreMemoContext>({
    mutationFn: (id) => restoreMemoApi(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.memos.trash() });

      const previousTrash = queryClient.getQueryData<MemoResponseDto[]>(
        queryKeys.memos.trash()
      );

      queryClient.setQueryData<MemoResponseDto[]>(
        queryKeys.memos.trash(),
        (old) => old?.filter((memo) => memo.id !== id)
      );

      return { previousTrash };
    },
    onSuccess: () => {
      showToast("info", "메모를 타임라인으로 복구했습니다.");
    },
    onError: (error, _id, context) => {
      if (context?.previousTrash !== undefined) {
        queryClient.setQueryData(
          queryKeys.memos.trash(),
          context.previousTrash
        );
      }
      // 비-FIELD ApiClientError는 response.interceptor.ts에서 이미 전역 dispatchApiError로 발행되므로 중복 토스트 방지
      if (!(error instanceof ApiClientError) || error.uxTag === "FIELD") {
        showToast(
          "error",
          error instanceof ApiClientError
            ? error.message
            : "메모 복구에 실패했습니다. 다시 시도해 주세요."
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
}
