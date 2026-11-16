import axios from "axios";
import { attachRequestContext } from "./interceptors/request.interceptor";
import {
  handleErrorResponse,
  handleSuccessResponse,
} from "./interceptors/response.interceptor";

/**
 * 환경변수 `NEXT_PUBLIC_API_URL`에 `/api/v1` 프리픽스가 포함되어 있든 없든
 * 일관된 `/api/v1` Base URL을 반환하도록 정규화합니다.
 * 백엔드 모든 도메인(`auth`, `memos`, `categories`, `ogp`)이 `/api/v1/*` 프리픽스로 통일되어 있으므로
 * 호출부에서는 `/auth/...`, `/memos/...` 등 버전 프리픽스 이후 경로만 전달하면 됩니다.
 *
 * @returns `/api/v1`이 보장된 REST API Base URL
 */
export function resolveApiBaseUrl(): string {
  const rawBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
  const normalizedHost = rawBaseUrl.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
  return `${normalizedHost}/api/v1`;
}

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

// 응답 인터셉터: 204 No Content 본문 정규화 및 UX 태그 기반 전역 에러 디스패치
apiClient.interceptors.response.use(handleSuccessResponse, handleErrorResponse);
