import type { MemoResponseDto, RelatedMemoResponseDto } from "@ideamory/api-spec";
import type { GraphData, GraphLink, GraphNode } from "../model/graph.types";

const CATEGORY_NODE_PALETTE = [
  "#2BCDE0",
  "#8B7CF6",
  "#34D399",
  "#F472B6",
  "#38BDF8",
  "#FBBF24",
] as const;

const UNCATEGORIZED_NODE_COLOR = "#78716C";

/**
 * 카테고리 이름을 기반으로 Warm Dark 팔레트에서 결정론적인 노드 색상을 반환합니다.
 */
export function resolveGraphCategoryColor(
  categoryName?: string | null,
): string {
  const trimmed = categoryName?.trim();
  if (!trimmed || trimmed === "미분류") {
    return UNCATEGORIZED_NODE_COLOR;
  }
  let hash = 0;
  for (let i = 0; i < trimmed.length; i += 1) {
    hash = (hash * 31 + trimmed.charCodeAt(i)) >>> 0;
  }
  return CATEGORY_NODE_PALETTE[hash % CATEGORY_NODE_PALETTE.length];
}

/**
 * 메모 본문에서 그래프 노드 라벨로 표시할 요약 텍스트를 추출합니다.
 * 서로게이트 쌍(이모지 등)이 중간에 잘리지 않도록 유니코드 코드 포인트 단위로 슬라이싱합니다.
 */
export function extractNodeLabel(content: string, maxLength = 84): string {
  const normalized = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ");

  if (!normalized) {
    return "빈 메모";
  }

  const chars = Array.from(normalized);
  if (chars.length <= maxLength) {
    return normalized;
  }
  return `${chars.slice(0, maxLength - 1).join("")}…`;
}

/**
 * 메모 목록과 연관 메모 맵, 유사도 임계값(threshold)을 바탕으로
 * 중복 간선을 제거한 무방향 지식망 그래프 데이터를 생성합니다.
 */
export function buildKnowledgeGraphData(
  memos: readonly MemoResponseDto[],
  relatedByMemoId: ReadonlyMap<string, readonly RelatedMemoResponseDto[]>,
  threshold: number,
): GraphData {
  const activeMemos = memos.filter((memo) => !memo.deletedAt);
  const activeMemoIds = new Set(activeMemos.map((memo) => memo.id));

  const edgeMap = new Map<string, GraphLink>();
  const degreeMap = new Map<string, number>();

  for (const memo of activeMemos) {
    const relatedList = relatedByMemoId.get(memo.id);
    if (!relatedList) {
      continue;
    }

    for (const related of relatedList) {
      if (
        related.id === memo.id ||
        !activeMemoIds.has(related.id) ||
        related.similarity < threshold
      ) {
        continue;
      }

      const [firstId, secondId] =
        memo.id < related.id ? [memo.id, related.id] : [related.id, memo.id];
      const edgeKey = `${firstId}::${secondId}`;
      const existing = edgeMap.get(edgeKey);

      if (!existing) {
        edgeMap.set(edgeKey, {
          source: firstId,
          target: secondId,
          similarity: related.similarity,
        });
        degreeMap.set(firstId, (degreeMap.get(firstId) ?? 0) + 1);
        degreeMap.set(secondId, (degreeMap.get(secondId) ?? 0) + 1);
      } else if (related.similarity > existing.similarity) {
        existing.similarity = related.similarity;
      }
    }
  }

  const nodes: GraphNode[] = activeMemos.map((memo) => {
    const degree = degreeMap.get(memo.id) ?? 0;
    return {
      id: memo.id,
      label: extractNodeLabel(memo.content),
      categoryName: memo.categoryName ?? null,
      color: resolveGraphCategoryColor(memo.categoryName),
      val: Math.max(2.5, Math.min(5.5, 2.5 + degree * 0.5)),
      relatedCount: degree,
      memo,
    };
  });

  return {
    nodes,
    links: Array.from(edgeMap.values()),
  };
}
