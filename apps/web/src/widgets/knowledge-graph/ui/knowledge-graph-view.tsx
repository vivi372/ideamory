"use client";

import { useMemo } from "react";
import { useViewModeStore } from "@/features/view-mode";
import { useKnowledgeGraphData } from "../model/use-knowledge-graph-data";
import { GraphNodeSheet } from "./graph-node-sheet";
import { GraphToolbar } from "./graph-toolbar";
import { KnowledgeGraphCanvas } from "./knowledge-graph-canvas";

export interface KnowledgeGraphViewProps {
  isBootstrapped: boolean;
}

/**
 * Zero-Effort AI 제텔카스텐 지식망 모드 전체 뷰 위젯입니다.
 * 상단 임계값/꼬리물기 툴바, 2D 포스 그래프 캔버스, 하단 1-Depth 미니 카드 시트를 통합합니다.
 */
export function KnowledgeGraphView({
  isBootstrapped,
}: KnowledgeGraphViewProps) {
  const threshold = useViewModeStore((state) => state.threshold);
  const focusedNodeId = useViewModeStore((state) => state.focusedNodeId);
  const focusNode = useViewModeStore((state) => state.focusNode);
  const clearFocus = useViewModeStore((state) => state.clearFocus);

  const { graphData, memoById, labelById, isLoading, isSyncingLinks } =
    useKnowledgeGraphData({
      enabled: isBootstrapped,
      threshold,
    });

  const focusedMemo = focusedNodeId
    ? (memoById.get(focusedNodeId) ?? null)
    : null;

  const focusedNode = useMemo(() => {
    if (!focusedNodeId) {
      return null;
    }
    return graphData.nodes.find((node) => node.id === focusedNodeId) ?? null;
  }, [focusedNodeId, graphData.nodes]);

  const focusedRelatedCount = focusedNode?.relatedCount ?? 0;

  if (isLoading) {
    return (
      <section className="knowledge-graph-view" aria-busy="true">
        <div className="knowledge-graph-empty">
          지식망 노드를 불러오는 중입니다…
        </div>
      </section>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <section className="knowledge-graph-view">
        <div className="knowledge-graph-empty">
          아직 지식망에 표시할 메모가 없습니다. 아래 입력창에서 첫 메모를
          남겨보세요.
        </div>
      </section>
    );
  }

  return (
    <section
      className="knowledge-graph-view"
      aria-label="제텔카스텐 지식망 그래프"
    >
      <GraphToolbar
        nodeCount={graphData.nodes.length}
        linkCount={graphData.links.length}
        labelById={labelById}
      />

      {isSyncingLinks && (
        <span className="knowledge-graph-sync-badge">연결선 계산 중…</span>
      )}

      <KnowledgeGraphCanvas
        graphData={graphData}
        focusedNodeId={focusedNodeId}
        onFocusNode={focusNode}
        onClearFocus={clearFocus}
      />

      <GraphNodeSheet
        memo={focusedMemo}
        relatedCount={focusedRelatedCount}
        nodeColor={focusedNode?.color}
        onClose={clearFocus}
      />
    </section>
  );
}
