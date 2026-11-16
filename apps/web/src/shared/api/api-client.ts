import axios from "axios";
import { attachRequestContext } from "./interceptors/request.interceptor";
import {
  handleErrorResponse,
  handleSuccessResponse,
} from "./interceptors/response.interceptor";

/**
 * Ideamory 공통 REST API 클라이언트 인스턴스입니다.
 *
 * Next.js Server Actions(`'use server'`) 및 `@supabase/supabase-js` SDK를 일체 배제하고,
 * 모든 백엔드(`apps/api`) 통신을 이 단일 Axios 인스턴스로 일원화합니다.
 * Base URL은 `/api/auth/*`와 `/api/v1/*` 엔드포인트를 모두 수용하도록 호스트 루트(`http://localhost:3001`)를 기본값으로 사용합니다.
 */
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
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
