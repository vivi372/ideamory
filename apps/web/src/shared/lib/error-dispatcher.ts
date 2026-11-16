import type { UxTag } from "@ideamory/api-spec";

/**
 * 백엔드 표준 에러 응답과 UX 태그 분류 결과를 UI 레이어(Toast / Dialog / Fatal Overlay)로
 * 전달하기 위한 표준 이벤트 페이로드입니다.
 */
export interface ApiErrorEvent {
  /** 백엔드 에러 코드에서 파싱된 UX 인터랙션 태그 (`INFO`, `WARN`, `ERROR`, `ALERT`, `CONFIRM`, `FATAL`) */
  uxTag: UxTag;
  /** HTTP 상태 코드 (네트워크 단절/타임아웃 등 서버 무응답 시 0) */
  statusCode: number;
  /** `[도메인]_[UX태그]_[상세원인]` 규격의 표준 에러 코드 */
  errorCode: string;
  /** 사용자에게 노출할 친절한 한글 안내 메시지 */
  message: string;
  /** 요청-응답 분산 추적을 위한 32자리 Hex Trace ID */
  traceId: string;
  /** 에러 발생 시각 (ISO8601) */
  timestamp: string;
}

/**
 * API 에러 이벤트를 수신하는 UI 구독 콜백 타입
 */
export type ApiErrorListener = (event: ApiErrorEvent) => void;

const listeners = new Set<ApiErrorListener>();

/**
 * 전역 API UX 에러 이벤트를 구독합니다.
 * FSD 단방향 의존성 원칙상 `shared/api`가 Radix Toast/Dialog 컴포넌트를 직접 import하지 않고,
 * 상위 UI 프로바이더(3-2 단계)가 이 함수를 통해 이벤트를 구독하여 렌더링하도록 격리합니다.
 *
 * @param listener 에러 이벤트를 수신할 콜백 함수
 * @returns 구독 해제를 수행하는 cleanup 함수
 */
export function subscribeApiError(listener: ApiErrorListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 등록된 모든 UI 구독자에게 표준화된 API UX 에러 이벤트를 브로드캐스트합니다.
 * 개별 구독자 콜백에서 예외가 발생하더라도 다른 구독자 전파가 중단되지 않도록 격리합니다.
 *
 * @param event 발행할 표준 API UX 에러 이벤트
 */
export function dispatchApiError(event: ApiErrorEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.error("[ErrorDispatcher] 구독자 처리 중 예외가 발생했습니다.", error);
    }
  });
}
