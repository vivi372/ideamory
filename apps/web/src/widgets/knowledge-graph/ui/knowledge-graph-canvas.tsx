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

function wrapLabelLines(text: string, charsPerLine = 16, maxLines = 3): string[] {
  if (!text) {
    return [];
  }
  const lines: string[] = [];
  for (let i = 0; i < text.length && lines.length < maxLines; i += charsPerLine) {
    const chunk = text.slice(i, i + charsPerLine);
    const isLastAllowed = lines.length === maxLines - 1;
    if (isLastAllowed && i + charsPerLine < text.length) {
      lines.push(`${chunk.slice(0, charsPerLine - 1)}…`);
    } else {
      lines.push(chunk);
    }
  }
  return lines;
}

/**
 * react-force-graph-2d 기반의 60fps HTML5 Canvas 지식망 렌더러입니다.
 * 넓은 노드 간격, 줌 연동 다중 줄 라벨, 고립 노드 포함 넉넉한 터치 히트 영역을 제공합니다.
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

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) {
      return;
    }
    const chargeForce = fg.d3Force("charge") as
      | { strength?: (value: number) => void }
      | undefined;
    chargeForce?.strength?.(-280);

    const linkForce = fg.d3Force("link") as
      | { distance?: (fn: (link: BaseLink) => number) => void }
      | undefined;
    linkForce?.distance?.((rawLink: BaseLink) => {
      const sim = (rawLink as ForceLink).similarity ?? 0.7;
      return 165 - Math.max(0, sim - 0.6) * 120;
    });

    fg.d3ReheatSimulation();
  }, [graphData, size.width, size.height]);

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
        if (typeof currentZoom === "number" && currentZoom < 1.35) {
          fgRef.current.zoom(1.35, 300);
        }
      }
    },
    [onFocusNode],
  );

  const getVisualRadius = useCallback(
    (nodeObj: ForceNode, isFocused: boolean) => {
      const baseRadius = 6 + Math.min(6, (nodeObj.relatedCount ?? 0) * 1.1);
      return isFocused ? baseRadius * 1.3 : baseRadius;
    },
    [],
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

      const radius = getVisualRadius(nodeObj, isFocused);

      ctx.save();
      ctx.globalAlpha = isDimmed ? 0.28 : 1;

      if (isFocused) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 5 / Math.max(globalScale, 0.8), 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(229, 169, 92, 0.25)";
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
        globalScale >= 0.55;

      if (shouldShowLabel && nodeObj.label) {
        const fontSize = Math.max(9.5, 11.5 / Math.max(globalScale, 0.7));
        const maxLines = globalScale >= 1.2 || isFocused ? 3 : 2;
        const lines = wrapLabelLines(nodeObj.label, 16, maxLines);

        ctx.font = `${isFocused ? "600 " : "500 "}${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const lineHeight = fontSize * 1.25;
        const textStartY = y + radius + 5 / globalScale;
        const maxWidth = Math.max(
          ...lines.map((line) => ctx.measureText(line).width),
        );
        const padX = 5 / Math.max(globalScale, 0.8);
        const padY = 2.5 / Math.max(globalScale, 0.8);

        ctx.fillStyle = isDimmed
          ? "rgba(20, 18, 16, 0.3)"
          : "rgba(20, 18, 16, 0.72)";
        ctx.fillRect(
          x - maxWidth / 2 - padX,
          textStartY - padY,
          maxWidth + padX * 2,
          lines.length * lineHeight + padY * 2,
        );

        ctx.fillStyle = isDimmed
          ? "rgba(241, 236, 230, 0.35)"
          : isFocused
            ? "#F6EFE7"
            : "#E3DBD2";
        lines.forEach((line, index) => {
          ctx.fillText(line, x, textStartY + index * lineHeight);
        });
      }

      ctx.restore();
    },
    [connectedNodeIds, focusedNodeId, getVisualRadius],
  );

  const paintNodePointerArea = useCallback(
    (rawNode: BaseNode, color: string, ctx: CanvasRenderingContext2D) => {
      const nodeObj = rawNode as ForceNode;
      const x = nodeObj.x ?? 0;
      const y = nodeObj.y ?? 0;
      const isFocused = focusedNodeId === String(nodeObj.id);
      const hitRadius = Math.max(18, getVisualRadius(nodeObj, isFocused) + 10);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, hitRadius, 0, 2 * Math.PI);
      ctx.fill();
    },
    [focusedNodeId, getVisualRadius],
  );

  const getLinkWidth = useCallback(
    (rawLink: BaseLink) => {
      const linkObj = rawLink as ForceLink;
      const similarity = linkObj.similarity ?? 0.8;
      const normalized = Math.max(0, (similarity - 0.6) / 0.4);
      const base = 1 + normalized * 2.4;
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
          nodePointerAreaPaint={paintNodePointerArea}
          linkWidth={getLinkWidth}
          linkColor={getLinkColor}
          linkDirectionalParticles={0}
          cooldownTicks={100}
          onNodeClick={handleNodeClick}
          onBackgroundClick={onClearFocus}
        />
      )}
    </div>
  );
}
