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
 * 지식망 상단의 유사도 임계값 슬라이더(0.70~0.85)와 생각 꼬리물기(Breadcrumb) 툴바입니다.
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
            연결 강도 <strong>{threshold.toFixed(2)}</strong>
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
            aria-label="유사도 연결 강도 조절"
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
