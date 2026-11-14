import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  CreateMemoSchema,
  GetMemosQuerySchema,
  SearchMemoQuerySchema,
  RelatedMemoQuerySchema,
  ParseOgpSchema,
  UuidV7Schema,
  type CreateMemoDto,
  type GetMemosQueryDto,
  type SearchMemoQueryDto,
  type RelatedMemoQueryDto,
  type ParseOgpDto,
} from "@ideamory/api-spec";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { BusinessException } from "../../common/exceptions/business.exception";
import { MemoController } from "./memo.controller";
import { MemoService } from "./memo.service";
import { OgpController } from "../ogp/ogp.controller";
import { OgpService } from "../ogp/ogp.service";

describe("MemoController & OgpController (REST 라우트, Zod 파이프 및 204 No Content 검증)", () => {
  let memoController: MemoController;
  let ogpController: OgpController;
  let serviceCalls: Record<string, any[]>;

  const mockUser = {
    userId: "999e4567-e89b-12d3-a456-426614174999",
    isGuest: false,
  };

  beforeEach(() => {
    serviceCalls = {
      createMemo: [],
      getMemos: [],
      updateMemo: [],
      softDeleteMemo: [],
      restoreMemo: [],
      searchMemos: [],
      getRelatedMemos: [],
      parseAndCacheOgp: [],
    };

    const mockMemoService: Partial<MemoService> = {
      createMemo: async (owner, dto) => {
        serviceCalls.createMemo.push({ owner, dto });
        return {
          id: dto.id,
          content: dto.content,
          categoryId: "018d0000-0000-7000-8000-000000000002",
          categoryName: "미분류",
          ogpId: null,
          ogp: null,
          deletedAt: null,
          createdAt: "2026-11-13T05:00:00.000Z",
        };
      },
      getMemos: async (owner, query) => {
        serviceCalls.getMemos.push({ owner, query });
        return [];
      },
      updateMemo: async (owner, id, dto) => {
        serviceCalls.updateMemo.push({ owner, id, dto });
        return {
          id,
          content: dto.content ?? "원본",
          categoryId: dto.categoryId ?? "018d0000-0000-7000-8000-000000000002",
          categoryName: "개발",
          ogpId: null,
          ogp: null,
          deletedAt: null,
          createdAt: "2026-11-13T05:00:00.000Z",
        };
      },
      softDeleteMemo: async (owner, id) => {
        serviceCalls.softDeleteMemo.push({ owner, id });
      },
      restoreMemo: async (owner, id) => {
        serviceCalls.restoreMemo.push({ owner, id });
        return {
          id,
          content: "복구 메모",
          categoryId: "018d0000-0000-7000-8000-000000000002",
          categoryName: "개발",
          ogpId: null,
          ogp: null,
          deletedAt: null,
          createdAt: "2026-11-13T05:00:00.000Z",
        };
      },
      searchMemos: async (owner, query) => {
        serviceCalls.searchMemos.push({ owner, query });
        return [];
      },
      getRelatedMemos: async (owner, id, query) => {
        serviceCalls.getRelatedMemos.push({ owner, id, query });
        return [];
      },
    };

    const mockOgpService: Partial<OgpService> = {
      parseAndCacheOgp: async (url) => {
        serviceCalls.parseAndCacheOgp.push(url);
        return {
          id: "018d0000-0000-7000-8000-000000000099",
          targetUrl: url,
          title: "Example",
          thumbnailUrl: null,
          description: null,
          expiresAt: "2026-11-27T05:00:00.000Z",
        };
      },
    };

    memoController = new MemoController(mockMemoService as MemoService);
    ogpController = new OgpController(mockOgpService as OgpService);
  });

  it("시나리오 1: POST /v1/memos는 CreateMemoSchema 검증 후 createMemo를 호출하고 201 응답 DTO를 반환해야 한다", async () => {
    const pipe = new ZodValidationPipe(CreateMemoSchema);
    const validDto = pipe.transform(
      {
        id: "018d0000-0000-7000-8000-000000000001",
        content: "퀵 캡처 테스트",
      },
      { type: "body" }
    ) as CreateMemoDto;

    const res = await memoController.createMemo(mockUser, validDto);
    assert.equal(res.id, "018d0000-0000-7000-8000-000000000001");
    assert.equal(serviceCalls.createMemo.length, 1);

    assert.throws(
      () => pipe.transform({ id: "bad-uuid", content: "" }, { type: "body" }),
      (err: any) => err instanceof BusinessException
    );
  });

  it("시나리오 2: GET /v1/memos 및 PATCH /v1/memos/:id는 쿼리/파라미터/바디를 서비스로 위임해야 한다", async () => {
    const queryPipe = new ZodValidationPipe(GetMemosQuerySchema);
    const parsedQuery = queryPipe.transform(
      { deleted: "true" },
      { type: "query" }
    ) as GetMemosQueryDto;
    await memoController.getMemos(mockUser, parsedQuery);
    assert.equal(serviceCalls.getMemos[0].query.deleted, true);

    const memoId = "018d0000-0000-7000-8000-000000000001";
    const updated = await memoController.updateMemo(mockUser, memoId, {
      content: "인라인 수정 완료",
    });
    assert.equal(updated.content, "인라인 수정 완료");
  });

  it("시나리오 3: DELETE /v1/memos/:id는 응답 본문 없이 undefined를 반환해야 한다 (204 No Content)", async () => {
    const memoId = "018d0000-0000-7000-8000-000000000001";
    const result = await memoController.softDeleteMemo(mockUser, memoId);

    assert.equal(result, undefined);
    assert.equal(serviceCalls.softDeleteMemo[0].id, memoId);
  });

  it("시나리오 4: POST /v1/memos/:id/restore는 복구된 메모 DTO를 반환해야 한다", async () => {
    const memoId = "018d0000-0000-7000-8000-000000000001";
    const restored = await memoController.restoreMemo(mockUser, memoId);

    assert.equal(restored.id, memoId);
    assert.equal(restored.deletedAt, null);
  });

  it("시나리오 5: POST /v1/ogp/parse는 ParseOgpSchema 검증 후 parseAndCacheOgp를 호출해야 한다", async () => {
    const pipe = new ZodValidationPipe(ParseOgpSchema);
    const dto = pipe.transform(
      { url: "https://nextjs.org" },
      { type: "body" }
    ) as ParseOgpDto;
    const result = await ogpController.parseOgp(dto);

    assert.equal(result.targetUrl, "https://nextjs.org");
    assert.equal(serviceCalls.parseAndCacheOgp[0], "https://nextjs.org");
  });

  it("시나리오 6: GET /v1/memos/search는 SearchMemoQuerySchema 기본값·검증 후 searchMemos를 호출해야 한다", async () => {
    const queryPipe = new ZodValidationPipe(SearchMemoQuerySchema);
    const validQuery = queryPipe.transform(
      { q: "  pgvector 하이브리드  " },
      { type: "query" }
    ) as SearchMemoQueryDto;

    await memoController.searchMemos(mockUser, validQuery);
    assert.equal(serviceCalls.searchMemos.length, 1);
    assert.deepEqual(serviceCalls.searchMemos[0].query, {
      q: "pgvector 하이브리드",
      threshold: 0.3,
      limit: 30,
    });

    // 공백 전용 검색어 및 limit 100 초과 차단 검증
    assert.throws(
      () => queryPipe.transform({ q: "   " }, { type: "query" }),
      (err: any) => err instanceof BusinessException
    );
    assert.throws(
      () => queryPipe.transform({ q: "검색", limit: "101" }, { type: "query" }),
      (err: any) => err instanceof BusinessException
    );
  });

  it("시나리오 7: GET /v1/memos/:id/related는 UUID v7 및 RelatedMemoQuerySchema 기본값 검증 후 getRelatedMemos를 호출해야 한다", async () => {
    const paramPipe = new ZodValidationPipe(UuidV7Schema);
    const queryPipe = new ZodValidationPipe(RelatedMemoQuerySchema);
    const memoId = paramPipe.transform(
      "018d0000-0000-7000-8000-000000000001",
      { type: "param" }
    ) as string;
    const validQuery = queryPipe.transform({}, { type: "query" }) as RelatedMemoQueryDto;

    await memoController.getRelatedMemos(mockUser, memoId, validQuery);
    assert.equal(serviceCalls.getRelatedMemos.length, 1);
    assert.equal(serviceCalls.getRelatedMemos[0].id, memoId);
    assert.deepEqual(serviceCalls.getRelatedMemos[0].query, {
      threshold: 0.8,
      limit: 10,
    });
  });
});
