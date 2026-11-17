/**
 * 로그 출력 시 `[MASKED]`로 치환할 민감 정보 키 집합 (소문자 정규화 기준)
 */
const SENSITIVE_KEY_PATTERNS = [
  "password",
  "token",
  "secret",
  "accesstoken",
  "guesttoken",
  "refreshtoken",
  "authorization",
  "idtoken",
] as const;

const MAX_LOG_STRING_LENGTH = 500;
const VECTOR_TRUNCATION_THRESHOLD = 100;

/**
 * 키 이름이 민감 정보 마스킹 대상인지 대소문자 구분 없이 판별합니다.
 *
 * @param key 검사할 객체 프로퍼티 키
 * @returns 민감 키 포함 시 true
 */
function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * 로그 출력 전 민감 정보 마스킹, 768차원 임베딩 벡터 축약, 장문 문자열 절삭 및
 * 순환 참조 방어를 수행하는 재귀 새니타이저입니다.
 *
 * @param value 정제할 임의의 값 (DTO, 인자, 반환값, 쿼리 파라미터 등)
 * @param seen 순환 참조(Circular Reference) 방지를 위한 WeakSet
 * @returns 안전하게 로그 직렬화 가능한 정제 데이터
 */
export function sanitizeForLog(
  value: unknown,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    if (value.length > MAX_LOG_STRING_LENGTH) {
      return `${value.slice(0, MAX_LOG_STRING_LENGTH)}...(truncated)`;
    }
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeForLog(value.message, seen),
    };
  }

  if (Array.isArray(value)) {
    // Gemini 768차원 실수 임베딩 벡터 배열 등 거대 숫자 배열은 콘솔 도배 방지를 위해 축약 표기
    if (
      value.length >= VECTOR_TRUNCATION_THRESHOLD &&
      typeof value[0] === "number"
    ) {
      return `[vector(${value.length})]`;
    }
    return value.map((item) => sanitizeForLog(item, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }
    seen.add(value);

    const sanitized: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(
      value as Record<string, unknown>
    )) {
      sanitized[key] = isSensitiveKey(key)
        ? "[MASKED]"
        : sanitizeForLog(entryValue, seen);
    }
    return sanitized;
  }

  return String(value);
}

/**
 * 임의의 로그 페이로드를 Fail-Safe 방식으로 직렬화합니다.
 * 로깅 도중 직렬화 예외가 발생하더라도 실제 비즈니스 트랜잭션을 절대 중단시키지 않고
 * `"[SerializationError]"` 문자열을 반환합니다.
 *
 * @param value 직렬화할 데이터
 * @returns 마스킹·축약이 적용된 JSON 문자열
 */
export function safeStringifyForLog(value: unknown): string {
  try {
    const serialized = JSON.stringify(sanitizeForLog(value));
    return serialized ?? "undefined";
  } catch {
    return "[SerializationError]";
  }
}
