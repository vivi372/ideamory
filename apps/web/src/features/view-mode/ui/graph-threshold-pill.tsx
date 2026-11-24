"use client";

import {
  MAX_GRAPH_THRESHOLD,
  MIN_GRAPH_THRESHOLD,
  useViewModeStore,
} from "../model/use-view-mode-store";

/**
 * 내부 유사도 임계값(0.60~0.85)을 사용자 친화적인 연결 범위 라벨로 변환합니다.
 */
function formatThresholdLabel(threshold: number): string {
  if (threshold <= 0.7) {
    return "넓게";
  }
  if (threshold >= 0.82) {
    return "핵심만";
  }
  return "보통";
}

/**
 * 지식망 모드 최상단 플로팅 바 중앙에 배치되는 연결 범위 조절 버블입니다.
 * `graph-floating-top` Flexbox 행 내부에 배치되어 좌우 버튼과 겹치지 않습니다.
 */
export function GraphThresholdPill() {
  const threshold = useViewModeStore((state) => state.threshold);
  const setThreshold = useViewModeStore((state) => state.setThreshold);

  return (
    <div className="graph-threshold-pill">
      <label className="graph-threshold-control">
        <span className="graph-threshold-label">
          연결 <strong>{formatThresholdLabel(threshold)}</strong>
        </span>
        <input
          type="range"
          min={MIN_GRAPH_THRESHOLD}
          max={MAX_GRAPH_THRESHOLD}
          step={0.01}
          value={threshold}
          onChange={(event) =>
            setThreshold(Number.parseFloat(event.target.value))
          }
          className="graph-threshold-slider"
          aria-label="지식망 연결 범위 조절"
        />
      </label>
    </div>
  );
}
