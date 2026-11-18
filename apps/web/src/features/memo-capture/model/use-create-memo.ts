"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MemoResponseDto } from "@ideamory/api-spec";
import { createMemoApi } from "../../../entities/memo";
import { queryKeys } from "../../../shared/api";
import { useFeedback } from "../../../shared/lib/feedback/use-feedback";
import { generateUuidV7 } from "../../../shared/lib/uuid-v7";
import { useViewStore } from "../../../shared/model/view-store";
import { parseCaptureContent } from "../lib/capture-parser";

interface CreateMemoVariables {
  /** 사용자가 입력한 원본 메모 텍스트 */
  rawContent: string;
}

interface CreateMemoContext {
  previousQueries: Array<[readonly unknown[], MemoResponseDto[] | undefined]>;
}

/**
 * 0.1초 퀵 캡처를 위한 TanStack Query 낙관적 생성(Optimistic UI) 훅입니다.
 *
 * [동작 원리]
 * 1. **UUID v7 클라이언트 선발급**: `generateUuidV7()`로 시간순 정렬이 가능한 ID를 즉시 생성하여
 *    DB B-Tree 인덱스 파편화를 방지하고, 서버 응답 전에도 카드 식별자 충돌 없이 인라인 편집/삭제가 가능하도록 합니다.
 * 2. **0ms 낙관적 삽입**: `onMutate`에서 기존 타임라인 캐시 스냅샷을 백업한 뒤, 현재 활성 타임라인 배열
 *    최상단(`unshift`)에 임시 메모를 즉시 주입합니다.
 * 3. **실패 시 자동 롤백**: API 요청 실패 시 백업해둔 `previousQueries`로 캐시를 복원하고 Toast로 알립니다.
 * 4. **비동기 AI 분류/OGP 동기화**: 저장 직후 및 2.5초 후 캐시를 무효화하여 백그라운드 AI 카테고리 분류와
 *    OGP 링크 카드 결과를 타임라인에 자동 반영합니다.
 *
 * @returns TanStack Query `useMutation` 결과 객체
 */
export function useCreateMemo() {
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();
  const selectedCategoryId = useViewStore((state) => state.selectedCategoryId);
  const viewMode = useViewStore((state) => state.viewMode);

  return useMutation<
    MemoResponseDto,
    unknown,
    CreateMemoVariables,
    CreateMemoContext
  >({
    mutationFn: async ({ rawContent }) => {
      const id = generateUuidV7();
      return createMemoApi({
        id,
        content: rawContent.trim(),
      });
    },
    onMutate: async ({ rawContent }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.memos.all });

      const previousQueries = queryClient.getQueriesData<MemoResponseDto[]>({
        queryKey: queryKeys.memos.all,
      });

      const { categoryHint, displayContent } = parseCaptureContent(rawContent);
      const nowIso = new Date().toISOString();
      const optimisticMemo: MemoResponseDto = {
        id: generateUuidV7(),
        content: displayContent,
        categoryId:
          viewMode === "CATEGORY" && selectedCategoryId
            ? selectedCategoryId
            : "00000000-0000-7000-8000-000000000000",
        categoryName: categoryHint ?? "AI 분류중",
        ogpId: null,
        ogp: null,
        deletedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      queryClient.setQueryData<MemoResponseDto[]>(
        queryKeys.memos.timeline(undefined),
        (old) => [optimisticMemo, ...(old ?? [])]
      );

      if (viewMode === "CATEGORY" && selectedCategoryId) {
        queryClient.setQueryData<MemoResponseDto[]>(
          queryKeys.memos.timeline(selectedCategoryId),
          (old) => [optimisticMemo, ...(old ?? [])]
        );
      }

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
        "메모 저장에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요."
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.memos.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.list(),
      });

      // 백그라운드 Gemini 분류 및 OGP 크롤링 완료 반영을 위한 지연 동기화
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.memos.all });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.categories.list(),
        });
      }, 2500);
    },
  });
}
