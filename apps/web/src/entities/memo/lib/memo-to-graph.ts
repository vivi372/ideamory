import type {
  MemoAiStatus,
  MemoResponseDto,
  RelatedMemoResponseDto,
} from "@ideamory/api-spec";
import type { GraphData, GraphLink, GraphNode } from "../model/graph.types";

const CATEGORY_NODE_PALETTE = [
  "#2BCDE0", // 시안
  "#A78BFA", // 바이올렛
  "#34D399", // 에메랄드
  "#F472B6", // 핑크
  "#FBBF24", // 골드
  "#FB7185", // 로즈
  "#60A5FA", // 블루
  "#A3E635", // 라임
  "#2DD4BF", // 틸
  "#FB923C", // 오렌지
  "#C084FC", // 퍼플
  "#F87171", // 코랄
  "#4ADE80", // 그린
  "#818CF8", // 인디고
] as const;

const UNCATEGORIZED_NODE_COLOR = "#78716C";
const PENDING_NODE_COLOR = "#E9A14E";

function hashCategoryName(name: string): number {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i += 1) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 카테고리 이름과 AI 분류 상태를 기반으로 Warm Dark 팔레트에서 결정론적인 노드 색상을 반환합니다.
 * AI 분류 대기 중(`PENDING`)인 노드는 미분류 회색(`#78716C`)과 구분되는 Warm Amber(`#E9A14E`)를 반환합니다.
 */
export function resolveGraphCategoryColor(
  categoryName?: string | null,
  aiStatus?: MemoAiStatus,
): string {
  if (aiStatus === "PENDING") {
    return PENDING_NODE_COLOR;
  }
  const trimmed = categoryName?.trim();
  if (!trimmed || trimmed === "미분류") {
    return UNCATEGORIZED_NODE_COLOR;
  }
  return CATEGORY_NODE_PALETTE[
    hashCategoryName(trimmed) % CATEGORY_NODE_PALETTE.length
  ];
}

/**
 * 그래프 내 활성 카테고리 목록에 대해 팔레트 범위 내에서 해시 충돌을 피하며 서로 다른 색상을 우선 배정합니다.
 */
function buildCategoryColorMap(
  memos: readonly MemoResponseDto[],
): ReadonlyMap<string, string> {
  const uniqueCategories = Array.from(
    new Set(
      memos
        .filter((memo) => memo.aiStatus !== "PENDING")
        .map((memo) => memo.categoryName?.trim())
        .filter((name): name is string => Boolean(name && name !== "미분류")),
    ),
  ).sort();

  const colorMap = new Map<string, string>();
  const usedIndices = new Set<number>();

  for (const name of uniqueCategories) {
    const baseIndex = hashCategoryName(name) % CATEGORY_NODE_PALETTE.length;
    let assignedIndex = baseIndex;

    if (usedIndices.size < CATEGORY_NODE_PALETTE.length) {
      for (let offset = 0; offset < CATEGORY_NODE_PALETTE.length; offset += 1) {
        const candidate = (baseIndex + offset) % CATEGORY_NODE_PALETTE.length;
        if (!usedIndices.has(candidate)) {
          assignedIndex = candidate;
          break;
        }
      }
      usedIndices.add(assignedIndex);
    }

    colorMap.set(name, CATEGORY_NODE_PALETTE[assignedIndex]);
  }

  return colorMap;
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

  const categoryColorMap = buildCategoryColorMap(activeMemos);

  const nodes: GraphNode[] = activeMemos.map((memo) => {
    const degree = degreeMap.get(memo.id) ?? 0;
    const trimmedCategory = memo.categoryName?.trim();
    const color =
      memo.aiStatus === "PENDING"
        ? PENDING_NODE_COLOR
        : !trimmedCategory || trimmedCategory === "미분류"
          ? UNCATEGORIZED_NODE_COLOR
          : (categoryColorMap.get(trimmedCategory) ??
            resolveGraphCategoryColor(trimmedCategory, memo.aiStatus));

    return {
      id: memo.id,
      label: extractNodeLabel(memo.content),
      categoryName: memo.categoryName ?? null,
      color,
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
