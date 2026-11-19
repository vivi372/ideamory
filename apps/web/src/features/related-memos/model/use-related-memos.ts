"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/shared/api";
import { useViewStore } from "@/shared/model/view-store";
import { fetchRelatedMemosApi } from "../api/related.api";

export interface UseRelatedMemosOptions {
  /** 게스트/소셜 세션 부트스트랩 완료 여부 */
  enabled: boolean;
}

/**
 * 특정 메모의 `관련 메모` 칩 클릭 시 활성화되는 1-Depth 연관 메모 라이브 필터 훅입니다.
 *
 * `relatedFilterMemoId`가 설정된 경우에만 `GET /api/v1/memos/:id/related` (코사인 유사도 >= 0.8)를
 * 조회하여 별도의 상세 페이지 이동 없이 메인 타임라인을 연관 메모 묶음으로 즉시 전환합니다.
 *
 * @param options 부트스트랩 완료 후 쿼리를 활성화하기 위한 옵션
 * @returns 연관 메모 조회 결과, 기준 메모 ID 및 필터 설정/해제 함수
 */
export function useRelatedMemos({ enabled }: UseRelatedMemosOptions) {
  const relatedFilterMemoId = useViewStore(
    (state) => state.relatedFilterMemoId
  );
  const setRelatedFilterMemo = useViewStore(
    (state) => state.setRelatedFilterMemo
  );
  const isRelatedActive = Boolean(relatedFilterMemoId);

  const query = useQuery({
    queryKey: queryKeys.memos.related(relatedFilterMemoId ?? "none"),
    queryFn: () =>
      fetchRelatedMemosApi(relatedFilterMemoId!, {
        threshold: 0.8,
        limit: 10,
      }),
    enabled: enabled && isRelatedActive,
  });

  return {
    ...query,
    relatedFilterMemoId,
    isRelatedActive,
    openRelatedFilter: (memoId: string) => setRelatedFilterMemo(memoId),
    clearRelatedFilter: () => setRelatedFilterMemo(null),
  };
}
