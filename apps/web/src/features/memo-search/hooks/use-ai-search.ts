"use client";

import { useMutation } from "@tanstack/react-query";
import { useFeedbackStore } from "@/shared/lib/feedback/use-feedback";
import { useAiModeStore } from "@/shared/model/ai-mode-store";
import { aiSearchApi } from "../api/ai-search.api";

/**
 * 3-Stage Hybrid RAG AI 질의(`POST /api/v1/memos/ai-search`)를 실행하는 TanStack Query 뮤테이션 훅입니다.
 *
 * 성공 시 `useAiModeStore`의 `setBriefingResult`를 호출해 기존 브리핑을 즉시 교체(Single-Briefing Replace)하며,
 * 요청 도중 사용자가 뒤로가기로 AI 모드를 종료한 경우 늦게 도착한 응답을 무시합니다.
 *
 * @returns `askAi` 실행 함수 및 뮤테이션 상태
 */
export function useAiSearch() {
  const showToast = useFeedbackStore((state) => state.showToast);

  const mutation = useMutation({
    mutationKey: ["ai-search"],
    mutationFn: async (query: string) => {
      const trimmed = query.trim();
      return aiSearchApi({ query: trimmed });
    },
    onMutate: (query) => {
      useAiModeStore.getState().setSearching(true, query.trim());
    },
    onSuccess: (data, query) => {
      const store = useAiModeStore.getState();
      if (!store.isAiMode) {
        return;
      }
      store.setBriefingResult(query.trim(), data);
    },
    onError: () => {
      useAiModeStore.getState().setSearching(false);
      showToast(
        "error",
        "AI 브리핑 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."
      );
    },
  });

  return {
    ...mutation,
    askAi: mutation.mutate,
    askAiAsync: mutation.mutateAsync,
  };
}
