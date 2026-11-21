"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MemoResponseDto } from "@ideamory/api-spec";
import { fetchMemosApi } from "@/entities/memo";
import { queryKeys } from "@/shared/api";
import { useViewStore } from "@/shared/model/view-store";

/** 백그라운드 AI 분류(`PENDING`) 대기 메모 존재 시 폴링 주기 (1.5초) */
const PENDING_AI_POLL_INTERVAL_MS = 1500;

export interface UseTimelineMemosOptions {
  /** 게스트/소셜 인증 부트스트랩 완료 여부 */
  enabled: boolean;
}

/**
 * 현재 뷰 모드(`ALL`, `CATEGORY`, `TRASH`)에 맞춰 메모 타임라인 또는 휴지통 목록을 조회하는 위젯 훅입니다.
 *
 * [비동기 AI 분류 실시간 반영]
 * 타임라인에 `aiStatus === "PENDING"` 상태인 메모가 1건이라도 존재하면 1.5초 간격으로 백그라운드 폴링을 수행하고,
 * 모든 메모가 `COMPLETED` 또는 `FAILED`로 전환되면 폴링을 즉시 중단함과 동시에 사이드바 카테고리 목록 및
 * 유사 카테고리 병합 제안 큐를 자동 갱신하여 새로고침 없이도 분류 결과가 즉시 반영되도록 보장합니다.
 *
 * @param options 부트스트랩 완료 후 쿼리를 활성화하기 위한 옵션
 * @returns TanStack Query `useQuery` 결과 객체
 */
export function useTimelineMemos({ enabled }: UseTimelineMemosOptions) {
  const queryClient = useQueryClient();
  const viewMode = useViewStore((state) => state.viewMode);
  const selectedCategoryId = useViewStore((state) => state.selectedCategoryId);

  const isTrash = viewMode === "TRASH";
  const categoryFilter =
    viewMode === "CATEGORY" && selectedCategoryId
      ? selectedCategoryId
      : undefined;

  const query = useQuery({
    queryKey: isTrash
      ? queryKeys.memos.trash()
      : queryKeys.memos.timeline(categoryFilter),
    queryFn: () =>
      fetchMemosApi({
        deleted: isTrash,
        categoryId: categoryFilter,
      }),
    enabled,
    refetchInterval: (q) => {
      const list = q.state.data as MemoResponseDto[] | undefined;
      if (!list || list.length === 0) {
        return false;
      }
      const hasPending = list.some((memo) => memo.aiStatus === "PENDING");
      return hasPending ? PENDING_AI_POLL_INTERVAL_MS : false;
    },
  });

  const pendingCount = (query.data ?? []).filter(
    (memo) => memo.aiStatus === "PENDING"
  ).length;
  const prevPendingCountRef = useRef(0);

  useEffect(() => {
    // PENDING 메모 개수가 감소(= 백그라운드 AI 분류 완료)한 순간 사이드바 카테고리 및 병합 제안 목록 동기화
    if (
      prevPendingCountRef.current > 0 &&
      pendingCount < prevPendingCountRef.current
    ) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.all,
      });
    }
    prevPendingCountRef.current = pendingCount;
  }, [pendingCount, queryClient]);

  return query;
}
