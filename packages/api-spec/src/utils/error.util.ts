import { ZodIssue } from "zod";
import { ERROR_CODES, ErrorCode } from "../constants/error-code.constant";

/**
 * Zod 유효성 검사 실패 이슈(ZodIssue)를 Ideamory 표준 UX 태그 에러 코드로 변환합니다.
 *
 * 1. Zod 스키마 정의 시 params.errorCode에 명시된 커스텀 에러 코드를 1순위로 채택 (SSOT)
 * 2. 미정의 시 필드명 및 이슈 유형(too_small, too_big, invalid_string 등)을 기반으로 적절한 FIELD 에러 코드 도출
 */
export function getErrorCodeFromZodIssue(issue: ZodIssue): ErrorCode {
  // 1순위: 스키마 레벨에 선언된 params.errorCode 우선 사용
  const anyIssue = issue as Record<string, any>;
  if (anyIssue.params && typeof anyIssue.params.errorCode === "string") {
    return anyIssue.params.errorCode as ErrorCode;
  }

  // 2순위: 필드 경로 및 이슈 코드 기반 안전한 도메인 에러 코드 도출
  const fieldPath = Array.isArray(issue.path) ? issue.path.join(".").toUpperCase() : "";
  const issueCode = issue.code;

  if (fieldPath.includes("MEMO") || fieldPath.includes("CONTENT")) {
    if (issueCode === "too_small") return ERROR_CODES.MEMO_FIELD_REQUIRED;
    if (issueCode === "too_big") return ERROR_CODES.MEMO_FIELD_EXCEEDED;
    if (issueCode === "invalid_string" || issueCode === "invalid_type") {
      return ERROR_CODES.COMMON_FIELD_FORMAT;
    }
    return ERROR_CODES.MEMO_FIELD_REQUIRED;
  }

  if (fieldPath.includes("CATEGORY") || fieldPath.includes("NAME")) {
    if (issueCode === "too_small") return ERROR_CODES.CATEGORY_FIELD_REQUIRED;
    if (issueCode === "too_big") return ERROR_CODES.CATEGORY_FIELD_EXCEEDED;
    return ERROR_CODES.CATEGORY_FIELD_INVALID;
  }

  if (fieldPath.includes("TOKEN") || fieldPath.includes("AUTH")) {
    return ERROR_CODES.AUTH_FIELD_TOKEN_REQUIRED;
  }

  // 3순위: 범용 공통 필드 에러 코드
  switch (issueCode) {
    case "too_small":
      return ERROR_CODES.COMMON_FIELD_REQUIRED;
    case "too_big":
      return ERROR_CODES.COMMON_FIELD_EXCEEDED;
    case "invalid_string":
    case "invalid_type":
      return ERROR_CODES.COMMON_FIELD_FORMAT;
    default:
      return ERROR_CODES.COMMON_FIELD_INVALID;
  }
}
