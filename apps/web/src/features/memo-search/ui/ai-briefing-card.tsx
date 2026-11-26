"use client";

import ReactMarkdown from "react-markdown";
import { Sparkles } from "lucide-react";

export interface AiBriefingCardProps {
  /** 현재 브리핑을 생성한 사용자 질문 원문 */
  query: string;
  /** 백엔드가 반환한 마크다운 요약 (`**1행 결론**` + 불릿 포인트) */
  answer: string;
}

/**
 * 백엔드 3-Stage Hybrid RAG 파이프라인이 생성한 단일 브리핑 마크다운을 렌더링하는 카드입니다.
 *
 * 채팅 말풍선 누적 UI를 배제하고 항상 최신 질문 1건의 결론(`react-markdown`)만
 * 타임라인 최상단 고정 포커스 영역에 표시합니다.
 *
 * @param props 질의 원문 및 마크다운 응답
 * @returns AI 브리핑 카드 JSX
 */
export function AiBriefingCard({ query, answer }: AiBriefingCardProps) {
  return (
    <section className="ai-briefing-card" aria-label="AI 요약 브리핑">
      <div className="ai-briefing-header">
        <span className="ai-briefing-badge">
          <Sparkles size={14} aria-hidden="true" />
          <span>AI 브리핑</span>
        </span>
      </div>
      {query ? <p className="ai-briefing-query">{query}</p> : null}
      <div className="ai-briefing-markdown">
        <ReactMarkdown
          components={{
            a: ({ ...props }) => (
              <a {...props} target="_blank" rel="noopener noreferrer" />
            ),
          }}
        >
          {answer}
        </ReactMarkdown>
      </div>
    </section>
  );
}
