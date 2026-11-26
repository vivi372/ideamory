"use client";

import { Layers, Network } from "lucide-react";
import { useViewModeStore } from "../model/use-view-mode-store";

/**
 * 상단 헤더에서 캐시(타임라인) 모드와 지식망(제텔카스텐) 모드를 전환하는 단일 토글 버튼입니다.
 * 컬러 이모지 대신 단색 Lucide 벡터 아이콘(`Layers` / `Network`)을 사용해 Warm Dark 톤과 일체화합니다.
 */
export function ViewModeToggle() {
  const displayMode = useViewModeStore((state) => state.displayMode);
  const setDisplayMode = useViewModeStore((state) => state.setDisplayMode);

  const isGraph = displayMode === "GRAPH";
  const nextMode = isGraph ? "CACHE" : "GRAPH";
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
      {isGraph ? (
        <Layers size={13} strokeWidth={2.1} aria-hidden="true" className="shrink-0" />
      ) : (
        <Network size={13} strokeWidth={2.1} aria-hidden="true" className="shrink-0" />
      )}
      <span className="view-mode-label">{nextLabel}</span>
    </button>
  );
}
