"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-2d";
import type { GraphData, GraphLink, GraphNode } from "@/entities/memo";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
});

type BaseNode = NodeObject;
type BaseLink = LinkObject;
type ForceNode = NodeObject<GraphNode>;
type ForceLink = LinkObject<GraphNode, GraphLink>;

export interface KnowledgeGraphCanvasProps {
  graphData: GraphData;
  focusedNodeId: string | null;
  onFocusNode: (memoId: string) => void;
  onClearFocus: () => void;
}

function getEndpointId(endpoint: string | number | BaseNode | undefined): string {
  if (typeof endpoint === "string" || typeof endpoint === "number") {
    return String(endpoint);
  }
  return String(endpoint?.id ?? "");
}

/**
 * react-force-graph-2d 기반의 60fps HTML5 Canvas 지식망 렌더러입니다.
 */
export function KnowledgeGraphCanvas({
  graphData,
  focusedNodeId,
  onFocusNode,
  onClearFocus,
}: KnowledgeGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<ForceGraphMethods<BaseNode, BaseLink> | undefined>(
    undefined,
  );
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const connectedNodeIds = useMemo(() => {
    const connected = new Set<string>();
    if (!focusedNodeId) {
      return connected;
    }
    connected.add(focusedNodeId);
    for (const link of graphData.links) {
      const sourceId = getEndpointId(link.source as string | ForceNode);
      const targetId = getEndpointId(link.target as string | ForceNode);
      if (sourceId === focusedNodeId) {
        connected.add(targetId);
      } else if (targetId === focusedNodeId) {
        connected.add(sourceId);
      }
    }
    return connected;
  }, [focusedNodeId, graphData.links]);

  const handleNodeClick = useCallback(
    (nodeObj: BaseNode) => {
      const id = String(nodeObj.id);
      onFocusNode(id);
      if (
        fgRef.current &&
        typeof nodeObj.x === "number" &&
        typeof nodeObj.y === "number"
      ) {
        fgRef.current.centerAt(nodeObj.x, nodeObj.y, 300);
        const currentZoom = fgRef.current.zoom();
        if (typeof currentZoom === "number" && currentZoom < 1.45) {
          fgRef.current.zoom(1.45, 300);
        }
      }
    },
    [onFocusNode],
  );

  const drawNode = useCallback(
    (
      rawNode: BaseNode,
      ctx: CanvasRenderingContext2D,
      globalScale: number,
    ) => {
      const nodeObj = rawNode as ForceNode;
      const x = nodeObj.x ?? 0;
      const y = nodeObj.y ?? 0;
      const id = String(nodeObj.id);
      const isFocused = focusedNodeId === id;
      const isDimmed =
        focusedNodeId !== null && !connectedNodeIds.has(id);

      const baseRadius = 5 + Math.min(6, (nodeObj.relatedCount ?? 0) * 1.1);
      const radius = isFocused ? baseRadius * 1.3 : baseRadius;

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.28 : 1;

      if (isFocused) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 4 / Math.max(globalScale, 0.8), 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(229, 169, 92, 0.24)";
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = nodeObj.color || "#E5A95C";
      ctx.fill();

      ctx.lineWidth = isFocused ? 2 / globalScale : 1 / globalScale;
      ctx.strokeStyle = isFocused ? "#F4DEC0" : "rgba(26, 23, 21, 0.85)";
      ctx.stroke();

      const shouldShowLabel =
        isFocused ||
        (focusedNodeId !== null && connectedNodeIds.has(id)) ||
        globalScale >= 0.95;

      if (shouldShowLabel && nodeObj.label) {
        const fontSize = Math.max(10, 12 / Math.max(globalScale, 0.75));
        ctx.font = `${isFocused ? "600 " : "500 "}${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isDimmed
          ? "rgba(241, 236, 230, 0.3)"
          : isFocused
            ? "#F6EFE7"
            : "#D5CCC2";
        ctx.fillText(nodeObj.label, x, y + radius + 4 / globalScale);
      }

      ctx.restore();
    },
    [connectedNodeIds, focusedNodeId],
  );

  const getLinkWidth = useCallback(
    (rawLink: BaseLink) => {
      const linkObj = rawLink as ForceLink;
      const similarity = linkObj.similarity ?? 0.8;
      const normalized = Math.max(0, (similarity - 0.7) / 0.3);
      const base = 1 + normalized * 2.2;
      if (!focusedNodeId) {
        return base;
      }
      const sourceId = getEndpointId(linkObj.source);
      const targetId = getEndpointId(linkObj.target);
      const isDirect =
        sourceId === focusedNodeId || targetId === focusedNodeId;
      return isDirect ? base + 0.8 : 0.8;
    },
    [focusedNodeId],
  );

  const getLinkColor = useCallback(
    (rawLink: BaseLink) => {
      const linkObj = rawLink as ForceLink;
      if (!focusedNodeId) {
        return "rgba(229, 169, 92, 0.34)";
      }
      const sourceId = getEndpointId(linkObj.source);
      const targetId = getEndpointId(linkObj.target);
      const isDirect =
        sourceId === focusedNodeId || targetId === focusedNodeId;
      return isDirect
        ? "rgba(229, 169, 92, 0.82)"
        : "rgba(154, 141, 127, 0.12)";
    },
    [focusedNodeId],
  );

  return (
    <div ref={containerRef} className="knowledge-graph-canvas-wrap">
      {size.width > 0 && size.height > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.width}
          height={size.height}
          graphData={graphData as { nodes: ForceNode[]; links: ForceLink[] }}
          backgroundColor="rgba(0, 0, 0, 0)"
          nodeId="id"
          nodeVal={(node) => (node as ForceNode).val}
          nodeLabel={(node) => (node as ForceNode).label}
          nodeCanvasObject={drawNode}
          linkWidth={getLinkWidth}
          linkColor={getLinkColor}
          linkDirectionalParticles={0}
          cooldownTicks={90}
          onNodeClick={handleNodeClick}
          onBackgroundClick={onClearFocus}
        />
      )}
    </div>
  );
}
