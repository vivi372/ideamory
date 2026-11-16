/**
 * W3C TraceContext 및 Sentry 분산 추적 표준에 부합하는 32자리 16진수 정규식
 * 128비트(16바이트) 식별자만 유효한 Trace ID로 인정합니다.
 */
export const TRACE_ID_REGEX = /^[0-9a-fA-F]{32}$/;

/**
 * 분산 추적 표준상 무효 식별자로 간주하는 All-Zero 32자리 문자열
 * 백엔드 TraceIdMiddleware의 무효 식별자 방어 정책과 동일한 기준을 적용합니다.
 */
export const ALL_ZERO_TRACE_ID = "00000000000000000000000000000000";

/**
 * 주어진 문자열이 유효한 32자리 Hex Trace ID인지 검증합니다.
 *
 * @param traceId 검증할 Trace ID 문자열
 * @returns 32자리 Hex 규격을 만족하고 All-Zero가 아니면 true, 그렇지 않으면 false
 */
export function isValidTraceId(traceId: string): boolean {
  return TRACE_ID_REGEX.test(traceId) && traceId !== ALL_ZERO_TRACE_ID;
}

/**
 * 단일 32자리 Hex 후보 문자열을 생성합니다.
 * 브라우저 Web Crypto API(`randomUUID` -> `getRandomValues`)를 우선 사용하고,
 * 구형/제한 환경에서는 `Math.random` 기반 32자리 Hex로 안전하게 폴백합니다.
 *
 * @returns 32자리 소문자 16진수 문자열
 */
function createHex32Candidate(): string {
  if (typeof globalThis.crypto !== "undefined") {
    if (typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID().replace(/-/g, "");
    }

    if (typeof globalThis.crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      globalThis.crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
  }

  let hex = "";
  while (hex.length < 32) {
    hex += Math.floor(Math.random() * 0x100000000)
      .toString(16)
      .padStart(8, "0");
  }
  return hex.slice(0, 32);
}

/**
 * 백엔드(`X-Trace-Id`) 및 Sentry 분산 추적과 호환되는 32자리 16진수 Trace ID를 생성합니다.
 * All-Zero(`0000...`) 식별자가 우연히 생성되더라도 재시도하여 유효한 Trace ID만 반환하도록 방어합니다.
 *
 * @returns W3C/Sentry 호환 32자리 16진수 Trace ID
 */
export function generateTraceId(): string {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = createHex32Candidate();
    if (isValidTraceId(candidate)) {
      return candidate;
    }
  }

  // 극단적인 난수 실패 상황에서도 All-Zero를 회피하기 위한 최후 폴백
  return `a1b2c3d4e5f67890${Date.now().toString(16).padStart(16, "0").slice(-16)}`;
}
