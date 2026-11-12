import { z } from "zod";
import { UuidV7Schema } from "./common.schema";

/**
 * POST /api/ogp/parse (대표 URL 메타데이터 파싱 요청)
 */
export const ParseOgpSchema = z.object({
  url: z
    .string()
    .url("올바른 URL 형식이어야 합니다.")
    .regex(/^https?:\/\//i, "http 또는 https 프로토콜만 지원합니다."),
});

export type ParseOgpDto = z.infer<typeof ParseOgpSchema>;

/**
 * 공유 OGP 캐시 메타데이터 응답 DTO 스키마
 */
export const OgpResponseSchema = z.object({
  id: UuidV7Schema,
  targetUrl: z.string().url(),
  title: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  description: z.string().nullable(),
  expiresAt: z.string().datetime(),
  fetchedAt: z.string().datetime().optional(),
});

export type OgpResponseDto = z.infer<typeof OgpResponseSchema>;

