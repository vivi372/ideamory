import { z } from "zod";
import { UuidV7Schema } from "./common.schema";
import { OgpResponseSchema } from "./ogp.schema";

/**
 * POST /api/memos (메모 0.1초 퀵 캡처 요청 DTO)
 * 백엔드 DTO/컨트롤러 레이어에서 UUID v7 식별자를 선발급하여 주입받음
 */
export const CreateMemoSchema = z.object({
  id: UuidV7Schema,
  content: z
    .string()
    .min(1, "메모 내용을 입력해 주세요.")
    .max(5000, "메모는 최대 5000자까지 작성할 수 있습니다."),
});

export type CreateMemoDto = z.infer<typeof CreateMemoSchema>;

/**
 * PATCH /api/memos/:id (인라인 본문 수정 & 수동 카테고리 변경 요청 DTO)
 */
export const UpdateMemoSchema = z.object({
  content: z
    .string()
    .min(1, "메모 내용은 1자 이상이어야 합니다.")
    .max(5000, "메모는 최대 5000자까지 작성할 수 있습니다.")
    .optional(),
  categoryId: UuidV7Schema.optional(),
});

export type UpdateMemoDto = z.infer<typeof UpdateMemoSchema>;

/**
 * GET /api/memos (메인 타임라인 메모 목록 조회 쿼리 DTO)
 * 카테고리 필터링 및 30일 휴지통(Soft Delete) 조회 플래그
 */
export const GetMemosQuerySchema = z.object({
  categoryId: UuidV7Schema.optional(),
  deleted: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .optional()
    .default(false),
});

export type GetMemosQueryDto = z.infer<typeof GetMemosQuerySchema>;

/**
 * 메모 비동기 AI 카테고리 분류 상태 스키마
 * - PENDING: 백그라운드 AI 분류 진행 중 (카테고리 수정 비활성화)
 * - COMPLETED: AI 분류 완료 또는 수동 카테고리 지정 완료
 * - FAILED: AI 분류 실패/타임아웃 ('미분류' 확정)
 */
export const MemoAiStatusSchema = z.enum(["PENDING", "COMPLETED", "FAILED"]);

export type MemoAiStatus = z.infer<typeof MemoAiStatusSchema>;

/**
 * 메모 상세 및 목록 항목 응답 DTO
 */
export const MemoResponseSchema = z.object({
  id: UuidV7Schema,
  content: z.string(),
  categoryId: UuidV7Schema,
  categoryName: z.string(),
  aiStatus: MemoAiStatusSchema.optional(),
  ogpId: UuidV7Schema.nullable().optional(),
  ogp: OgpResponseSchema.nullable().optional(),
  relatedCount: z.number().int().nonnegative().optional(),
  deletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type MemoResponseDto = z.infer<typeof MemoResponseSchema>;

/**
 * GET /api/v1/memos/search (Gemini 하이브리드 검색 쿼리 DTO)
 * 타이핑 도중 실시간 API 호출을 방지하고 [엔터]/[검색] 시에만 명시적 호출합니다.
 */
export const SearchMemoQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, "검색어를 입력해 주세요.")
    .max(500, "검색어는 최대 500자까지 입력할 수 있습니다."),
  threshold: z.coerce.number().min(0).max(1).optional().default(0.65),
  limit: z.coerce.number().int().positive().max(100).optional().default(30),
});

export type SearchMemoQueryDto = z.infer<typeof SearchMemoQuerySchema>;

/**
 * 하이브리드 검색 결과 응답 DTO (Tier 1 키워드 우선 + Tier 2 코사인 유사도 0.65 이상 보완 랭킹)
 */
export const SearchResultResponseSchema = z.object({
  id: UuidV7Schema,
  content: z.string(),
  categoryId: UuidV7Schema,
  categoryName: z.string(),
  ftsScore: z.number(),
  vectorScore: z.number(),
  finalScore: z.number(),
  ogp: OgpResponseSchema.nullable().optional(),
  createdAt: z.string().datetime(),
});

export type SearchResultResponseDto = z.infer<typeof SearchResultResponseSchema>;

/**
 * GET /api/v1/memos/:id/related (관련 메모 1-Depth 필터링 쿼리 DTO)
 */
export const RelatedMemoQuerySchema = z.object({
  threshold: z.coerce.number().min(0).max(1).optional().default(0.75),
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
});

export type RelatedMemoQueryDto = z.infer<typeof RelatedMemoQuerySchema>;

/**
 * 관련 메모 1-Depth 추천 결과 응답 DTO (코사인 유사도 0.75 이상)
 */
export const RelatedMemoResponseSchema = z.object({
  id: UuidV7Schema,
  content: z.string(),
  categoryId: UuidV7Schema,
  categoryName: z.string(),
  similarity: z.number(),
  ogp: OgpResponseSchema.nullable().optional(),
  createdAt: z.string().datetime(),
});

export type RelatedMemoResponseDto = z.infer<typeof RelatedMemoResponseSchema>;

