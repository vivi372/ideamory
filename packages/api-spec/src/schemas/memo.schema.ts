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
 * 메모 상세 및 목록 항목 응답 DTO
 */
export const MemoResponseSchema = z.object({
  id: UuidV7Schema,
  content: z.string(),
  categoryId: UuidV7Schema,
  categoryName: z.string(),
  ogpId: UuidV7Schema.nullable().optional(),
  ogp: OgpResponseSchema.nullable().optional(),
  deletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
});

export type MemoResponseDto = z.infer<typeof MemoResponseSchema>;

/**
 * GET /api/memos/search (Gemini 하이브리드 검색 쿼리 DTO)
 */
export const SearchMemoQuerySchema = z.object({
  q: z.string().min(1, "검색어를 입력해 주세요."),
  threshold: z.coerce.number().min(0).max(1).optional().default(0.3),
  limit: z.coerce.number().int().positive().optional().default(30),
});

export type SearchMemoQueryDto = z.infer<typeof SearchMemoQuerySchema>;

/**
 * 하이브리드 검색 결과 응답 DTO (FTS 0.4 + Vector 0.6 가중치 합산)
 */
export const SearchResultResponseSchema = z.object({
  id: UuidV7Schema,
  content: z.string(),
  categoryId: UuidV7Schema,
  categoryName: z.string(),
  ftsScore: z.number(),
  vectorScore: z.number(),
  finalScore: z.number(),
  createdAt: z.string().datetime(),
});

export type SearchResultResponseDto = z.infer<typeof SearchResultResponseSchema>;

/**
 * GET /api/memos/:id/related (관련 메모 1-Depth 필터링 쿼리 DTO)
 */
export const RelatedMemoQuerySchema = z.object({
  threshold: z.coerce.number().min(0).max(1).optional().default(0.8),
  limit: z.coerce.number().int().positive().optional().default(10),
});

export type RelatedMemoQueryDto = z.infer<typeof RelatedMemoQuerySchema>;

