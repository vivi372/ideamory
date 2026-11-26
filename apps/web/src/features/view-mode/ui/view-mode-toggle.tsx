"use client";

import { useViewModeStore } from "../model/use-view-mode-store";

/**
 * 상단 헤더에서 캐시(타임라인) 모드와 지식망(제텔카스텐) 모드를 전환하는 단일 토글 버튼입니다.
 * 현재 모드의 반대 모드를 안내하여 1-Click으로 즉시 전환합니다.
 */
export function ViewModeToggle() {
  const displayMode = useViewModeStore((state) => state.displayMode);
  const setDisplayMode = useViewModeStore((state) => state.setDisplayMode);

  const isGraph = displayMode === "GRAPH";
  const nextMode = isGraph ? "CACHE" : "GRAPH";
  const nextEmoji = isGraph ? "🗂️" : "🕸️";
  const nextLabel = isGraph ? "캐시" : "지식망";
  const actionLabel = isGraph ? "캐시 모드로 전환" : "지식망 모드로 전환";

  return (
    <button
      type="button"
      className={`view-mode-single-btn${isGraph ? " is-graph" : ""}`}
      aria-label={actionLabel}
      title={actionLabel}
      onClick={() => setDisplayMode(nextMode)}
    >
      <span className="view-mode-emoji" aria-hidden="true">
        {nextEmoji}
      </span>
      <span className="view-mode-label">{nextLabel}</span>
    </button>
  );
}
