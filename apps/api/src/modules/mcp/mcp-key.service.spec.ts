import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HttpStatus } from "@nestjs/common";
import { CreateMcpKeySchema } from "@ideamory/api-spec";
import { BusinessException } from "../../common/exceptions/business.exception";
import { McpKeyService } from "./mcp-key.service";
import { McpServerService } from "./mcp-server.service";

describe("McpKeyService & McpServerService", () => {
  it("issueKey는 idm_live_ 접두어 원문 키를 1회 반환하고 DB에는 SHA-256 해시만 저장해야 한다", async () => {
    let savedParams: any = null;
    const mockRepo = {
      upsertKeyForOwner: async (params: any) => {
        savedParams = params;
        return {
          ...params,
          createdAt: new Date("2026-11-24T00:00:00.000Z"),
          updatedAt: new Date("2026-11-24T00:00:00.000Z"),
        };
      },
    } as any;

    const service = new McpKeyService(mockRepo);
    const result = await service.issueKey(
      { userId: "018d0000-0000-7000-8000-000000000001" },
      { scopes: ["READ", "WRITE"], fixedCategoryName: "아이디어" },
    );

    assert.ok(result.apiKey.startsWith("idm_live_"));
    assert.equal(result.apiKey.length, 41);
    assert.equal(savedParams.keyHash, service.hashApiKey(result.apiKey));
    assert.notEqual(savedParams.keyHash, result.apiKey);
    assert.equal(savedParams.fixedCategoryName, "아이디어");
  });

  it("getKeyStatus는 원문 키를 절대 노출하지 않고 메타데이터만 반환하며 revokeKey는 삭제를 호출해야 한다", async () => {
    let revoked = false;
    const mockRepo = {
      findByOwner: async () => ({
        id: "018d0000-0000-7000-8000-000000000010",
        keyPrefix: "idm_live_1234...",
        keyHash: "secret-hash",
        scopes: ["READ"],
        fixedCategoryName: null,
        createdAt: new Date("2026-11-24T00:00:00.000Z"),
        lastUsedAt: null,
      }),
      deleteByOwner: async () => {
        revoked = true;
        return 1;
      },
    } as any;

    const service = new McpKeyService(mockRepo);
    const status = await service.getKeyStatus({
      userId: "018d0000-0000-7000-8000-000000000001",
    });

    assert.equal(status.hasKey, true);
    assert.equal(status.keyPrefix, "idm_live_1234...");
    assert.equal("apiKey" in status, false);
    assert.equal("keyHash" in status, false);

    await service.revokeKey({
      userId: "018d0000-0000-7000-8000-000000000001",
    });
    assert.equal(revoked, true);
  });

  it("verifyBearerToken은 잘못된 형식이나 미등록 토큰에 401 BusinessException을 발생시켜야 한다", async () => {
    const mockRepo = {
      findByKeyHash: async () => null,
    } as any;
    const service = new McpKeyService(mockRepo);

    await assert.rejects(
      () => service.verifyBearerToken("invalid_token"),
      (err: any) =>
        err instanceof BusinessException &&
        err.getStatus() === HttpStatus.UNAUTHORIZED,
    );

    await assert.rejects(
      () => service.verifyBearerToken("idm_live_00000000000000000000000000000000"),
      (err: any) =>
        err instanceof BusinessException &&
        err.getStatus() === HttpStatus.UNAUTHORIZED,
    );
  });

  it("CreateMcpKeySchema는 빈 scopes 또는 10자 초과 fixedCategoryName을 차단해야 한다", () => {
    assert.equal(CreateMcpKeySchema.safeParse({ scopes: [] }).success, false);
    assert.equal(
      CreateMcpKeySchema.safeParse({
        scopes: ["READ"],
        fixedCategoryName: "열글자가넘는카테고리이름",
      }).success,
      false,
    );
    assert.equal(
      CreateMcpKeySchema.safeParse({
        scopes: ["READ", "WRITE"],
        fixedCategoryName: "AI캡처",
      }).success,
      true,
    );
  });

  it("McpServerService는 권한 필터링, fixedCategoryName 전달, search(0.65)/related(0.75)/categories를 정확히 호출해야 한다", async () => {
    const capturedCalls: any[] = [];
    const mockMemoService = {
      createMemo: async (owner: any, dto: any, options: any) => {
        capturedCalls.push({ type: "create", owner, dto, options });
        return { id: dto.id, content: dto.content, categoryName: options.fixedCategoryName };
      },
      searchMemos: async (_owner: any, query: any) => {
        capturedCalls.push({ type: "search", query });
        return [];
      },
      getRelatedMemos: async (_owner: any, memoId: string, query: any) => {
        capturedCalls.push({ type: "related", memoId, query });
        return [];
      },
    } as any;
    const mockCategoryService = {
      getCategories: async () => {
        capturedCalls.push({ type: "categories" });
        return [];
      },
    } as any;

    const mcpServer = new McpServerService(mockMemoService, mockCategoryService);
    const readOnlyCtx = {
      keyId: "key-1",
      owner: { userId: "018d0000-0000-7000-8000-000000000001" },
      scopes: ["READ" as const],
      fixedCategoryName: "개발",
    };

    const listRes = await mcpServer.handleJsonRpc(readOnlyCtx, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    const tools = (listRes?.result as any).tools;
    assert.equal(tools.some((t: any) => t.name === "create_memo"), false);
    assert.equal(tools.some((t: any) => t.name === "search_memos"), true);

    const deniedRes = await mcpServer.handleJsonRpc(readOnlyCtx, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "create_memo", arguments: { content: "테스트" } },
    });
    assert.equal((deniedRes?.result as any).isError, true);

    await mcpServer.handleJsonRpc(readOnlyCtx, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "search_memos", arguments: { query: "리액트" } },
    });
    await mcpServer.handleJsonRpc(readOnlyCtx, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "get_related_memos",
        arguments: { memoId: "018d0000-0000-7000-8000-000000000500" },
      },
    });
    await mcpServer.handleJsonRpc(readOnlyCtx, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "list_categories", arguments: {} },
    });

    const writeCtx = { ...readOnlyCtx, scopes: ["READ" as const, "WRITE" as const] };
    await mcpServer.handleJsonRpc(writeCtx, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "create_memo", arguments: { content: "MCP 캡처 테스트" } },
    });

    assert.equal(capturedCalls.find((c) => c.type === "search")?.query.threshold, 0.65);
    assert.equal(capturedCalls.find((c) => c.type === "related")?.query.threshold, 0.75);
    assert.equal(capturedCalls.some((c) => c.type === "categories"), true);
    assert.equal(capturedCalls.find((c) => c.type === "create")?.options.fixedCategoryName, "개발");

    const notifRes = await mcpServer.handleJsonRpc(readOnlyCtx, {
      jsonrpc: "2.0",
      method: "notifications/cancelled",
    });
    assert.equal(notifRes, null);
  });
});
