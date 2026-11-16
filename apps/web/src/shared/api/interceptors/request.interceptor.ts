import { AxiosHeaders, type InternalAxiosRequestConfig } from "axios";
import { getAccessToken, getGuestToken } from "../../lib/token-storage";
import { generateTraceId, isValidTraceId } from "../../lib/trace-id";

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
  // Axios v1 표준 AxiosHeaders 인스턴스로 정규화하여 .get/.set/.delete 메서드를 일관되게 사용합니다.
  const headers = AxiosHeaders.from(config.headers);
  config.headers = headers;

  // 기존 X-Trace-Id가 유효한 32자리 Hex(All-Zero 제외)인 경우 재사용하고, 아니면 신규 발급
  const existingTraceId = headers.get("X-Trace-Id");
  const traceId =
    typeof existingTraceId === "string" && isValidTraceId(existingTraceId)
      ? existingTraceId
      : generateTraceId();
  headers.set("X-Trace-Id", traceId);

  // 인증 토큰 배타적 주입: 소셜 JWT 우선 -> 미존재 시 게스트 토큰
  const accessToken = getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.delete("X-Guest-Token");
    return config;
  }

  headers.delete("Authorization");
  const guestToken = getGuestToken();
  if (guestToken) {
    headers.set("X-Guest-Token", guestToken);
  } else {
    headers.delete("X-Guest-Token");
  }

  return config;
}
