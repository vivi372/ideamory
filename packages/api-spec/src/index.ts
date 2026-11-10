import { z } from "zod";

/**
 * 0단계 기본 DTO 및 스키마 스켈레톤 (Single Source of Truth)
 */

// 메모 생성 DTO 스키마
export const CreateMemoSchema = z.object({
  content: z.string().min(1, "메모 본문을 입력해 주세요.").max(2000, "메모는 최대 2000자까지 가능합니다."),
  categoryName: z.string().optional()
});

export type CreateMemoDto = z.infer<typeof CreateMemoSchema>;

// 공통 표준 에러 응답 규격
export const ErrorResponseSchema = z.object({
  statusCode: z.number(),
  errorCode: z.string(), // [도메인]_[UX태그]_[상세원인]
  message: z.string(),
  traceId: z.string(),
  timestamp: z.string()
});

export type ErrorResponseDto = z.infer<typeof ErrorResponseSchema>;

