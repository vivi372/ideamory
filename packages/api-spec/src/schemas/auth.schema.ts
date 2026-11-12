import { z } from "zod";
import { UuidV7Schema } from "./common.schema";

/**
 * POST /api/auth/guest/init (익명 게스트 세션 발급 & 온보딩 시드 메모 자동 생성 요청 DTO)
 */
export const GuestInitSchema = z.object({
  memoId: UuidV7Schema,     // 온보딩 가이드 시드 메모용 선발급 UUID v7
  categoryId: UuidV7Schema, // [사용 가이드] 카테고리용 선발급 UUID v7
});

export type GuestInitDto = z.infer<typeof GuestInitSchema>;

/**
 * 게스트 세션 발급 응답 DTO
 */
export const GuestInitResponseSchema = z.object({
  guestToken: z.string().max(64),
  seedMemoId: UuidV7Schema,
});

export type GuestInitResponseDto = z.infer<typeof GuestInitResponseSchema>;

/**
 * POST /api/auth/social/link (소셜 계정 연동 및 게스트 데이터 단일 트랜잭션 마이그레이션 요청 DTO)
 */
export const LinkSocialAuthSchema = z.object({
  provider: z.enum(["kakao", "google", "naver"]),
  idToken: z.string().min(1, "idToken이 필요합니다."),
});

export type LinkSocialAuthDto = z.infer<typeof LinkSocialAuthSchema>;

/**
 * 소셜 계정 연동 결과 응답 DTO
 */
export const LinkSocialAuthResponseSchema = z.object({
  success: z.boolean(),
  userId: UuidV7Schema,
});

export type LinkSocialAuthResponseDto = z.infer<typeof LinkSocialAuthResponseSchema>;

