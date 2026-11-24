import { z } from "zod";

/**
 * MCP API 키 허용 권한(Scope) 열거 스키마입니다.
 * - READ: 전체/카테고리별 메모 조회(list_memos), 메모 검색, 연관 메모 조회, 카테고리 목록 조회
 * - WRITE: MCP를 통한 신규 메모 캡처 생성
 */
export const McpKeyScopeSchema = z.enum(["READ", "WRITE"]);

export type McpKeyScope = z.infer<typeof McpKeyScopeSchema>;

/**
 * POST /api/v1/mcp-keys 요청 바디 DTO입니다.
 * `fixedCategoryName`은 공백·이모지를 제외한 1~10자 문자열만 허용합니다.
 */
export const CreateMcpKeySchema = z.object({
  scopes: z
    .array(McpKeyScopeSchema)
    .min(1, "최소 1개 이상의 권한(READ 또는 WRITE)을 선택해 주세요."),
  fixedCategoryName: z
    .string()
    .trim()
    .min(1, "고정 카테고리 이름은 1자 이상이어야 합니다.")
    .max(10, "고정 카테고리 이름은 최대 10자까지 입력할 수 있습니다.")
    .regex(
      /^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ_-]+$/,
      "고정 카테고리 이름에는 공백이나 이모지, 특수문자를 사용할 수 없습니다.",
    )
    .optional(),
});

export type CreateMcpKeyDto = z.infer<typeof CreateMcpKeySchema>;

/**
 * POST /api/v1/mcp-keys 응답 DTO (201 Created)입니다.
 * 원문 `apiKey`는 발급 시점에만 1회성으로 반환됩니다.
 */
export const McpKeyCreatedResponseSchema = z.object({
  apiKey: z.string(),
  scopes: z.array(McpKeyScopeSchema),
  fixedCategoryName: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type McpKeyCreatedResponseDto = z.infer<
  typeof McpKeyCreatedResponseSchema
>;

/**
 * GET /api/v1/mcp-keys 상태 조회 응답 DTO (200 OK)입니다.
 */
export const McpKeyStatusResponseSchema = z.object({
  hasKey: z.boolean(),
  keyPrefix: z.string().nullable(),
  scopes: z.array(McpKeyScopeSchema),
  fixedCategoryName: z.string().nullable(),
  createdAt: z.string().datetime().nullable(),
  lastUsedAt: z.string().datetime().nullable(),
});

export type McpKeyStatusResponseDto = z.infer<
  typeof McpKeyStatusResponseSchema
>;

/**
 * MCP `list_memos` 도구 입력 파라미터 스키마입니다.
 * 전체 최신순 목록 조회 또는 `categoryId`/`categoryName` 기반 카테고리 필터링 조회를 지원합니다.
 *
 * @param categoryId 조회할 카테고리 UUID v7 (선택)
 * @param categoryName 조회할 카테고리명 직접 지정 (선택, 공백 정규화 비교)
 * @param limit 한 번에 가져올 메모 수 (기본값: 20, 최대: 50)
 * @param cursor 커서 기반 페이징 식별자 (선택)
 */
export const ListMemosToolInputSchema = z.object({
  categoryId: z.string().uuid().optional(),
  categoryName: z.string().trim().min(1).max(30).optional(),
  limit: z.number().int().positive().max(50).default(20),
  cursor: z.string().trim().min(1).optional(),
});

export type ListMemosToolInput = z.infer<typeof ListMemosToolInputSchema>;
