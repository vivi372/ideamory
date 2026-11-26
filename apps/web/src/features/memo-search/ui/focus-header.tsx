"use client";

import { ArrowLeft, Sparkles } from "lucide-react";

export interface FocusHeaderProps {
  /** 포커스 헤더 좌측 뒤로가기 화살표 클릭 콜백 (0ms 타임라인 복귀) */
  onBack: () => void;
}

/**
 * AI 질의 모드 활성화 시 기존 상단 바(버거 메뉴·로고·검색바·모드 토글)와 모핑으로 교체되는
 * 단일 포커스 헤더 컴포넌트입니다.
 *
 * 좌측 뒤로가기 화살표 아이콘과 중앙 `"AI 검색"` 타이틀만 배치하여 시각적 노이즈를 차단합니다.
 *
 * @param props 뒤로가기 콜백
 * @returns 포커스 헤더 JSX
 */
export function FocusHeader({ onBack }: FocusHeaderProps) {
  return (
    <header className="topbar ai-focus-header" aria-label="AI 검색 포커스 헤더">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-button ai-focus-back-btn"
          onClick={onBack}
          aria-label="타임라인으로 돌아가기"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="ai-focus-title">
        <Sparkles className="h-4 w-4 text-[var(--color-accent)]" aria-hidden="true" />
        <span>AI 검색</span>
      </div>
      <div className="topbar-right" aria-hidden="true" />
    </header>
  );
}
