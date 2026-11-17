/**
 * 소셜 로그인 유저의 JWT Access Token을 저장하는 localStorage 키
 */
export const ACCESS_TOKEN_STORAGE_KEY = "ideamory_access_token";

/**
 * 익명 게스트 세션 식별 토큰(`gst_...`)을 저장하는 localStorage 키
 */
export const GUEST_TOKEN_STORAGE_KEY = "ideamory_guest_token";

/**
 * 연동된 소셜 로그인 제공자(`kakao` | `google` | `github`)를 저장하는 localStorage 키
 */
export const AUTH_PROVIDER_STORAGE_KEY = "ideamory_auth_provider";

/**
 * SSR(Next.js 서버 렌더링) 및 브라우저 프라이빗 모드 보안 정책 환경에서도
 * 예외 없이 안전하게 `window.localStorage` 핸들을 반환합니다.
 *
 * @returns 사용 가능한 Storage 인스턴스 또는 미지원 환경일 경우 null
 */
function getSafeLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * 지정된 키의 토큰 문자열을 공백 제거 후 안전하게 조회합니다.
 *
 * @param key localStorage 저장 키
 * @returns 유효한 토큰 문자열 또는 미존재/SSR 환경일 경우 null
 */
function readStorageToken(key: string): string | null {
  const value = getSafeLocalStorage()?.getItem(key);
  return value && value.trim().length > 0 ? value.trim() : null;
}

/**
 * 지정된 키에 토큰 문자열을 안전하게 저장합니다.
 *
 * @param key localStorage 저장 키
 * @param token 저장할 토큰 문자열
 */
function writeStorageToken(key: string, token: string): void {
  getSafeLocalStorage()?.setItem(key, token.trim());
}

/**
 * 지정된 키의 토큰을 안전하게 삭제합니다.
 *
 * @param key localStorage 저장 키
 */
function removeStorageToken(key: string): void {
  getSafeLocalStorage()?.removeItem(key);
}

/**
 * 저장된 소셜 로그인 JWT Access Token을 조회합니다.
 *
 * @returns 유효한 문자열 토큰 또는 미존재/SSR 환경일 경우 null
 */
export const getAccessToken = (): string | null =>
  readStorageToken(ACCESS_TOKEN_STORAGE_KEY);

/**
 * 소셜 로그인 JWT Access Token을 저장합니다.
 *
 * @param token Supabase Auth 등에서 발급받은 JWT Access Token
 */
export const setAccessToken = (token: string): void =>
  writeStorageToken(ACCESS_TOKEN_STORAGE_KEY, token);

/**
 * 저장된 소셜 로그인 JWT Access Token을 삭제합니다.
 */
export const clearAccessToken = (): void =>
  removeStorageToken(ACCESS_TOKEN_STORAGE_KEY);

/**
 * 저장된 익명 게스트 세션 토큰(`X-Guest-Token`)을 조회합니다.
 *
 * @returns 게스트 토큰 문자열 또는 미존재/SSR 환경일 경우 null
 */
export const getGuestToken = (): string | null =>
  readStorageToken(GUEST_TOKEN_STORAGE_KEY);

/**
 * 익명 게스트 세션 토큰(`X-Guest-Token`)을 저장합니다.
 *
 * @param token 백엔드 `POST /api/v1/auth/guest/init`에서 발급받은 게스트 토큰
 */
export const setGuestToken = (token: string): void =>
  writeStorageToken(GUEST_TOKEN_STORAGE_KEY, token);

/**
 * 저장된 익명 게스트 세션 토큰을 삭제합니다.
 */
export const clearGuestToken = (): void =>
  removeStorageToken(GUEST_TOKEN_STORAGE_KEY);

/**
 * 저장된 소셜 로그인 제공자명을 조회합니다.
 *
 * @returns 소셜 제공자 문자열(`kakao` | `google` | `github`) 또는 게스트/미존재 시 null
 */
export const getAuthProvider = (): string | null =>
  readStorageToken(AUTH_PROVIDER_STORAGE_KEY);

/**
 * 연동된 소셜 로그인 제공자명을 저장합니다.
 *
 * @param provider 소셜 제공자명
 */
export const setAuthProvider = (provider: string): void =>
  writeStorageToken(AUTH_PROVIDER_STORAGE_KEY, provider);

/**
 * 저장된 소셜 로그인 제공자명을 삭제합니다.
 */
export const clearAuthProvider = (): void =>
  removeStorageToken(AUTH_PROVIDER_STORAGE_KEY);

/**
 * 로그아웃, 회원탈퇴 또는 게스트 데이터 초기화 시 모든 인증 토큰을 일괄 정리합니다.
 */
export function clearAllAuthTokens(): void {
  clearAccessToken();
  clearGuestToken();
  clearAuthProvider();
}
