import { Injectable } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import type { McpKeyScope } from "@ideamory/api-spec";
import { CategoryService } from "../category/category.service";
import { MemoService } from "../memo/memo.service";
import type { VerifiedMcpContext } from "./mcp-key.service";

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface McpToolDefinition {
  name: string;
  description: string;
  requiredScope: McpKeyScope;
  inputSchema: Record<string, unknown>;
}

const SearchMemosArgsSchema = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().positive().max(50).optional(),
});

const CreateMemoArgsSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

const GetRelatedMemosArgsSchema = z.object({
  memoId: z.string().uuid(),
  threshold: z.number().min(0).max(1).optional(),
});

const MCP_TOOLS: readonly McpToolDefinition[] = [
  {
    name: "search_memos",
    description:
      "Ideamory 메모를 Tier 1 키워드 우선 + Tier 2 코사인 유사도(0.65+) 하이브리드 검색으로 조회합니다.",
    requiredScope: "READ",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "검색할 키워드 또는 문장" },
        limit: {
          type: "number",
          description: "최대 반환 건수 (기본 30, 최대 50)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_memo",
    description:
      "Ideamory에 새 메모를 0.1초 퀵 캡처로 저장합니다. 키에 고정 카테고리가 설정된 경우 해당 카테고리로 즉시 저장됩니다.",
    requiredScope: "WRITE",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "저장할 메모 본문 (1~5000자)",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "get_related_memos",
    description:
      "특정 메모 ID를 기준으로 코사인 유사도 0.75 이상의 1-Depth 연관 메모를 조회합니다.",
    requiredScope: "READ",
    inputSchema: {
      type: "object",
      properties: {
        memoId: { type: "string", description: "기준 메모 UUID v7" },
        threshold: {
          type: "number",
          description: "최소 코사인 유사도 (기본 0.75)",
        },
      },
      required: ["memoId"],
    },
  },
  {
    name: "list_categories",
    description: "사용자의 활성 메모가 1건 이상 존재하는 카테고리 목록을 조회합니다.",
    requiredScope: "READ",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

/**
 * Ideamory Remote MCP(Model Context Protocol) JSON-RPC 2.0 핸들러 서비스입니다.
 * 기존 `MemoService`와 `CategoryService`를 100% 재사용해 4종 도구를 제공합니다.
 */
@Injectable()
export class McpServerService {
  constructor(
    private readonly memoService: MemoService,
    private readonly categoryService: CategoryService,
  ) {}

  /**
   * 단일 MCP JSON-RPC 2.0 요청을 처리하고 표준 응답을 반환합니다.
   *
   * @param context `McpAuthGuard`가 검증한 소유자, 권한, 고정 카테고리 컨텍스트
   * @param body JSON-RPC 요청 객체
   * @returns JSON-RPC 응답 객체 (알림 요청인 경우 null)
   */
  async handleJsonRpc(
    context: VerifiedMcpContext,
    body: JsonRpcRequest,
  ): Promise<JsonRpcResponse | null> {
    if (body.method?.startsWith("notifications/")) {
      return null;
    }

    if (body.id === undefined) {
      return {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32600,
          message: "유효하지 않은 JSON-RPC 요청입니다: id가 누락되었습니다.",
        },
      };
    }

    const id = body.id ?? null;

    if (body.method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "ideamory-mcp",
            version: "1.0.0",
          },
        },
      };
    }

    if (body.method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }

    if (body.method === "tools/list") {
      const allowedTools = MCP_TOOLS.filter((tool) =>
        context.scopes.includes(tool.requiredScope),
      ).map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      }));
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: allowedTools },
      };
    }

    if (body.method === "tools/call") {
      const toolName =
        typeof body.params?.name === "string" ? body.params.name : "";
      const rawArgs =
        body.params?.arguments && typeof body.params.arguments === "object"
          ? (body.params.arguments as Record<string, unknown>)
          : {};

      return this.executeToolCall(id, context, toolName, rawArgs);
    }

    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: `지원하지 않는 MCP 메서드입니다: ${body.method}`,
      },
    };
  }

  /**
   * 권한(Scope)과 인자 스키마를 검증한 뒤 해당 도메인 서비스를 호출합니다.
   */
  private async executeToolCall(
    id: string | number | null,
    context: VerifiedMcpContext,
    toolName: string,
    rawArgs: Record<string, unknown>,
  ): Promise<JsonRpcResponse> {
    const toolDef = MCP_TOOLS.find((tool) => tool.name === toolName);
    if (!toolDef) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: `알 수 없는 도구입니다: ${toolName}` },
      };
    }

    if (!context.scopes.includes(toolDef.requiredScope)) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: `권한 부족: '${toolName}' 도구 실행에는 ${toolDef.requiredScope} 권한이 필요합니다.`,
            },
          ],
        },
      };
    }

    try {
      let payload: unknown;

      switch (toolName) {
        case "search_memos": {
          const parsed = SearchMemosArgsSchema.parse(rawArgs);
          payload = await this.memoService.searchMemos(context.owner, {
            q: parsed.query,
            threshold: 0.65,
            limit: parsed.limit ?? 30,
          });
          break;
        }
        case "create_memo": {
          const parsed = CreateMemoArgsSchema.parse(rawArgs);
          payload = await this.memoService.createMemo(
            context.owner,
            {
              id: uuidv7(),
              content: parsed.content,
            },
            {
              fixedCategoryName: context.fixedCategoryName,
            },
          );
          break;
        }
        case "get_related_memos": {
          const parsed = GetRelatedMemosArgsSchema.parse(rawArgs);
          payload = await this.memoService.getRelatedMemos(
            context.owner,
            parsed.memoId,
            {
              threshold: parsed.threshold ?? 0.75,
              limit: 10,
            },
          );
          break;
        }
        case "list_categories": {
          payload = await this.categoryService.getCategories(context.owner);
          break;
        }
      }

      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(payload, null, 2),
            },
          ],
        },
      };
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text:
                error instanceof Error
                  ? error.message
                  : "MCP 도구 실행 중 오류가 발생했습니다.",
            },
          ],
        },
      };
    }
  }
}
