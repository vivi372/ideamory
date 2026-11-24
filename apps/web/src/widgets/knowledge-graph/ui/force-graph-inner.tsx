"use client";

import { useEffect, useRef } from "react";
import ForceGraph2D, {
  type ForceGraphMethods,
  type LinkObject,
  type NodeObject,
} from "react-force-graph-2d";
import type { GraphData, GraphLink, GraphNode } from "@/entities/memo";

export type BaseNode = NodeObject;
export type BaseLink = LinkObject;
export type ForceNode = NodeObject<GraphNode>;
export type ForceLink = LinkObject<GraphNode, GraphLink>;

interface SavedPosition {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface ForceGraphInnerProps {
  fgRef: React.MutableRefObject<
    ForceGraphMethods<BaseNode, BaseLink> | undefined
  >;
  width: number;
  height: number;
  graphData: GraphData;
  drawNode: (
    node: BaseNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => void;
  paintNodePointerArea: (
    node: BaseNode,
    color: string,
    ctx: CanvasRenderingContext2D,
  ) => void;
  getLinkWidth: (link: BaseLink) => number;
  getLinkColor: (link: BaseLink) => string;
  onNodeClick: (node: BaseNode) => void;
  onBackgroundClick: () => void;
}

/**
 * `next/dynamic(..., { ssr: false })`로 로드되는 동기 `ForceGraph2D` 래퍼입니다.
 * `graphData.nodes` 객체 참조를 그대로 유지해 미니맵과 좌표를 실시간 공유하며,
 * 마운트 즉시 d3 force(척력·링크 거리)를 설정해 뭉침과 떨림을 방지합니다.
 */
export default function ForceGraphInner({
  fgRef,
  width,
  height,
  graphData,
  drawNode,
  paintNodePointerArea,
  getLinkWidth,
  getLinkColor,
  onNodeClick,
  onBackgroundClick,
}: ForceGraphInnerProps) {
  const positionCacheRef = useRef<Map<string, SavedPosition>>(new Map());
  const prevTopologyRef = useRef<string>("");

  const cache = positionCacheRef.current;
  for (const node of graphData.nodes as ForceNode[]) {
    const saved = cache.get(String(node.id));
    if (
      saved &&
      typeof node.x !== "number" &&
      typeof saved.x === "number" &&
      typeof saved.y === "number"
    ) {
      node.x = saved.x;
      node.y = saved.y;
      node.vx = saved.vx;
      node.vy = saved.vy;
    }
  }

  useEffect(() => {
    const map = positionCacheRef.current;
    for (const node of graphData.nodes as ForceNode[]) {
      map.set(String(node.id), node);
    }
  }, [graphData]);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) {
      return;
    }

    const chargeForce = fg.d3Force("charge") as
      | { strength?: (value: number) => void }
      | undefined;
    chargeForce?.strength?.(-210);

    const linkForce = fg.d3Force("link") as
      | { distance?: (fn: (link: BaseLink) => number) => void }
      | undefined;
    linkForce?.distance?.((rawLink: BaseLink) => {
      const sim = (rawLink as ForceLink).similarity ?? 0.7;
      return 105 - Math.max(0, sim - 0.6) * 55;
    });

    const topologyKey = `${graphData.nodes.length}:${graphData.links.length}`;
    if (prevTopologyRef.current !== topologyKey) {
      prevTopologyRef.current = topologyKey;
      fg.d3ReheatSimulation();
    }
  }, [fgRef, graphData.links.length, graphData.nodes.length]);

  return (
    <ForceGraph2D
      ref={fgRef}
      width={width}
      height={height}
      graphData={graphData as unknown as { nodes: BaseNode[]; links: BaseLink[] }}
      backgroundColor="rgba(0, 0, 0, 0)"
      nodeId="id"
      nodeVal={(node) => (node as ForceNode).val}
      nodeLabel={(node) => (node as ForceNode).label}
      nodeCanvasObject={drawNode}
      nodePointerAreaPaint={paintNodePointerArea}
      linkWidth={getLinkWidth}
      linkColor={getLinkColor}
      linkDirectionalParticles={0}
      warmupTicks={45}
      cooldownTicks={120}
      onNodeClick={onNodeClick}
      onBackgroundClick={onBackgroundClick}
    />
  );
}
