"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RelatedMemoResponseDto } from "@ideamory/api-spec";
import { buildKnowledgeGraphData, fetchMemosApi } from "@/entities/memo";
import { fetchRelatedMemosApi } from "@/features/related-memos";
import { queryKeys } from "@/shared/api";

const GRAPH_FETCH_THRESHOLD = 0.6;
const GRAPH_FETCH_LIMIT = 30;
const MAX_CONCURRENT_RELATED_REQUESTS = 5;

export interface UseKnowledgeGraphDataOptions {
  enabled: boolean;
  threshold: number;
}

/**
 * 기존 타임라인 메모 목록과 유사도 0.60 기반 연관 메모 캐시를 조합하여
 * 슬라이더 임계값 조절 시 0ms 클라이언트 필터링으로 지식망 데이터를 제공합니다.
 *
 * `aiStatus === "COMPLETED"` 메모만 대상으로 삼고, `queryClient.fetchQuery`를
 * 최대 5개 동시성 제한(Bounded Concurrency Pool)으로 실행해 대량 메모 환경에서의
 * 브라우저 커넥션 포화 및 API 부하를 방지합니다.
 */
export function useKnowledgeGraphData({
  enabled,
  threshold,
}: UseKnowledgeGraphDataOptions) {
  const queryClient = useQueryClient();
  const [relatedByMemoId, setRelatedByMemoId] = useState<
    ReadonlyMap<string, readonly RelatedMemoResponseDto[]>
  >(() => new Map());
  const [isSyncingLinks, setIsSyncingLinks] = useState(false);

  const memosQuery = useQuery({
    queryKey: queryKeys.memos.timeline(undefined),
    queryFn: () => fetchMemosApi(),
    enabled,
  });

  const activeMemos = useMemo(
    () => (memosQuery.data ?? []).filter((memo) => !memo.deletedAt),
    [memosQuery.data],
  );

  const completedMemos = useMemo(
    () => activeMemos.filter((memo) => memo.aiStatus === "COMPLETED"),
    [activeMemos],
  );

  const completedMemoIdsKey = useMemo(
    () => completedMemos.map((memo) => memo.id).join(","),
    [completedMemos],
  );

  useEffect(() => {
    if (!enabled || completedMemos.length === 0) {
      setIsSyncingLinks(false);
      if (completedMemos.length === 0) {
        setRelatedByMemoId(new Map());
      }
      return;
    }

    let cancelled = false;
    setIsSyncingLinks(true);

    const nextMap = new Map<string, readonly RelatedMemoResponseDto[]>();
    let cursor = 0;

    const runWorker = async () => {
      while (!cancelled && cursor < completedMemos.length) {
        const index = cursor;
        cursor += 1;
        const memo = completedMemos[index];
        if (!memo) {
          continue;
        }

        try {
          const data = await queryClient.fetchQuery({
            queryKey: [
              ...queryKeys.memos.related(memo.id),
              { threshold: GRAPH_FETCH_THRESHOLD, limit: GRAPH_FETCH_LIMIT },
            ] as const,
            queryFn: () =>
              fetchRelatedMemosApi(memo.id, {
                threshold: GRAPH_FETCH_THRESHOLD,
                limit: GRAPH_FETCH_LIMIT,
              }),
            staleTime: 60_000,
          });
          if (!cancelled) {
            nextMap.set(memo.id, data);
          }
        } catch {
          // 개별 메모 연관 조회 실패 시 나머지 그래프 렌더링을 중단하지 않음
        }
      }
    };

    const workerCount = Math.min(
      MAX_CONCURRENT_RELATED_REQUESTS,
      completedMemos.length,
    );

    void Promise.all(Array.from({ length: workerCount }, () => runWorker())).then(
      () => {
        if (!cancelled) {
          setRelatedByMemoId(new Map(nextMap));
          setIsSyncingLinks(false);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [completedMemoIdsKey, completedMemos, enabled, queryClient]);

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

  const isLoading = memosQuery.isLoading;

  return {
    graphData,
    memoById,
    labelById,
    isLoading,
    isSyncingLinks,
  };
}
