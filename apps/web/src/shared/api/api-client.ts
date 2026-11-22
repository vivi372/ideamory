import axios, { AxiosHeaders } from "axios";
import { getAccessToken } from "../lib/token-storage";
import { resolveApiBaseUrl } from "./resolve-api-base-url";
import { refreshAccessTokenSingleFlight } from "./token-refresh";
import { attachRequestContext } from "./interceptors/request.interceptor";
import {
  handleErrorResponse,
  handleSuccessResponse,
} from "./interceptors/response.interceptor";

export { resolveApiBaseUrl };

/**
 * Ideamory 공통 REST API 클라이언트 인스턴스입니다.
 *
 * Next.js Server Actions(`'use server'`) 및 `@supabase/supabase-js` SDK를 일체 배제하고,
 * 모든 백엔드(`apps/api`) 통신을 이 단일 Axios 인스턴스로 일원화합니다.
 */
export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 10000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// 요청 인터셉터: W3C 32자리 X-Trace-Id 및 소셜/게스트 배타적 인증 헤더 주입
apiClient.interceptors.request.use(attachRequestContext);

// 응답 인터셉터: 204 No Content 본문 정규화, 401 시 단일 비행 토큰 갱신 재시도 및 전역 에러 디스패치
apiClient.interceptors.response.use(handleSuccessResponse, async (error) => {
  if (
    axios.isAxiosError(error) &&
    error.response?.status === 401 &&
    error.config &&
    !(error.config as { _retry?: boolean })._retry &&
    !error.config.url?.includes("/auth/social/refresh") &&
    getAccessToken()
  ) {
    const nextAccessToken = await refreshAccessTokenSingleFlight();
    if (nextAccessToken) {
      const retryConfig = error.config as typeof error.config & {
        _retry?: boolean;
      };
      retryConfig._retry = true;
      const headers = AxiosHeaders.from(retryConfig.headers);
      headers.set("Authorization", `Bearer ${nextAccessToken}`);
      retryConfig.headers = headers;
      return apiClient.request(retryConfig);
    }
  }

  return handleErrorResponse(error);
});
