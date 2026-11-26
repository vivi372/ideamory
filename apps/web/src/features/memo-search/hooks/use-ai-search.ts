"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useFeedbackStore } from "@/shared/lib/feedback/use-feedback";
import { useAiModeStore } from "@/shared/model/ai-mode-store";
import { aiSearchApi } from "../api/ai-search.api";

/**
 * 3-Stage Hybrid RAG AI 질의(`POST /api/v1/memos/ai-search`)를 실행하는 TanStack Query 뮤테이션 훅입니다.
 *
 * - 응답 대기(`isSearching`) 중 중복 질의 전송을 차단하고, 사용자가 중단(Stop) 버튼으로
 *   `AbortController.abort()`를 호출한 뒤에만 다음 질문을 전송할 수 있도록 제어합니다.
 * - 요청 시퀀스(`requestSeqRef`) 검증으로 지연 도착한 이전 응답이 최신 결과를 덮어쓰지 않도록 방어합니다.
 *
 * @returns `askAi`, `cancelAiSearch` 및 뮤테이션 상태
 */
export function useAiSearch() {
  const showToast = useFeedbackStore((state) => state.showToast);
  const isAiMode = useAiModeStore((state) => state.isAiMode);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const cancelAiSearch = useCallback(() => {
    requestSeqRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    useAiModeStore.getState().setSearching(false);
  }, []);

  useEffect(() => {
    if (!isAiMode) {
      cancelAiSearch();
    }
  }, [isAiMode, cancelAiSearch]);

  const mutation = useMutation<
    Awaited<ReturnType<typeof aiSearchApi>>,
    unknown,
    { query: string; seq: number }
  >({
    mutationKey: ["ai-search"],
    mutationFn: async ({ query }) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
        return await aiSearchApi({ query }, controller.signal);
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    onSuccess: (data, variables) => {
      const store = useAiModeStore.getState();
      if (!store.isAiMode || variables.seq !== requestSeqRef.current) {
        return;
      }
      store.setBriefingResult(variables.query, data);
    },
    onError: (error, variables) => {
      if (variables.seq !== requestSeqRef.current) {
        return;
      }
      useAiModeStore.getState().setSearching(false);
      if (
        axios.isCancel(error) ||
        (error instanceof Error &&
          (error.name === "AbortError" || error.name === "CanceledError"))
      ) {
        return;
      }
      showToast(
        "error",
        "AI 브리핑 생성에 실패했습니다. 잠시 후 다시 시도해 주세요."
      );
    },
  });

  const askAi = useCallback(
    (rawQuery: string) => {
      const trimmed = rawQuery.trim();
      const store = useAiModeStore.getState();
      if (!trimmed || store.isSearching) {
        return;
      }
      const nextSeq = requestSeqRef.current + 1;
      requestSeqRef.current = nextSeq;
      store.setSearching(true, trimmed);
      mutation.mutate({ query: trimmed, seq: nextSeq });
    },
    [mutation]
  );

  return {
    ...mutation,
    askAi,
    cancelAiSearch,
  };
}
