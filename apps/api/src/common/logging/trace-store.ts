import { AsyncLocalStorage } from "node:async_hooks";

/**
 * W3C / Sentry 32자리 Hex Trace ID 전역 비동기 컨텍스트 저장소
 * Node.js AsyncLocalStorage를 활용하여 요청 생애주기 동안 인자 전달 없이
 * 서비스, 리포지토리, 예외 필터 어디서나 동일한 Trace ID를 참조할 수 있도록 지원합니다.
 */
export const traceStore = new AsyncLocalStorage<string>();

/**
 * 현재 비동기 실행 컨텍스트에 바인딩된 32자리 Trace ID를 조회합니다.
 * 백그라운드 작업 등 컨텍스트가 존재하지 않는 경우 'system' 식별자를 반환합니다.
 */
export function getTraceId(): string {
  return traceStore.getStore() || "system";
}

/**
 * 특정 Trace ID 스코프 내에서 비동기 콜백 함수를 실행합니다.
 * @param traceId 바인딩할 32자리 Hex Trace ID
 * @param fn 실행할 콜백 함수
 */
export function runWithTraceId<T>(traceId: string, fn: () => T): T {
  return traceStore.run(traceId, fn);
}

