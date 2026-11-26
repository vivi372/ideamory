"use client";

import { Sparkles } from "lucide-react";

export interface AiSearchSkeletonProps {
  /** 현재 로딩 중인 사용자 질문 원문 */
  query?: string;
}

/**
 * AI 브리핑 응답을 대기하는 동안 기존 타임라인 영역을 대체해 보여주는 스켈레톤 카드입니다.
 *
 * @param props 현재 요청 중인 질의어
 * @returns 스켈레톤 로딩 UI JSX
 */
export function AiSearchSkeleton({ query }: AiSearchSkeletonProps) {
  return (
    <section
      className="ai-briefing-card ai-search-skeleton"
      aria-live="polite"
      aria-busy="true"
      aria-label="AI 브리핑 생성 중"
    >
      <div className="ai-briefing-header">
        <span className="ai-briefing-badge">
          <Sparkles size={14} className="ai-pulse-icon" aria-hidden="true" />
          <span>AI 브리핑 생성 중...</span>
        </span>
      </div>
      {query ? (
        <p className="ai-briefing-query" title={query}>
          {query}
        </p>
      ) : null}
      <div className="ai-skeleton-lines">
        <div className="ai-skeleton-line ai-skeleton-line-lg" />
        <div className="ai-skeleton-line ai-skeleton-line-md" />
        <div className="ai-skeleton-line ai-skeleton-line-sm" />
      </div>
    </section>
  );
}
