import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MemoResponseDto, RelatedMemoResponseDto } from "@ideamory/api-spec";
import {
  buildKnowledgeGraphData,
  extractNodeLabel,
  resolveGraphCategoryColor,
} from "../lib/memo-to-graph";

function createMockMemo(
  overrides: Partial<MemoResponseDto> & { id: string },
): MemoResponseDto {
  return {
    content: `메모 ${overrides.id}`,
    categoryId: "cat-default",
    categoryName: "일반",
    aiStatus: "COMPLETED",
    ogp: undefined,
    relatedCount: 0,
    deletedAt: null,
    createdAt: "2026-11-23T00:00:00.000Z",
    updatedAt: "2026-11-23T00:00:00.000Z",
    ...overrides,
  };
}

function createMockRelated(
  id: string,
  similarity: number,
): RelatedMemoResponseDto {
  return {
    id,
    content: `연관 메모 ${id}`,
    categoryId: "cat-default",
    categoryName: "일반",
    similarity,
    ogp: undefined,
    createdAt: "2026-11-23T00:00:00.000Z",
  };
}

describe("memo-to-graph", () => {
  it("삭제된 메모를 제외하고 임계값 이상의 중복 없는 무방향 간선을 생성한다", () => {
    const memos = [
      createMockMemo({ id: "a", content: "첫 번째 줄\n두 번째 줄", categoryName: "개발" }),
      createMockMemo({ id: "b", content: "두 번째 메모", categoryName: "개발" }),
      createMockMemo({ id: "c", content: "세 번째 메모", categoryName: "아이디어" }),
      createMockMemo({
        id: "deleted",
        content: "휴지통 메모",
        deletedAt: "2026-11-23T01:00:00.000Z",
      }),
    ];

    const relatedMap = new Map<string, RelatedMemoResponseDto[]>([
      [
        "a",
        [
          createMockRelated("b", 0.82),
          createMockRelated("c", 0.74),
          createMockRelated("deleted", 0.95),
          createMockRelated("a", 1),
        ],
      ],
      [
        "b",
        [
          createMockRelated("a", 0.85),
          createMockRelated("c", 0.81),
        ],
      ],
    ]);

    const graphAt80 = buildKnowledgeGraphData(memos, relatedMap, 0.8);
    assert.equal(graphAt80.nodes.length, 3);
    assert.equal(graphAt80.links.length, 2);

    const abEdge = graphAt80.links.find(
      (link) => link.source === "a" && link.target === "b",
    );
    assert.ok(abEdge);
    assert.equal(abEdge.similarity, 0.85);

    const nodeA = graphAt80.nodes.find((n) => n.id === "a");
    const nodeB = graphAt80.nodes.find((n) => n.id === "b");
    assert.equal(nodeA?.label, "첫 번째 줄 두 번째 줄");
    assert.equal(nodeA?.relatedCount, 1);
    assert.equal(nodeB?.relatedCount, 2);

    const graphAt60 = buildKnowledgeGraphData(memos, relatedMap, 0.6);
    assert.equal(graphAt60.links.length, 3);
  });

  it("extractNodeLabel은 긴 첫 줄을 말줄임표로 자르고 빈 본문은 기본 라벨을 반환한다", () => {
    assert.equal(extractNodeLabel("   \n  "), "빈 메모");
    assert.equal(extractNodeLabel("가".repeat(30), 10), `${"가".repeat(9)}…`);
  });

  it("resolveGraphCategoryColor는 미분류일 때 중립 색상을, 카테고리명일 때 결정론적 색상을 반환한다", () => {
    assert.equal(resolveGraphCategoryColor(null), "#78716C");
    assert.equal(resolveGraphCategoryColor("미분류"), "#78716C");
    assert.equal(
      resolveGraphCategoryColor("개발"),
      resolveGraphCategoryColor("개발"),
    );
  });
});
