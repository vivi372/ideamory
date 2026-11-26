import { z } from "zod";
import { UuidV7Schema } from "./common.schema";
import { OgpResponseSchema } from "./ogp.schema";

/**
 * POST /api/v1/memos/ai-search (내 메모 기반 AI 자연어 RAG 검색 요청 DTO)
 */
export const AiSearchRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "검색 질문을 입력해 주세요.")
    .max(500, "질문은 최대 500자까지 가능합니다."),
});

export type AiSearchRequestDto = z.infer<typeof AiSearchRequestSchema>;

/**
 * AI RAG 브리핑의 1-Depth 근거 메모 항목 DTO
 */
export const AiSearchSourceSchema = z.object({
  id: UuidV7Schema,
  content: z.string(),
  categoryId: UuidV7Schema,
  categoryName: z.string(),
  ogp: OgpResponseSchema.nullable().optional(),
  createdAt: z.string().datetime(),
});

export type AiSearchSourceDto = z.infer<typeof AiSearchSourceSchema>;

/**
 * POST /api/v1/memos/ai-search 응답 DTO
 * - answer: 1행 굵은 결론 요약 + 2~3개 불릿 포인트 마크다운 브리핑
 * - sources: RRF 빈도 가중치 합산으로 선별된 상위 3~5건 근거 메모
 */
export const AiSearchResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(AiSearchSourceSchema),
});

export type AiSearchResponseDto = z.infer<typeof AiSearchResponseSchema>;
