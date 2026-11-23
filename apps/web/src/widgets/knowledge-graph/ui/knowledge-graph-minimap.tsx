"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import type { ForceGraphMethods, LinkObject, NodeObject } from "react-force-graph-2d";
import type { GraphData, GraphLink, GraphNode } from "@/entities/memo";

type BaseNode = NodeObject;
type BaseLink = LinkObject;
type ForceNode = NodeObject<GraphNode>;

export interface KnowledgeGraphMinimapProps {
  fgRef: React.RefObject<ForceGraphMethods<BaseNode, BaseLink> | undefined>;
  graphData: GraphData;
  viewportSize: { width: number; height: number };
  focusedNodeId: string | null;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

function getEndpointNode(
  endpoint: string | number | BaseNode | undefined,
  nodeMap: Map<string, ForceNode>,
): ForceNode | undefined {
  if (typeof endpoint === "string" || typeof endpoint === "number") {
    return nodeMap.get(String(endpoint));
  }
  return endpoint as ForceNode | undefined;
}

/**
 * Figma 스타일의 지식망 전체 조망 미니맵입니다.
 * 전체 노드/연결선과 현재 카메라 뷰포트 사각형을 실시간으로 표시하며,
 * 클릭 또는 드래그로 원하는 그래프 위치로 즉시 이동할 수 있습니다.
 */
export function KnowledgeGraphMinimap({
  fgRef,
  graphData,
  viewportSize,
  focusedNodeId,
}: KnowledgeGraphMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const boundsRef = useRef<Bounds | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    moved: boolean;
    startClientX: number;
    startClientY: number;
    startCenterX: number;
    startCenterY: number;
  }>({
    active: false,
    moved: false,
    startClientX: 0,
    startClientY: 0,
    startCenterX: 0,
    startCenterY: 0,
  });

  const drawMinimap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const nodes = graphData.nodes as ForceNode[];
    const positioned = nodes.filter(
      (n) => typeof n.x === "number" && typeof n.y === "number",
    );
    if (positioned.length === 0) {
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of positioned) {
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const padding = 48;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    const spanX = Math.max(120, maxX - minX);
    const spanY = Math.max(120, maxY - minY);
    const innerPad = 8;
    const scale = Math.min(
      (width - innerPad * 2) / spanX,
      (height - innerPad * 2) / spanY,
    );
    const offsetX = (width - spanX * scale) / 2;
    const offsetY = (height - spanY * scale) / 2;

    boundsRef.current = { minX, maxX, minY, maxY, scale, offsetX, offsetY };

    const toMiniX = (gx: number) => offsetX + (gx - minX) * scale;
    const toMiniY = (gy: number) => offsetY + (gy - minY) * scale;

    const nodeMap = new Map<string, ForceNode>();
    for (const node of positioned) {
      nodeMap.set(String(node.id), node);
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(229, 169, 92, 0.28)";
    for (const link of graphData.links as unknown as LinkObject<GraphNode, GraphLink>[]) {
      const src = getEndpointNode(link.source, nodeMap);
      const tgt = getEndpointNode(link.target, nodeMap);
      if (
        src &&
        tgt &&
        typeof src.x === "number" &&
        typeof src.y === "number" &&
        typeof tgt.x === "number" &&
        typeof tgt.y === "number"
      ) {
        ctx.beginPath();
        ctx.moveTo(toMiniX(src.x), toMiniY(src.y));
        ctx.lineTo(toMiniX(tgt.x), toMiniY(tgt.y));
        ctx.stroke();
      }
    }

    for (const node of positioned) {
      const mx = toMiniX(node.x ?? 0);
      const my = toMiniY(node.y ?? 0);
      const isFocused = focusedNodeId === String(node.id);
      ctx.beginPath();
      ctx.arc(mx, my, isFocused ? 3.5 : 2.3, 0, 2 * Math.PI);
      ctx.fillStyle = isFocused ? "#F6EFE7" : node.color || "#E5A95C";
      ctx.fill();
    }

    const fg = fgRef.current;
    if (fg && viewportSize.width > 0 && viewportSize.height > 0) {
      const topLeft = fg.screen2GraphCoords(0, 0);
      const bottomRight = fg.screen2GraphCoords(
        viewportSize.width,
        viewportSize.height,
      );
      if (
        topLeft &&
        bottomRight &&
        Number.isFinite(topLeft.x) &&
        Number.isFinite(bottomRight.x)
      ) {
        const rx = toMiniX(topLeft.x);
        const ry = toMiniY(topLeft.y);
        const rw = Math.max(8, toMiniX(bottomRight.x) - rx);
        const rh = Math.max(8, toMiniY(bottomRight.y) - ry);

        ctx.fillStyle = "rgba(229, 169, 92, 0.08)";
        ctx.fillRect(rx, ry, rw, rh);
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = "rgba(229, 169, 92, 0.85)";
        ctx.strokeRect(rx, ry, rw, rh);
      }
    }
  }, [fgRef, focusedNodeId, graphData.links, graphData.nodes, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    drawMinimap();
    const timer = window.setInterval(drawMinimap, 80);
    return () => window.clearInterval(timer);
  }, [drawMinimap]);

  const panToClick = useCallback(
    (event: PointerEvent<HTMLCanvasElement>, durationMs: number) => {
      const canvas = canvasRef.current;
      const bounds = boundsRef.current;
      const fg = fgRef.current;
      if (!canvas || !bounds || !fg) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const py = ((event.clientY - rect.top) / rect.height) * canvas.height;

      const gx = bounds.minX + (px - bounds.offsetX) / bounds.scale;
      const gy = bounds.minY + (py - bounds.offsetY) / bounds.scale;
      fg.centerAt(gx, gy, durationMs);
    },
    [fgRef],
  );

  return (
    <div
      className={`graph-minimap${focusedNodeId ? " is-sheet-open" : ""}`}
      aria-label="지식망 전체 미니맵"
      title="클릭하거나 드래그하여 그래프 이동"
    >
      <canvas
        ref={canvasRef}
        width={156}
        height={104}
        className="graph-minimap-canvas"
        onPointerDown={(event) => {
          event.stopPropagation();
          const fg = fgRef.current;
          const center = fg?.screen2GraphCoords(
            viewportSize.width / 2,
            viewportSize.height / 2,
          );
          dragStateRef.current = {
            active: true,
            moved: false,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startCenterX: center?.x ?? 0,
            startCenterY: center?.y ?? 0,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragStateRef.current;
          const canvas = canvasRef.current;
          const bounds = boundsRef.current;
          const fg = fgRef.current;
          if (!drag.active || !canvas || !bounds || !fg) {
            return;
          }
          event.stopPropagation();
          const dxClient = event.clientX - drag.startClientX;
          const dyClient = event.clientY - drag.startClientY;
          if (!drag.moved && Math.hypot(dxClient, dyClient) < 4) {
            return;
          }
          drag.moved = true;

          const rect = canvas.getBoundingClientRect();
          const dxCanvas = (dxClient / rect.width) * canvas.width;
          const dyCanvas = (dyClient / rect.height) * canvas.height;
          const damping = 0.65;

          fg.centerAt(
            drag.startCenterX + (dxCanvas / bounds.scale) * damping,
            drag.startCenterY + (dyCanvas / bounds.scale) * damping,
            0,
          );
        }}
        onPointerUp={(event) => {
          const drag = dragStateRef.current;
          if (drag.active && !drag.moved) {
            panToClick(event, 200);
          }
          drag.active = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      />
    </div>
  );
}
