"use client";

import { Sparkles } from "lucide-react";

const AI_EXAMPLE_PROMPTS = [
  "이번 주에 저장한 개발 관련 메모 요약해줘",
  "지난번에 적어둔 아이디어 핵심만 정리해줘",
  "최근 기록한 일정이나 할 일 알려줘",
] as const;

export interface AiSearchIdleProps {
  /** 예시 질문 칩 클릭 시 즉시 AI 검색을 실행하는 콜백 */
  onSelectExample: (query: string) => void;
}

/**
 * 썸존 `[AI]` 모드 진입 직후(질문 전송 전) 타임라인 카드 대신 중앙에 표출되는
 * 포커스 안내 화면 및 예시 질문 칩 컴포넌트입니다.
 *
 * 기존 메모 카드 목록을 비워 시각적 노이즈를 제거하고, 사용자가 바로 탭해 볼 수 있는
 * 추천 질의 예시를 제공해 0.1초 만에 AI 브리핑을 시작할 수 있도록 돕습니다.
 *
 * @param props 예시 질문 선택 콜백
 * @returns AI 검색 대기 안내 화면 JSX
 */
export function AiSearchIdle({ onSelectExample }: AiSearchIdleProps) {
  return (
    <section
      className="ai-idle-state"
      aria-label="AI 검색 안내 및 예시 질문"
    >
      <div className="ai-idle-icon" aria-hidden="true">
        <Sparkles size={22} />
      </div>
      <h2 className="ai-idle-title">내 메모에 대해 무엇이든 물어보세요</h2>
      <p className="ai-idle-sub">
        저장해 둔 메모와 링크를 바탕으로 핵심만 1장 브리핑으로 정리해 드려요.
      </p>
      <div className="ai-idle-examples" role="list" aria-label="추천 질문 예시">
        {AI_EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="ai-idle-chip"
            onClick={() => onSelectExample(prompt)}
          >
            <Sparkles size={13} className="shrink-0" aria-hidden="true" />
            <span>{prompt}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
