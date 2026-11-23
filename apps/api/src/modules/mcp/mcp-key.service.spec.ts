import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

  it("McpServerService는 권한(READ/WRITE)에 따라 도구를 필터링하고 create_memo 시 fixedCategoryName을 전달해야 한다", async () => {
    const capturedCalls: any[] = [];
    const mockMemoService = {
      createMemo: async (owner: any, dto: any, options: any) => {
        capturedCalls.push({ owner, dto, options });
        return { id: dto.id, content: dto.content, categoryName: options.fixedCategoryName };
      },
    } as any;
    const mockCategoryService = {} as any;

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

    const writeCtx = { ...readOnlyCtx, scopes: ["READ" as const, "WRITE" as const] };
    await mcpServer.handleJsonRpc(writeCtx, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "create_memo", arguments: { content: "MCP 캡처 테스트" } },
    });
    assert.equal(capturedCalls.length, 1);
    assert.equal(capturedCalls[0].options.fixedCategoryName, "개발");
  });
});
