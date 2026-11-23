import type { MemoResponseDto } from "@ideamory/api-spec";

/**
 * 지식망 그래프의 단일 메모 노드 모델입니다.
 */
export interface GraphNode {
  id: string;
  label: string;
  categoryName: string | null;
  color: string;
  val: number;
  relatedCount: number;
  memo: MemoResponseDto;
  x?: number;
  y?: number;
}

/**
 * 두 메모 노드 간의 의미적 유사도 간선 모델입니다.
 */
export interface GraphLink {
  source: string;
  target: string;
  similarity: number;
}

/**
 * react-force-graph-2d에 전달할 그래프 전체 데이터 구조입니다.
 */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
