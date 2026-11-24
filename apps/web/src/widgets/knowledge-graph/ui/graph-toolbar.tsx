"use client";

import { useViewModeStore } from "@/features/view-mode";

export interface GraphToolbarProps {
  nodeCount: number;
  linkCount: number;
  labelById: ReadonlyMap<string, string>;
}

/**
 * 지식망 상단의 생각 꼬리물기(Breadcrumb) 툴바입니다.
 * 연결 범위 슬라이더는 최상단 플로팅 바(`.graph-floating-top`)로 통합되어 있으며,
 * 노드를 탐색해 꼬리물기 경로가 쌓일 때만 상단 바 아래에 표시됩니다.
 */
export function GraphToolbar({ labelById }: GraphToolbarProps) {
  const breadcrumb = useViewModeStore((state) => state.breadcrumb);
  const focusedNodeId = useViewModeStore((state) => state.focusedNodeId);
  const navigateBreadcrumb = useViewModeStore(
    (state) => state.navigateBreadcrumb,
  );
  const clearFocus = useViewModeStore((state) => state.clearFocus);

  if (breadcrumb.length === 0) {
    return null;
  }

  return (
    <div className="graph-toolbar" aria-label="생각 꼬리물기 툴바">
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
    </div>
  );
}
