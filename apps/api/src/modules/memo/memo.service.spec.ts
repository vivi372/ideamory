import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { HttpStatus } from "@nestjs/common";
import { ERROR_CODES } from "@ideamory/api-spec";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AiService } from "../ai/ai.service";
import { OgpService } from "../ogp/ogp.service";
import { MemoService } from "./memo.service";
import { MemoRepository } from "./memo.repository";
import {
  clampAndRoundScore,
  sanitizeSearchQuery,
  toPgVectorLiteral,
} from "./memo.helper";
import { TrashCleanerScheduler } from "../scheduler/trash-cleaner.scheduler";

describe("MemoService & TrashCleanerScheduler (2단계 퀵 캡처 파이프라인, CUD, 휴지통 복구 및 자정 GC)", () => {
  let memoService: MemoService;
  let aiService: AiService;
  let ogpService: OgpService;
  let opOrder: string[];
  let repoCalls: Record<string, any[]>;
  let mockMemoRecord: any;
  let mockCategoryRecord: any;
  let mockDeletedRows: Array<{ id: string }>;

  const owner = { userId: "999e4567-e89b-12d3-a456-426614174999" };

  beforeEach(() => {
    opOrder = [];
    repoCalls = {
      findOrCreateCategory: [],
      insertMemo: [],
      updateMemoBackgroundEnrichment: [],
      findMemosWithOgp: [],
      updateMemoById: [],
      updateMemoDeletedAt: [],
      deleteExpiredTrashMemos: [],
      deleteOrphanCategories: [],
      searchMemosHybrid: [],
      findRelatedMemos: [],
    };
    mockMemoRecord = null;
    mockCategoryRecord = { id: "cat-1", name: "개발" };
    mockDeletedRows = [{ id: "memo-1" }];

    const mockTx: any = { isMockTx: true };

    const mockRepo: Partial<MemoRepository> = {
      withTransaction: async (cb) => {
        opOrder.push("withTransaction:start");
        const res = await cb(mockTx);
        opOrder.push("withTransaction:end");
        return res;
      },
      findCategoriesByOwner: async () => [
        { id: "cat-미분류", name: "미분류", normalizedName: "미분류" },
        { id: "cat-dev", name: "개발", normalizedName: "개발" },
      ],
      findOrCreateCategory: async (_owner, name, normalizedName) => {
        repoCalls.findOrCreateCategory.push({ name, normalizedName });
        return {
          id: name === "미분류" ? "cat-uncategorized" : `cat-${normalizedName}`,
          name,
        };
      },
      insertMemo: async (params) => {
        repoCalls.insertMemo.push(params);
        const now = new Date("2026-11-13T05:00:00.000Z");
        return { createdAt: now, updatedAt: now };
      },
      updateMemoBackgroundEnrichment: async (memoId, updates) => {
        repoCalls.updateMemoBackgroundEnrichment.push({ memoId, updates });
      },
      findMemosWithOgp: async (_owner, options) => {
        repoCalls.findMemosWithOgp.push(options);
        return mockMemoRecord ? [mockMemoRecord] : [];
      },
      findMemoByIdAndOwner: async () => mockMemoRecord,
      findCategoryByIdAndOwner: async () => mockCategoryRecord,
      updateMemoById: async (memoId, _owner, updates) => {
        repoCalls.updateMemoById.push({ memoId, updates });
      },
      updateMemoDeletedAt: async (memoId, _owner, deletedAt) => {
        repoCalls.updateMemoDeletedAt.push({ memoId, deletedAt });
        return mockDeletedRows;
      },
      deleteExpiredTrashMemos: async (cutoffDate) => {
        opOrder.push("deleteExpiredTrashMemos");
        repoCalls.deleteExpiredTrashMemos.push(cutoffDate);
        return [{ id: "old-1" }, { id: "old-2" }];
      },
      deleteOrphanCategories: async () => {
        opOrder.push("deleteOrphanCategories");
        repoCalls.deleteOrphanCategories.push(true);
        return [{ id: "orphan-cat-1" }];
      },
      searchMemosHybrid: async (params) => {
        repoCalls.searchMemosHybrid.push(params);
        return [
          {
            id: "018d0000-0000-7000-8000-000000000501",
            content: "NestJS pgvector 하이브리드 검색",
            categoryId: "018d0000-0000-7000-8000-000000000010",
            categoryName: "개발",
            ftsScore: 0.812345,
            vectorScore: 0.912345,
            finalScore: 0.872345,
            ogpId: "018d0000-0000-7000-8000-000000000601",
            ogpTargetUrl: "https://nestjs.com",
            ogpTitle: "NestJS",
            ogpThumbnailUrl: null,
            ogpDescription: "Progressive Node.js framework",
            ogpExpiresAt: new Date("2026-11-29T00:00:00.000Z"),
            ogpFetchedAt: new Date("2026-11-15T00:00:00.000Z"),
            createdAt: new Date("2026-11-14T10:00:00.000Z"),
          },
        ];
      },
      findMemoEmbeddingByIdAndOwner: async () => mockMemoRecord,
      findRelatedMemos: async (params) => {
        repoCalls.findRelatedMemos.push(params);
        return [
          {
            id: "018d0000-0000-7000-8000-000000000502",
            content: "Drizzle pgvector 코사인 거리 연산",
            categoryId: "018d0000-0000-7000-8000-000000000010",
            categoryName: "개발",
            similarity: 0.884321,
            ogpId: null,
            ogpTargetUrl: null,
            ogpTitle: null,
            ogpThumbnailUrl: null,
            ogpDescription: null,
            ogpExpiresAt: null,
            ogpFetchedAt: null,
            createdAt: new Date("2026-11-14T09:00:00.000Z"),
          },
        ];
      },
    };

    aiService = new AiService();
    ogpService = new OgpService({} as any);
    memoService = new MemoService(
      mockRepo as MemoRepository,
      aiService,
      ogpService
    );
  });

  it("시나리오 1: 문두 @아이디어 지시어 포함 createMemo는 즉시 카테고리를 매핑해 201 응답을 반환하고 백그라운드 LLM 분류는 건너뛰어야 한다", async () => {
    let classifyCalled = false;
    aiService.classifyMemoCategory = async () => {
      classifyCalled = true;
      return { name: "기타", normalizedName: "기타" };
    };
    aiService.generateEmbedding = async () => new Array(768).fill(0.1);

    const memoId = "018d0000-0000-7000-8000-000000000010";
    const res = await memoService.createMemo(owner, {
      id: memoId,
      content: "@아이디어 0.1초 퀵 캡처 서비스 명세서 작성 중",
    });

    assert.equal(res.id, memoId);
    assert.equal(res.categoryName, "아이디어");
    assert.equal(res.content, "0.1초 퀵 캡처 서비스 명세서 작성 중");

    // 비동기 백그라운드 태스크 완료 대기
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(classifyCalled, false);
    assert.equal(repoCalls.updateMemoBackgroundEnrichment.length, 1);
    const enrichment = repoCalls.updateMemoBackgroundEnrichment[0].updates;
    assert.equal(enrichment.categoryId, undefined);
    assert.equal(enrichment.embedding.length, 768);
  });

  it("시나리오 2: 지시어 부재 시 '미분류'로 즉시 선저장하고 백그라운드에서 LLM 분류, 768차원 임베딩, 첫 번째 URL OGP를 바인딩해야 한다", async () => {
    aiService.classifyMemoCategory = async () => ({
      name: "개발",
      normalizedName: "개발",
    });
    aiService.generateEmbedding = async () => new Array(768).fill(0.2);

    const parsedUrls: string[] = [];
    ogpService.parseAndCacheOgp = async (url: string) => {
      parsedUrls.push(url);
      return {
        id: "018d0000-0000-7000-8000-000000000777",
        targetUrl: url,
        title: "Next.js",
        thumbnailUrl: null,
        description: null,
        expiresAt: new Date().toISOString(),
      };
    };

    const memoId = "018d0000-0000-7000-8000-000000000011";
    const res = await memoService.createMemo(owner, {
      id: memoId,
      content:
        "참고: https://nextjs.org 및 https://nestjs.com 모노레포 구축기",
    });

    assert.equal(res.categoryName, "미분류");
    assert.equal(res.ogpId, null);

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.deepEqual(parsedUrls, ["https://nextjs.org"]);
    const enrichment = repoCalls.updateMemoBackgroundEnrichment[0].updates;
    assert.equal(enrichment.categoryId, "cat-개발");
    assert.equal(enrichment.embedding.length, 768);
    assert.equal(enrichment.ogpId, "018d0000-0000-7000-8000-000000000777");
  });

  it("시나리오 3: getMemos는 OGP가 조인된 타임라인 메모를 직렬화해 반환해야 한다", async () => {
    const now = new Date("2026-11-13T05:00:00.000Z");
    mockMemoRecord = {
      id: "018d0000-0000-7000-8000-000000000020",
      content: "메모 본문",
      categoryId: "018d0000-0000-7000-8000-000000000001",
      categoryName: "개발",
      ogpId: "018d0000-0000-7000-8000-000000000002",
      ogp: {
        id: "018d0000-0000-7000-8000-000000000002",
        targetUrl: "https://nestjs.com",
        title: "NestJS",
        thumbnailUrl: null,
        description: "Framework",
        fetchedAt: now,
        expiresAt: now,
      },
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const list = await memoService.getMemos(owner, {
      categoryId: "018d0000-0000-7000-8000-000000000001",
      deleted: false,
    });

    assert.equal(list.length, 1);
    assert.equal(list[0].ogp?.title, "NestJS");
    assert.deepEqual(repoCalls.findMemosWithOgp[0], {
      categoryId: "018d0000-0000-7000-8000-000000000001",
      deleted: false,
    });
  });

  it("시나리오 4: updateMemo는 존재하지 않는 메모나 타인 카테고리 지정 시 404 BusinessException을 발생시켜야 한다", async () => {
    mockMemoRecord = null;
    await assert.rejects(
      async () =>
        memoService.updateMemo(owner, "missing-id", { content: "수정" }),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.NOT_FOUND);
        assert.equal(err.errorCode, ERROR_CODES.MEMO_WARN_NOT_FOUND);
        return true;
      }
    );

    const now = new Date();
    mockMemoRecord = {
      id: "memo-1",
      content: "원본",
      categoryId: "cat-1",
      categoryName: "개발",
      ogpId: null,
      ogp: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    mockCategoryRecord = null;
    await assert.rejects(
      async () =>
        memoService.updateMemo(owner, "memo-1", { categoryId: "missing-cat" }),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.errorCode, ERROR_CODES.CATEGORY_WARN_NOT_FOUND);
        return true;
      }
    );
  });

  it("시나리오 5: softDeleteMemo 및 restoreMemo는 deletedAt 타임스탬프 설정과 null 복구를 정확히 수행해야 한다", async () => {
    await memoService.softDeleteMemo(owner, "memo-1");
    assert.ok(repoCalls.updateMemoDeletedAt[0].deletedAt instanceof Date);

    const now = new Date();
    mockMemoRecord = {
      id: "memo-1",
      content: "복구될 메모",
      categoryId: "cat-1",
      categoryName: "개발",
      ogpId: null,
      ogp: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const restored = await memoService.restoreMemo(owner, "memo-1");
    assert.equal(repoCalls.updateMemoDeletedAt[1].deletedAt, null);
    assert.equal(restored.deletedAt, null);
  });

  it("시나리오 6: TrashCleanerScheduler는 단일 트랜잭션 내에서 30일 경과 메모를 먼저 삭제한 뒤 고아 카테고리를 일괄 GC해야 한다", async () => {
    const scheduler = new TrashCleanerScheduler(memoService);
    await scheduler.handleDailyTrashCleanup();

    assert.deepEqual(opOrder, [
      "withTransaction:start",
      "deleteExpiredTrashMemos",
      "deleteOrphanCategories",
      "withTransaction:end",
    ]);
  });

  it("시나리오 7: 퀵 캡처 시 임베딩이 없는 카테고리가 확정되면 batchEmbedContents 단일 배치 호출로 메모·카테고리 벡터를 동시 생성하고 유사 카테고리 탐지를 트리거해야 한다", async () => {
    let batchInput: string[] | null = null;
    const syncedCategories: Array<{
      id: string;
      name: string;
      dims: number;
    }> = [];

    (aiService as any).batchEmbedContents = async (contents: string[]) => {
      batchInput = contents;
      return [new Array(768).fill(0.3), new Array(768).fill(0.4)];
    };

    const mockCategoryService = {
      hasCategoryEmbedding: async () => false,
      syncCategoryEmbeddingAndDetectSimilar: async (
        id: string,
        name: string,
        vec: number[]
      ) => {
        syncedCategories.push({ id, name, dims: vec.length });
      },
    };

    const memoWithCatService = new MemoService(
      (memoService as any).memoRepository,
      aiService,
      ogpService,
      mockCategoryService as any
    );

    await memoWithCatService.createMemo(owner, {
      id: "018d0000-0000-7000-8000-000000000777",
      content: "@쇼핑 운동화 구매",
    });
    await new Promise((r) => setTimeout(r, 20));

    assert.deepEqual(batchInput, ["운동화 구매", "쇼핑"]);
    assert.deepEqual(syncedCategories, [
      { id: "cat-쇼핑", name: "쇼핑", dims: 768 },
    ]);
    assert.equal(
      repoCalls.updateMemoBackgroundEnrichment.at(-1)?.updates?.embedding?.length,
      768
    );
  });

  it("시나리오 8: searchMemos는 검색어 정제 및 Gemini 벡터 변환 후 하이브리드 검색 결과와 OGP를 직렬화해 반환해야 한다", async () => {
    const queryVec = new Array(768).fill(0.15);
    let embeddedInput: string | null = null;
    (aiService as any).generateEmbedding = async (text: string) => {
      embeddedInput = text;
      return queryVec;
    };

    const results = await memoService.searchMemos(owner, {
      q: "  pgvector   검색 \u0007 ",
      threshold: 0.35,
      limit: 20,
    });

    assert.equal(embeddedInput, "pgvector 검색");
    assert.equal(repoCalls.searchMemosHybrid.length, 1);
    assert.equal(repoCalls.searchMemosHybrid[0].queryText, "pgvector 검색");
    assert.equal(repoCalls.searchMemosHybrid[0].threshold, 0.35);
    assert.equal(repoCalls.searchMemosHybrid[0].limit, 20);
    assert.equal(repoCalls.searchMemosHybrid[0].queryVector.length, 768);

    assert.equal(results.length, 1);
    assert.equal(results[0].ftsScore, 0.8123);
    assert.equal(results[0].vectorScore, 0.9123);
    assert.equal(results[0].finalScore, 0.8723);
    assert.equal(results[0].ogp?.targetUrl, "https://nestjs.com");
    assert.equal(results[0].createdAt, "2026-11-14T10:00:00.000Z");
  });

  it("시나리오 9: searchMemos는 Gemini 임베딩 생성이 null로 실패해도 FTS 단독 폴백 검색을 정상 수행해야 한다", async () => {
    (aiService as any).generateEmbedding = async () => null;

    const results = await memoService.searchMemos(owner, {
      q: "NestJS",
      threshold: 0.3,
      limit: 30,
    });

    assert.equal(repoCalls.searchMemosHybrid[0].queryVector, null);
    assert.equal(results.length, 1);
  });

  it("시나리오 10: getRelatedMemos는 기준 메모의 임베딩 벡터로 1-Depth 연관 메모를 조회하고 반올림된 유사도를 반환해야 한다", async () => {
    const sourceVec = new Array(768).fill(0.25);
    mockMemoRecord = {
      id: "018d0000-0000-7000-8000-000000000500",
      embedding: sourceVec,
      deletedAt: null,
    };

    const related = await memoService.getRelatedMemos(
      owner,
      "018d0000-0000-7000-8000-000000000500",
      { threshold: 0.8, limit: 10 }
    );

    assert.equal(repoCalls.findRelatedMemos.length, 1);
    assert.equal(
      repoCalls.findRelatedMemos[0].sourceMemoId,
      "018d0000-0000-7000-8000-000000000500"
    );
    assert.equal(repoCalls.findRelatedMemos[0].threshold, 0.8);
    assert.equal(related.length, 1);
    assert.equal(related[0].similarity, 0.8843);
    assert.equal(related[0].ogp, null);
  });

  it("시나리오 11: getRelatedMemos는 미존재·휴지통 메모에 대해 404를 던지고, 임베딩이 NULL인 기준 메모는 빈 배열을 반환해야 한다", async () => {
    mockMemoRecord = null;
    await assert.rejects(
      () =>
        memoService.getRelatedMemos(
          owner,
          "018d0000-0000-7000-8000-000000000999",
          { threshold: 0.8, limit: 10 }
        ),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.NOT_FOUND);
        assert.equal(err.errorCode, ERROR_CODES.MEMO_WARN_NOT_FOUND);
        return true;
      }
    );

    mockMemoRecord = {
      id: "018d0000-0000-7000-8000-000000000500",
      embedding: new Array(768).fill(0.1),
      deletedAt: new Date("2026-11-14T00:00:00.000Z"),
    };
    await assert.rejects(
      () =>
        memoService.getRelatedMemos(
          owner,
          "018d0000-0000-7000-8000-000000000500",
          { threshold: 0.8, limit: 10 }
        ),
      (err: any) =>
        err instanceof BusinessException &&
        err.getStatus() === HttpStatus.NOT_FOUND
    );

    mockMemoRecord = {
      id: "018d0000-0000-7000-8000-000000000500",
      embedding: null,
      deletedAt: null,
    };
    const emptyRelated = await memoService.getRelatedMemos(
      owner,
      "018d0000-0000-7000-8000-000000000500",
      { threshold: 0.8, limit: 10 }
    );
    assert.deepEqual(emptyRelated, []);
    assert.equal(repoCalls.findRelatedMemos.length, 0);
  });

  it("시나리오 12: memo.helper 유틸은 검색어 정제, pgvector 직렬화 및 [0, 1] 스코어 클램핑을 안전하게 처리해야 한다", () => {
    assert.equal(sanitizeSearchQuery("  hello\n\tworld  "), "hello world");
    assert.equal(toPgVectorLiteral([0.1, -0.2, 0.3]), "[0.1,-0.2,0.3]");
    assert.throws(() => toPgVectorLiteral([0.1, Number.NaN]));
    assert.equal(clampAndRoundScore(1.0000002), 1);
    assert.equal(clampAndRoundScore(-0.05), 0);
    assert.equal(clampAndRoundScore(0.854321), 0.8543);
  });
});

