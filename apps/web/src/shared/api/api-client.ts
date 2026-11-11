import axios from "axios";

/**
 * Ideamory 공통 REST API 클라이언트
 * Server Actions를 금지하고 오직 이 클라이언트를 통해 백엔드(apps/api)와 통신합니다.
 */
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  headers: {
    "Content-Type": "application/json"
  },
  timeout: 10000
});

// 요청 인터셉터: X-Trace-Id 생성 및 전달
apiClient.interceptors.request.use((config) => {
  const traceId = Math.random().toString(16).substring(2, 8);
  config.headers["X-Trace-Id"] = traceId;
  return config;
});

// 응답 인터셉터: 에러 핸들링 기본 규격
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // 백엔드 UX 태그 표준 에러 처리
    console.error("[API Error]", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

