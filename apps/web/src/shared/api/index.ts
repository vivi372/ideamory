/**
 * FSD `shared/api` Public API Barrel Export
 * 상위 레이어(`entities`, `features`, `app`)는 반드시 이 진입점을 통해서만 API 클라이언트 및 에러 유틸을 참조합니다.
 */
export { apiClient, resolveApiBaseUrl } from "./api-client";
export { queryKeys } from "./query-keys";
export {
  ApiClientError,
  extractUxTagFromErrorCode,
  normalizeApiError,
} from "./interceptors/response.interceptor";
export {
  dispatchApiError,
  subscribeApiError,
  type ApiErrorEvent,
  type ApiErrorListener,
} from "../lib/error-dispatcher";
export { generateTraceId, isValidTraceId } from "../lib/trace-id";
export {
  clearAccessToken,
  clearAllAuthTokens,
  clearAuthProvider,
  clearGuestToken,
  getAccessToken,
  getAuthProvider,
  getGuestToken,
  setAccessToken,
  setAuthProvider,
  setGuestToken,
} from "../lib/token-storage";
