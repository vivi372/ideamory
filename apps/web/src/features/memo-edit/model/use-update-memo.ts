"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MemoResponseDto } from "@ideamory/api-spec";
import { updateMemoApi } from "../../../entities/memo";
import { queryKeys } from "../../../shared/api";
import { useFeedback } from "../../../shared/lib/feedback/use-feedback";

interface UpdateMemoVariables {
  id: string;
  content: string;
}

interface UpdateMemoContext {
  previousQueries: Array<[readonly unknown[], MemoResponseDto[] | undefined]>;
}

/**
 * 1-Depth 인라인 본문 수정을 위한 TanStack Query 낙관적 갱신(Optimistic Update) 훅입니다.
 *
 * 포커스 아웃(Blur) 또는 `[완료]` 터치 시 서버 응답을 기다리지 않고
 * 타임라인 캐시의 해당 메모 본문을 0ms로 즉시 교체하며, 실패 시 스냅샷으로 롤백합니다.
 *
 * @returns TanStack Query `useMutation` 결과 객체
 */
export function useUpdateMemo() {
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();

  return useMutation<
    MemoResponseDto,
    unknown,
    UpdateMemoVariables,
    UpdateMemoContext
  >({
    mutationFn: ({ id, content }) => updateMemoApi(id, { content }),
    onMutate: async ({ id, content }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.memos.all });

      const previousQueries = queryClient.getQueriesData<MemoResponseDto[]>({
        queryKey: queryKeys.memos.all,
      });

      queryClient.setQueriesData<MemoResponseDto[]>(
        { queryKey: queryKeys.memos.all },
        (old) =>
          old?.map((memo) =>
            memo.id === id
              ? {
                  ...memo,
                  content,
                  updatedAt: new Date().toISOString(),
                }
              : memo
          )
      );

      return { previousQueries };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousQueries) {
        for (const [key, data] of context.previousQueries) {
          queryClient.setQueryData(key, data);
        }
      }
      showToast(
        "error",
        "메모 수정에 실패했습니다. 변경 전 내용으로 되돌렸습니다."
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.memos.all });
    },
  });
}
