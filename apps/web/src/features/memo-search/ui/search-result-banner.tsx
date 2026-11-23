"use client";

import { Search, X } from "lucide-react";

export interface SearchResultBannerProps {
  /** 현재 실행된 검색 질의어 */
  query: string;
  /** 검색 결과 건수 */
  resultCount: number;
  /** 검색 모드 해제(`[✕]`) 콜백 */
  onClear: () => void;
}

/**
 * 하이브리드 검색 모드 활성화 시 피드 최상단에 검색어와 결과 건수,
 * 그리고 기본 타임라인으로 0ms 복귀하는 `[✕]` 버튼을 제공하는 안내 배너입니다.
 *
 * @param props 검색어, 결과 건수, 해제 콜백
 * @returns 검색 결과 배너 JSX
 */
export function SearchResultBanner({
  query,
  resultCount,
  onClear,
}: SearchResultBannerProps) {
  return (
    <div className="related-filter-banner" role="status" aria-live="polite">
      <span className="search-banner-content">
        <Search size={14} aria-hidden="true" className="search-banner-icon" />
        <span className="search-banner-text">
          &ldquo;{query}&rdquo; 검색 결과 ({resultCount}건)
        </span>
      </span>
      <button
        type="button"
        onClick={onClear}
        aria-label="검색 결과 닫기"
        title="검색 결과 닫기"
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
