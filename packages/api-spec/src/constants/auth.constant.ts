/**
 * 인증 및 게스트 세션 규격 공통 상수 (SSOT)
 * DB 컬럼 제약(VARCHAR(64)), AuthGuard 헤더 검증, AuthService 토큰 발급이 단일 규격을 공유합니다.
 */

/** 익명 게스트 토큰 접두사 */
export const GUEST_TOKEN_PREFIX = "gst_";

/** 익명 게스트 토큰 난수 바이트 수 (24바이트 = Hex 48자, 접두사 포함 총 52자) */
export const GUEST_TOKEN_RANDOM_BYTES = 24;

/** DB 스키마(VARCHAR 64) 및 HTTP 헤더 검증용 게스트 토큰 최대 허용 길이 */
export const GUEST_TOKEN_MAX_LENGTH = 64;

