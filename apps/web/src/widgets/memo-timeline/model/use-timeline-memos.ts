"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMemosApi } from "../../../entities/memo";
import { queryKeys } from "../../../shared/api";
import { useViewStore } from "../../../shared/model/view-store";

export interface UseTimelineMemosOptions {
  /** 게스트/소셜 인증 부트스트랩 완료 여부 */
  enabled: boolean;
}

/**
 * 현재 뷰 모드(`ALL`, `CATEGORY`, `TRASH`)에 맞춰 메모 타임라인 또는 휴지통 목록을 조회하는 위젯 훅입니다.
 *
 * @param options 부트스트랩 완료 후 쿼리를 활성화하기 위한 옵션
 * @returns TanStack Query `useQuery` 결과 객체
 */
export function useTimelineMemos({ enabled }: UseTimelineMemosOptions) {
  const viewMode = useViewStore((state) => state.viewMode);
  const selectedCategoryId = useViewStore((state) => state.selectedCategoryId);

  const isTrash = viewMode === "TRASH";
  const categoryFilter =
    viewMode === "CATEGORY" && selectedCategoryId
      ? selectedCategoryId
      : undefined;

  return useQuery({
    queryKey: isTrash
      ? queryKeys.memos.trash()
      : queryKeys.memos.timeline(categoryFilter),
    queryFn: () =>
      fetchMemosApi({
        deleted: isTrash,
        categoryId: categoryFilter,
      }),
    enabled,
  });
}
