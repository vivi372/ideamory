import { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { getAccessToken, getGuestToken } from "../../lib/token-storage";
import { generateTraceId, isValidTraceId } from "../../lib/trace-id";

/**
 * Axios 요청 헤더 객체에 키-값을 안전하게 설정합니다.
 * Axios v1의 `AxiosHeaders` 인스턴스와 일반 객체 모의(Mock) 모두에서 동일하게 동작하도록 방어합니다.
 *
 * @param headers Axios 요청 설정의 headers 객체
 * @param name 설정할 HTTP 헤더명
 * @param value 설정할 HTTP 헤더 값
 */
function setRequestHeader(
  headers: InternalAxiosRequestConfig["headers"],
  name: string,
  value: string
): void {
  if (typeof (headers as AxiosHeaders).set === "function") {
    (headers as AxiosHeaders).set(name, value);
    return;
  }
  (headers as Record<string, string>)[name] = value;
}

/**
 * Axios 요청 헤더 객체에서 특정 헤더를 안전하게 제거합니다.
 * 소셜 JWT와 게스트 토큰이 동시에 전송되어 백엔드 인증 가드에서 혼선이 발생하는 것을 방지합니다.
 *
 * @param headers Axios 요청 설정의 headers 객체
 * @param name 제거할 HTTP 헤더명
 */
function deleteRequestHeader(
  headers: InternalAxiosRequestConfig["headers"],
  name: string
): void {
  if (typeof (headers as AxiosHeaders).delete === "function") {
    (headers as AxiosHeaders).delete(name);
    return;
  }
  delete (headers as Record<string, unknown>)[name];
}

/**
 * Axios 요청 헤더 객체에서 특정 헤더 값을 대소문자 구분 없이 조회합니다.
 *
 * @param headers Axios 요청 설정의 headers 객체
 * @param name 조회할 HTTP 헤더명
 * @returns 문자열 헤더 값 또는 미존재 시 undefined
 */
function getRequestHeader(
  headers: InternalAxiosRequestConfig["headers"],
  name: string
): string | undefined {
  if (typeof (headers as AxiosHeaders).get === "function") {
    const val = (headers as AxiosHeaders).get(name);
    return typeof val === "string" ? val : undefined;
  }

  const record = headers as Record<string, unknown>;
  const matchedKey = Object.keys(record).find(
    (key) => key.toLowerCase() === name.toLowerCase()
  );
  const value = matchedKey ? record[matchedKey] : undefined;
  return typeof value === "string" ? value : undefined;
}

/**
 * 모든 REST API 요청 직전에 실행되는 Axios 요청 인터셉터입니다.
 *
 * 1. **분산 추적(`X-Trace-Id`) 주입**: 호출부에서 유효한 32자리 Hex Trace ID를 이미 지정하지 않은 경우
 *    신규 32자리 Hex ID를 생성하여 `X-Trace-Id` 헤더에 자동 주입합니다.
 * 2. **배타적 인증 헤더 주입**: 소셜 로그인 JWT(`Authorization: Bearer <token>`)가 존재하면 이를 우선 적용하고
 *    `X-Guest-Token`을 제거하며, 소셜 JWT가 없고 게스트 토큰이 존재할 경우에만 `X-Guest-Token`을 주입합니다.
 *
 * @param config Axios 내부 요청 설정 객체
 * @returns Trace ID 및 인증 컨텍스트가 주입된 요청 설정 객체
 */
export function attachRequestContext(
  config: InternalAxiosRequestConfig
): InternalAxiosRequestConfig {
  if (!config.headers) {
    config.headers = new AxiosHeaders();
  }

  // 기존 X-Trace-Id가 유효한 32자리 Hex(All-Zero 제외)인 경우 재사용하고, 아니면 신규 발급
  const existingTraceId = getRequestHeader(config.headers, "X-Trace-Id");
  const traceId =
    existingTraceId && isValidTraceId(existingTraceId)
      ? existingTraceId
      : generateTraceId();
  setRequestHeader(config.headers, "X-Trace-Id", traceId);

  // 인증 토큰 배타적 주입: 소셜 JWT 우선 -> 미존재 시 게스트 토큰
  const accessToken = getAccessToken();
  if (accessToken) {
    setRequestHeader(config.headers, "Authorization", `Bearer ${accessToken}`);
    deleteRequestHeader(config.headers, "X-Guest-Token");
    return config;
  }

  deleteRequestHeader(config.headers, "Authorization");
  const guestToken = getGuestToken();
  if (guestToken) {
    setRequestHeader(config.headers, "X-Guest-Token", guestToken);
  } else {
    deleteRequestHeader(config.headers, "X-Guest-Token");
  }

  return config;
}
