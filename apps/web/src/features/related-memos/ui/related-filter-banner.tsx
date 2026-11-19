"use client";

import { X } from "lucide-react";

export interface RelatedFilterBannerProps {
  /** 연관 탐색 기준이 된 원본 메모 본문 */
  sourceContent: string;
  /** 조회된 연관 메모 개수 */
  relatedCount: number;
  /** 연관 필터 해제(`[✕]`) 콜백 */
  onClear: () => void;
}

/**
 * 1-Depth 연관 메모 라이브 필터링 활성화 시 피드 최상단에 노출되는 안내 배너입니다.
 * 기준 메모 앞 15자 요약, 연관 건수 및 원래 타임라인 복귀(`[✕]`) 버튼을 제공합니다.
 *
 * @param props 기준 메모 본문, 연관 건수, 해제 콜백
 * @returns 연관 메모 필터 배너 JSX
 */
export function RelatedFilterBanner({
  sourceContent,
  relatedCount,
  onClear,
}: RelatedFilterBannerProps) {
  const trimmed = sourceContent.trim();
  const preview =
    trimmed.length > 15 ? `${trimmed.slice(0, 15)}...` : trimmed;

  return (
    <div className="related-filter-banner" role="status" aria-live="polite">
      <span className="truncate">
        &ldquo;{preview}&rdquo; 관련 메모 ({relatedCount})
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label="관련 메모 필터 닫기"
        title="관련 메모 필터 닫기"
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
