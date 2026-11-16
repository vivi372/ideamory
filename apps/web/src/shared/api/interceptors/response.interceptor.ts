import axios, { AxiosHeaders, type AxiosResponse } from "axios";
import {
  ERROR_CODES,
  ErrorResponseSchema,
  UxTagSchema,
  mapHttpStatusToErrorCode,
  type ErrorResponseDto,
  type UxTag,
} from "@ideamory/api-spec";
import { dispatchApiError } from "../../lib/error-dispatcher";
import { generateTraceId, isValidTraceId } from "../../lib/trace-id";

/**
 * 프론트엔드 전역에서 일관된 형태로 예외를 다루기 위한 표준 API 클라이언트 에러 클래스입니다.
 * 백엔드 `ErrorResponseDto` 규격과 파싱된 `uxTag`를 함께 보관하여,
 * 폼(`FIELD`) 에러 바인딩이나 React Query 에러 핸들링에서 타입 세이프하게 활용할 수 있습니다.
 */
export class ApiClientError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly uxTag: UxTag;
  readonly traceId: string;
  readonly timestamp: string;
  readonly isNetworkError: boolean;
  readonly rawError?: unknown;

  constructor(params: {
    statusCode: number;
    errorCode: string;
    uxTag: UxTag;
    message: string;
    traceId: string;
    timestamp: string;
    isNetworkError?: boolean;
    rawError?: unknown;
  }) {
    super(params.message);
    this.name = "ApiClientError";
    this.statusCode = params.statusCode;
    this.errorCode = params.errorCode;
    this.uxTag = params.uxTag;
    this.traceId = params.traceId;
    this.timestamp = params.timestamp;
    this.isNetworkError = Boolean(params.isNetworkError);
    this.rawError = params.rawError;
  }
}

/**
 * Ideamory 표준 에러 코드(`[도메인]_[UX태그]_[상세원인]`)에서 UX 태그를 추출합니다.
 * 예: `MEMO_FIELD_REQUIRED` -> `"FIELD"`, `AUTH_ALERT_SESSION_EXPIRED` -> `"ALERT"`
 *
 * @param errorCode 백엔드 또는 매핑 유틸에서 반환된 표준 에러 코드 문자열
 * @returns 검증된 `UxTag` 값 (규격 외 문자열일 경우 안전한 기본값 `"ERROR"` 반환)
 */
export function extractUxTagFromErrorCode(errorCode: string): UxTag {
  const segments = errorCode.split("_");
  const candidateTag = segments[1]?.toUpperCase();
  const parsed = UxTagSchema.safeParse(candidateTag);
  return parsed.success ? parsed.data : "ERROR";
}

/**
 * 응답 헤더 또는 요청 헤더에서 유효한 32자리 Hex Trace ID를 추출합니다.
 * 백엔드 응답 본문에 `traceId`가 누락된 비정상(프록시/네트워크) 에러 상황에서도
 * 요청 시 생성했던 Trace ID를 끝까지 보존하여 추적 연속성을 유지하기 위함입니다.
 *
 * @param rawHeaders Axios 응답 또는 요청 헤더 객체
 * @returns 유효한 32자리 Trace ID 또는 미존재 시 undefined
 */
function extractTraceIdFromHeaders(rawHeaders: unknown): string | undefined {
  if (!rawHeaders || typeof rawHeaders !== "object") {
    return undefined;
  }

  const candidate = AxiosHeaders.from(rawHeaders as Record<string, string>).get(
    "x-trace-id"
  );
  return typeof candidate === "string" && isValidTraceId(candidate)
    ? candidate
    : undefined;
}

const STATUS_FALLBACK_MESSAGES: Record<number, string> = {
  400: "입력값을 다시 확인해 주세요.",
  401: "세션이 만료되었거나 인증이 필요합니다.",
  403: "해당 작업을 수행할 권한이 없습니다.",
  404: "요청하신 데이터를 찾을 수 없습니다.",
  409: "이미 처리되었거나 충돌이 발생했습니다.",
};
const DEFAULT_STATUS_FALLBACK_MESSAGE =
  "서버 처리 중 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";

/**
 * Axios 예외 객체를 백엔드 표준 `ErrorResponseDto` 규격 기반의 `ApiClientError`로 정규화합니다.
 *
 * 1. 백엔드 `HttpExceptionFilter`의 표준 JSON 응답(`ErrorResponseSchema`)인 경우 그대로 채택합니다.
 * 2. 프록시/게이트웨이 등에서 비표준 HTTP 에러를 반환한 경우 `mapHttpStatusToErrorCode`로 표준 코드로 매핑합니다.
 * 3. 타임아웃 또는 네트워크 단절로 응답 자체가 없는 경우 `SYSTEM_WARN_HTTP_ERROR`로 정규화합니다.
 *
 * @param error Axios 인터셉터에서 포착한 원본 예외 객체
 * @returns 정규화된 `ApiClientError` 인스턴스
 */
export function normalizeApiError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) {
    return error;
  }

  const fallbackTimestamp = new Date().toISOString();

  if (axios.isAxiosError(error)) {
    const response = error.response;
    const headerTraceId =
      extractTraceIdFromHeaders(response?.headers) ??
      extractTraceIdFromHeaders(error.config?.headers) ??
      generateTraceId();

    // 1. 서버 응답이 존재하는 경우
    if (response) {
      const parsedBody = ErrorResponseSchema.safeParse(response.data);
      if (parsedBody.success) {
        const dto: ErrorResponseDto = parsedBody.data;
        return new ApiClientError({
          statusCode: dto.statusCode,
          errorCode: dto.errorCode,
          uxTag: extractUxTagFromErrorCode(dto.errorCode),
          message: dto.message,
          traceId: dto.traceId,
          timestamp: dto.timestamp,
          rawError: error,
        });
      }

      // 백엔드 표준 포맷은 아니지만 errorCode / message 일부가 존재하는 경우 방어적 파싱
      const bodyRecord =
        response.data && typeof response.data === "object"
          ? (response.data as Record<string, unknown>)
          : undefined;
      const statusCode = response.status || 500;
      const errorCode =
        typeof bodyRecord?.errorCode === "string"
          ? bodyRecord.errorCode
          : mapHttpStatusToErrorCode(statusCode);
      const message =
        typeof bodyRecord?.message === "string" && bodyRecord.message.trim().length > 0
          ? bodyRecord.message
          : (STATUS_FALLBACK_MESSAGES[statusCode] ?? DEFAULT_STATUS_FALLBACK_MESSAGE);

      return new ApiClientError({
        statusCode,
        errorCode,
        uxTag: extractUxTagFromErrorCode(errorCode),
        message,
        traceId: headerTraceId,
        timestamp: fallbackTimestamp,
        rawError: error,
      });
    }

    // 2. 네트워크 단절 또는 요청 타임아웃(응답 객체 없음: ECONNABORTED 및 ETIMEDOUT 모두 포착)
    const isTimeout =
      error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";
    const networkMessage = isTimeout
      ? "서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요."
      : "네트워크 연결이 원활하지 않습니다. 연결 상태를 확인해 주세요.";

    return new ApiClientError({
      statusCode: 0,
      errorCode: ERROR_CODES.SYSTEM_WARN_HTTP_ERROR,
      uxTag: extractUxTagFromErrorCode(ERROR_CODES.SYSTEM_WARN_HTTP_ERROR),
      message: networkMessage,
      traceId: headerTraceId,
      timestamp: fallbackTimestamp,
      isNetworkError: true,
      rawError: error,
    });
  }

  // 3. Axios 외부의 예기치 않은 런타임 에러
  const unknownMessage =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : "알 수 없는 오류가 발생했습니다.";

  return new ApiClientError({
    statusCode: 0,
    errorCode: ERROR_CODES.SYSTEM_ERROR_UNKNOWN,
    uxTag: extractUxTagFromErrorCode(ERROR_CODES.SYSTEM_ERROR_UNKNOWN),
    message: unknownMessage,
    traceId: generateTraceId(),
    timestamp: fallbackTimestamp,
    rawError: error,
  });
}

/**
 * 성공 응답(`2xx`) 처리 인터셉터입니다.
 *
 * `DELETE /api/v1/memos/:id`, `DELETE /api/v1/auth/guest/reset` 등 본문이 비어 있는
 * `204 No Content` 응답 시 `response.data`가 빈 문자열(`""`) 또는 `undefined`로 넘어와
 * 호출부 구조 분해/파싱 에러를 유발하지 않도록 빈 객체(`{}`)로 안전하게 정규화합니다.
 *
 * @param response Axios 성공 응답 객체
 * @returns 본문이 안전하게 정규화된 Axios 응답 객체
 */
export function handleSuccessResponse(response: AxiosResponse): AxiosResponse {
  if (response.status === 204 && (response.data === "" || response.data == null)) {
    response.data = {};
  }
  return response;
}

/**
 * 에러 응답 처리 인터셉터입니다.
 *
 * 수신된 예외를 `ApiClientError`로 정규화한 뒤, 에러 코드의 UX 태그에 따라 전역 UI 피드백을 분기합니다:
 * - **`FIELD`**: 입력 폼 유효성 에러이므로 전역 토스트/모달을 띄우지 않고 호출부 폼으로 그대로 reject 전파합니다.
 * - **`INFO` / `WARN` / `ERROR` / `ALERT` / `CONFIRM` / `FATAL`**: `error-dispatcher`를 통해
 *   전역 UI 레이어(Radix Toast, Dialog, 장애 오버레이)에 이벤트를 발행한 뒤 호출부로 reject 전파합니다.
 *
 * @param error Axios 응답 단계에서 발생한 예외
 * @returns 정규화된 `ApiClientError`를 담은 rejected Promise
 * @throws {ApiClientError} 정규화된 표준 API 클라이언트 에러
 */
export function handleErrorResponse(error: unknown): Promise<never> {
  const apiError = normalizeApiError(error);

  if (apiError.uxTag !== "FIELD") {
    dispatchApiError({
      uxTag: apiError.uxTag,
      statusCode: apiError.statusCode,
      errorCode: apiError.errorCode,
      message: apiError.message,
      traceId: apiError.traceId,
      timestamp: apiError.timestamp,
    });
  }

  return Promise.reject(apiError);
}
