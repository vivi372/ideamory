"use client";

import { useViewModeStore, type DisplayMode } from "../model/use-view-mode-store";

const MODE_OPTIONS: ReadonlyArray<{
  mode: DisplayMode;
  emoji: string;
  label: string;
}> = [
  { mode: "CACHE", emoji: "🗂️", label: "캐시" },
  { mode: "GRAPH", emoji: "🕸️", label: "지식망" },
];

/**
 * 상단 헤더에서 캐시(타임라인) 모드와 지식망(제텔카스텐) 모드를 전환하는 세그먼트 토글입니다.
 */
export function ViewModeToggle() {
  const displayMode = useViewModeStore((state) => state.displayMode);
  const setDisplayMode = useViewModeStore((state) => state.setDisplayMode);

  return (
    <div
      className="view-mode-toggle"
      role="tablist"
      aria-label="보기 모드 전환"
    >
      {MODE_OPTIONS.map((option) => {
        const isActive = displayMode === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`view-mode-btn${isActive ? " is-active" : ""}`}
            onClick={() => setDisplayMode(option.mode)}
          >
            <span className="view-mode-emoji" aria-hidden="true">
              {option.emoji}
            </span>
            <span className="view-mode-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
