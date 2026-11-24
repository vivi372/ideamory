"use client";

import {
  MAX_GRAPH_THRESHOLD,
  MIN_GRAPH_THRESHOLD,
  useViewModeStore,
} from "@/features/view-mode";

export interface GraphToolbarProps {
  nodeCount: number;
  linkCount: number;
  labelById: ReadonlyMap<string, string>;
}

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
 * 지식망 상단의 연결 범위 슬라이더와 생각 꼬리물기(Breadcrumb) 툴바입니다.
 */
export function GraphToolbar({
  nodeCount,
  linkCount,
  labelById,
}: GraphToolbarProps) {
  const threshold = useViewModeStore((state) => state.threshold);
  const breadcrumb = useViewModeStore((state) => state.breadcrumb);
  const focusedNodeId = useViewModeStore((state) => state.focusedNodeId);
  const setThreshold = useViewModeStore((state) => state.setThreshold);
  const navigateBreadcrumb = useViewModeStore(
    (state) => state.navigateBreadcrumb,
  );
  const clearFocus = useViewModeStore((state) => state.clearFocus);

  return (
    <div className="graph-toolbar" aria-label="지식망 제어 툴바">
      <div className="graph-toolbar-row">
        <label className="graph-threshold-control">
          <span className="graph-threshold-label">
            연결 범위 <strong>{formatThresholdLabel(threshold)}</strong>
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

        <span className="graph-stats-pill">
          메모 {nodeCount} · 연결 {linkCount}
        </span>
      </div>

      {breadcrumb.length > 0 && (
        <nav className="graph-breadcrumb" aria-label="생각 꼬리물기 경로">
          {breadcrumb.map((id, index) => {
            const isCurrent = id === focusedNodeId;
            const label = labelById.get(id) ?? "메모";
            return (
              <span key={id} className="graph-breadcrumb-item">
                {index > 0 && (
                  <span className="graph-breadcrumb-sep" aria-hidden="true">
                    ➔
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => navigateBreadcrumb(id)}
                  className={`graph-breadcrumb-chip${isCurrent ? " is-current" : ""}`}
                >
                  {label}
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={clearFocus}
            className="graph-breadcrumb-clear"
            aria-label="포커스 해제"
          >
            초기화
          </button>
        </nav>
      )}
    </div>
  );
}
