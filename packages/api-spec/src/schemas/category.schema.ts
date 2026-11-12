import { z } from "zod";
import { UuidV7Schema } from "./common.schema";

/**
 * 이모지 배제 정규식
 * 미니멀 Text-Only 원칙 및 LLM 토큰 효율화를 위해 카테고리명에서 이모지를 전면 차단
 */
export const NO_EMOJI_REGEX = /^[^\p{Extended_Pictographic}]+$/u;

/**
 * POST /api/categories (신규 카테고리 생성 요청 DTO)
 */
export const CreateCategorySchema = z.object({
  id: UuidV7Schema,
  name: z
    .string()
    .trim()
    .min(1, "카테고리명은 1자 이상이어야 합니다.")
    .max(10, "카테고리명은 최대 10자까지 허용됩니다.")
    .regex(NO_EMOJI_REGEX, "카테고리명에는 이모지를 포함할 수 없습니다."),
});

export type CreateCategoryDto = z.infer<typeof CreateCategorySchema>;

/**
 * PATCH /api/categories/:id (카테고리명 수정 요청 DTO)
 */
export const UpdateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "카테고리명은 1자 이상이어야 합니다.")
    .max(10, "카테고리명은 최대 10자까지 허용됩니다.")
    .regex(NO_EMOJI_REGEX, "카테고리명에는 이모지를 포함할 수 없습니다."),
});

export type UpdateCategoryDto = z.infer<typeof UpdateCategorySchema>;

/**
 * 카테고리 응답 DTO
 */
export const CategoryResponseSchema = z.object({
  id: UuidV7Schema,
  name: z.string(),
  memoCount: z.number().int().nonnegative().optional(),
});

export type CategoryResponseDto = z.infer<typeof CategoryResponseSchema>;

/**
 * POST /api/categories/merge (의미론적 유사 카테고리 통합 요청 DTO)
 */
export const MergeCategorySchema = z.object({
  sourceCategoryId: UuidV7Schema, // 삭제될 원본 카테고리 ID
  targetCategoryId: UuidV7Schema, // 병합 대상 타깃 카테고리 ID
});

export type MergeCategoryDto = z.infer<typeof MergeCategorySchema>;

/**
 * 카테고리 통합 결과 응답 DTO
 */
export const MergeCategoryResponseSchema = z.object({
  success: z.boolean(),
  affectedMemosCount: z.number().int().nonnegative().optional(),
});

export type MergeCategoryResponseDto = z.infer<typeof MergeCategoryResponseSchema>;

