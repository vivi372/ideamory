/**
 * 소셜 로그인 유저의 JWT Access Token을 저장하는 localStorage 키
 */
export const ACCESS_TOKEN_STORAGE_KEY = "ideamory_access_token";

/**
 * 익명 게스트 세션 식별 토큰(`gst_...`)을 저장하는 localStorage 키
 */
export const GUEST_TOKEN_STORAGE_KEY = "ideamory_guest_token";

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
 * 저장된 소셜 로그인 JWT Access Token을 조회합니다.
 *
 * @returns 유효한 문자열 토큰 또는 미존재/SSR 환경일 경우 null
 */
export function getAccessToken(): string | null {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return null;
  }

  const token = storage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  return token && token.trim().length > 0 ? token.trim() : null;
}

/**
 * 소셜 로그인 JWT Access Token을 저장합니다.
 *
 * @param token Supabase Auth 등에서 발급받은 JWT Access Token
 */
export function setAccessToken(token: string): void {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return;
  }

  storage.setItem(ACCESS_TOKEN_STORAGE_KEY, token.trim());
}

/**
 * 저장된 소셜 로그인 JWT Access Token을 삭제합니다.
 */
export function clearAccessToken(): void {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

/**
 * 저장된 익명 게스트 세션 토큰(`X-Guest-Token`)을 조회합니다.
 *
 * @returns 게스트 토큰 문자열 또는 미존재/SSR 환경일 경우 null
 */
export function getGuestToken(): string | null {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return null;
  }

  const token = storage.getItem(GUEST_TOKEN_STORAGE_KEY);
  return token && token.trim().length > 0 ? token.trim() : null;
}

/**
 * 익명 게스트 세션 토큰(`X-Guest-Token`)을 저장합니다.
 *
 * @param token 백엔드 `POST /api/auth/guest/init`에서 발급받은 게스트 토큰
 */
export function setGuestToken(token: string): void {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return;
  }

  storage.setItem(GUEST_TOKEN_STORAGE_KEY, token.trim());
}

/**
 * 저장된 익명 게스트 세션 토큰을 삭제합니다.
 */
export function clearGuestToken(): void {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(GUEST_TOKEN_STORAGE_KEY);
}

/**
 * 로그아웃, 회원탈퇴 또는 게스트 데이터 초기화 시 모든 인증 토큰을 일괄 정리합니다.
 */
export function clearAllAuthTokens(): void {
  clearAccessToken();
  clearGuestToken();
}
