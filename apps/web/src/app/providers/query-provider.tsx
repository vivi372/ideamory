"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiClientError } from "@/shared/api";

/**
 * React Query 전역 `QueryClient`를 생성합니다.
 *
 * - **`staleTime: 1분`**: 0.1초 퀵 캡처 및 백그라운드 AI 완료 정합성을 유지하면서
 *   불필요한 즉시 네트워크 리패치를 억제합니다.
 * - **`gcTime: 30분`**: 탭/뷰 전환 시 메모리에 캐시를 30분간 유지해 0ms 체감 성능을 제공합니다.
 * - **`retry` 정책**: 4xx 클라이언트/비즈니스 예외는 재시도해도 실패하므로 즉시 중단하고,
 *   일시적 네트워크/5xx 장애에 대해서만 1회 재시도합니다.
 *
 * @returns 설정이 완료된 QueryClient 인스턴스
 */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        gcTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (
            error instanceof ApiClientError &&
            error.statusCode >= 400 &&
            error.statusCode < 500
          ) {
            return false;
          }
          return failureCount < 1;
        },
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/**
 * 애플리케이션 전역에 TanStack Query v5 캐시 컨텍스트를 제공하는 클라이언트 Provider입니다.
 * Next.js App Router 환경에서 요청 간 캐시 오염을 막기 위해 `useState` 지연 초기화를 사용합니다.
 *
 * @param props 하위 React 노드
 * @returns QueryClientProvider 래퍼
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createAppQueryClient);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
