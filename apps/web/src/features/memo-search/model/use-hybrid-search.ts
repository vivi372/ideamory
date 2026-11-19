"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/api";
import { useViewStore } from "../../../shared/model/view-store";
import { searchMemosApi } from "../api/search.api";

export interface UseHybridSearchOptions {
  /** 게스트/소셜 세션 부트스트랩 완료 여부 */
  enabled: boolean;
}

/**
 * 명시적 실행 기반 하이브리드 검색(FTS 0.4 + Vector 0.6) TanStack Query 훅입니다.
 *
 * 전역 스토어(`useViewStore`)의 `searchQuery`가 비어 있지 않을 때만 쿼리를 활성화하여,
 * 검색창 입력 도중 타임라인 피드가 실시간으로 흔들리거나 불필요한 임베딩 API 비용이
 * 발생하는 것을 원천 차단합니다.
 *
 * @param options 부트스트랩 완료 후 쿼리를 활성화하기 위한 옵션
 * @returns 하이브리드 검색 결과, 로딩 상태, 활성 검색어 및 해제 함수
 */
export function useHybridSearch({ enabled }: UseHybridSearchOptions) {
  const searchQuery = useViewStore((state) => state.searchQuery);
  const clearSearch = useViewStore((state) => state.clearSearch);
  const trimmedQuery = searchQuery.trim();
  const isSearchActive = trimmedQuery.length > 0;

  const query = useQuery({
    queryKey: queryKeys.memos.search(trimmedQuery),
    queryFn: () => searchMemosApi({ q: trimmedQuery, limit: 30 }),
    enabled: enabled && isSearchActive,
  });

  return {
    ...query,
    searchQuery: trimmedQuery,
    isSearchActive,
    clearSearch,
  };
}
