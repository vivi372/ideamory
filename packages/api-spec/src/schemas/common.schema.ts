import { z } from "zod";

/**
 * UUID v7 정규식 검증 스키마
 * 시간순 정렬(48비트 타임스탬프) 기반의 애플리케이션 선발급 식별자
 */
export const UuidV7Schema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "올바른 UUID v7 형식이어야 합니다."
  );

/**
 * W3C / Sentry 표준 호환 32자리 16진수 Trace ID 스키마
 */
export const TraceIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{32}$/, "Trace ID는 32자리 16진수 문자열이어야 합니다.");

/**
 * UX 태그 에러 자동 분류 규격
 * 프론트엔드 UI 컴포넌트(인풋 하이라이팅, 토스트, 다이얼로그 등)가 인터랙션을 자동 분기 렌더링하기 위한 태그
 */
export const UxTagSchema = z.enum([
  "FIELD",   // 입력 폼 인풋 테두리 Red 하이라이팅 및 에러 캡션 바인딩
  "INFO",    // Radix UI Toast 기본 알림
  "WARN",    // Radix UI Toast 경고 알림
  "ERROR",   // Radix UI Toast 에러 알림
  "ALERT",   // Radix UI Dialog 1-Button 확인 안내 모달
  "CONFIRM", // Radix UI Dialog 2-Button 파괴적 확인 모달
  "FATAL",   // 풀스크린 시스템 장애 오버레이 모달
]);

export type UxTag = z.infer<typeof UxTagSchema>;

/**
 * 공통 표준 에러 응답 DTO 스키마
 * [도메인]_[UX태그]_[상세원인] 포맷을 따르는 전역 에러 응답 규격
 */
export const ErrorResponseSchema = z.object({
  statusCode: z.number().int(),
  errorCode: z.string(), // 예: MEMO_FIELD_REQUIRED, AUTH_ALERT_SESSION_EXPIRED
  message: z.string(),
  traceId: TraceIdSchema,
  timestamp: z.string().datetime(),
});

export type ErrorResponseDto = z.infer<typeof ErrorResponseSchema>;

/**
 * 공통 단순 성공 응답 DTO 스키마
 */
export const SimpleSuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type SimpleSuccessResponseDto = z.infer<typeof SimpleSuccessResponseSchema>;

