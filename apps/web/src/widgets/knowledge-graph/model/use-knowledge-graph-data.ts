"use client";

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { RelatedMemoResponseDto } from "@ideamory/api-spec";
import { buildKnowledgeGraphData, fetchMemosApi } from "@/entities/memo";
import { fetchRelatedMemosApi } from "@/features/related-memos";
import { queryKeys } from "@/shared/api";

const GRAPH_FETCH_THRESHOLD = 0.6;
const GRAPH_FETCH_LIMIT = 30;

export interface UseKnowledgeGraphDataOptions {
  enabled: boolean;
  threshold: number;
}

/**
 * 기존 타임라인 메모 목록과 유사도 0.70 기반 연관 메모 캐시를 조합하여
 * 슬라이더 임계값 조절 시 0ms 클라이언트 필터링으로 지식망 데이터를 제공합니다.
 */
export function useKnowledgeGraphData({
  enabled,
  threshold,
}: UseKnowledgeGraphDataOptions) {
  const memosQuery = useQuery({
    queryKey: queryKeys.memos.timeline(undefined),
    queryFn: () => fetchMemosApi(),
    enabled,
  });

  const activeMemos = useMemo(
    () => (memosQuery.data ?? []).filter((memo) => !memo.deletedAt),
    [memosQuery.data],
  );

  const relatedQueries = useQueries({
    queries: activeMemos.map((memo) => ({
      queryKey: [
        ...queryKeys.memos.related(memo.id),
        { threshold: GRAPH_FETCH_THRESHOLD, limit: GRAPH_FETCH_LIMIT },
      ] as const,
      queryFn: () =>
        fetchRelatedMemosApi(memo.id, {
          threshold: GRAPH_FETCH_THRESHOLD,
          limit: GRAPH_FETCH_LIMIT,
        }),
      enabled: enabled && activeMemos.length > 0,
      staleTime: 60_000,
    })),
  });

  const relatedByMemoId = useMemo(() => {
    const map = new Map<string, readonly RelatedMemoResponseDto[]>();
    activeMemos.forEach((memo, index) => {
      const data = relatedQueries[index]?.data;
      if (data) {
        map.set(memo.id, data);
      }
    });
    return map;
  }, [activeMemos, relatedQueries]);

  const graphData = useMemo(
    () => buildKnowledgeGraphData(activeMemos, relatedByMemoId, threshold),
    [activeMemos, relatedByMemoId, threshold],
  );

  const memoById = useMemo(
    () => new Map(activeMemos.map((memo) => [memo.id, memo])),
    [activeMemos],
  );

  const labelById = useMemo(
    () => new Map(graphData.nodes.map((node) => [node.id, node.label])),
    [graphData.nodes],
  );

  const isLoading =
    memosQuery.isLoading ||
    (activeMemos.length > 0 &&
      relatedQueries.every((query) => query.isLoading));

  const isSyncingLinks = relatedQueries.some((query) => query.isFetching);

  return {
    graphData,
    memoById,
    labelById,
    isLoading,
    isSyncingLinks,
  };
}
