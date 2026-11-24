import { Injectable } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import { z } from "zod";
import {
  ListMemosToolInputSchema,
  type ListMemosToolInput,
  type McpKeyScope,
  type MemoResponseDto,
} from "@ideamory/api-spec";
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
  {
    name: "list_memos",
    description:
      "사용자의 전체 메모 목록을 최신순으로 조회하거나, 특정 카테고리(categoryId 또는 categoryName)에 속한 메모 목록을 필터링 조회합니다.",
    requiredScope: "READ",
    inputSchema: {
      type: "object",
      properties: {
        categoryId: {
          type: "string",
          description: "조회할 카테고리 UUID v7 (선택)",
        },
        categoryName: {
          type: "string",
          description:
            "조회할 카테고리명 직접 지정 (예: 'AI스크랩', '독서') (선택)",
        },
        limit: {
          type: "number",
          description: "한 번에 가져올 메모 수 (기본값: 20, 최대: 50)",
        },
        cursor: {
          type: "string",
          description:
            "커서 기반 페이징 식별자 — createdAt이 아닌 마지막 메모의 id(UUID v7) 전달 (선택)",
        },
      },
    },
  },
];

/**
 * Ideamory Remote MCP(Model Context Protocol) JSON-RPC 2.0 핸들러 서비스입니다.
 * 기존 `MemoService`와 `CategoryService`를 100% 재사용해 5종 도구를 제공합니다.
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
        case "list_memos": {
          const parsed = ListMemosToolInputSchema.parse(rawArgs);
          payload = await this.listMemos(context, parsed);
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

  /**
   * 사용자의 전체 최신순 메모 목록 또는 특정 카테고리(`categoryId` / `categoryName`) 필터링 목록을 조회합니다.
   * `categoryName`이 전달되면 `categoryId`보다 우선해 `CategoryService`로 공백 정규화 일치 카테고리를 매핑하고,
   * 일치하는 카테고리가 없으면 `categoryId`로 폴백하지 않고 즉시 빈 배열을 반환합니다.
   * 또한 `cursor`(마지막 메모의 `id` UUID v7)가 현재 목록에 존재하지 않으면 무한 루프 페이징 방지를 위해 빈 배열을 반환합니다.
   *
   * @param context `McpAuthGuard`가 검증한 소유자 및 권한 컨텍스트
   * @param args `ListMemosToolInputSchema`로 검증된 조회 파라미터
   * @returns `MemoResponseDto[]` 최신순 메모 목록
   * @throws BusinessException `CategoryService.getCategories` 또는 `MemoService.getMemos` 내부의 `assertOwnerIdentity` 검증 실패 시 401 Unauthorized 전파
   */
  private async listMemos(
    context: VerifiedMcpContext,
    args: ListMemosToolInput,
  ): Promise<MemoResponseDto[]> {
    let resolvedCategoryId = args.categoryId;

    if (args.categoryName) {
      const categories = await this.categoryService.getCategories(context.owner);
      const normalize = (name: string) =>
        typeof this.categoryService.normalizeCategoryName === "function"
          ? this.categoryService.normalizeCategoryName(name)
          : name.trim().replace(/\s+/g, "").toLowerCase();

      const targetNormalized = normalize(args.categoryName);
      const matched = categories.find(
        (category) => normalize(category.name) === targetNormalized,
      );

      if (!matched) {
        return [];
      }

      resolvedCategoryId = matched.id;
    }

    const memos = await this.memoService.getMemos(context.owner, {
      categoryId: resolvedCategoryId,
      deleted: false,
    });

    let startIndex = 0;
    if (args.cursor) {
      const cursorIndex = memos.findIndex((memo) => memo.id === args.cursor);
      if (cursorIndex < 0) {
        return [];
      }
      startIndex = cursorIndex + 1;
    }

    return memos.slice(startIndex, startIndex + args.limit);
  }
}
