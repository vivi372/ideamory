const LEADING_CATEGORY_REGEX = /^@(\S+)(?:\s+([\s\S]*))?$/;
const LEADING_DIRECTIVE_TOKEN_REGEX = /^(\s*)(@([^\s@]{1,10}))(?=[\s]|$)/;
const DOMAIN_LIKE_SUFFIX_REGEX = /\.[a-zA-Z]{2,}$/;
const VALID_HTTP_URL_REGEX = /^https?:\/\/[^\s<>"{}|\\^`[\]]+$/i;

export interface HighlightedCaptureParts {
  /** 문두 공백 */
  leadingWhitespace: string;
  /** 강조할 `@카테고리` 원문 토큰 (이메일 등 비대상일 경우 null) */
  directive: string | null;
  /** `@카테고리` 이후 나머지 텍스트 */
  rest: string;
}

/**
 * 입력창 내 문두 `@카테고리` 지시어만 별도 색상으로 강조하기 위해 문자열을 분리합니다.
 *
 * - 문두(`^\\s*@카테고리`)에 위치하고 뒤에 `@`가 중복되지 않으며(예: `@user@gmail.com` 제외),
 *   도메인 형태(예: `@gmail.com`)가 아닌 1~10자 토큰만 지시어로 인식합니다.
 * - 문장 중간의 이메일(예: `문의 test@gmail.com`)이나 문두 이메일(`user@naver.com`)은 강조하지 않습니다.
 *
 * @param rawContent 입력창 원본 문자열
 * @returns 강조 분리 결과
 */
export function splitLeadingCategoryHighlight(
  rawContent: string
): HighlightedCaptureParts {
  const match = LEADING_DIRECTIVE_TOKEN_REGEX.exec(rawContent);
  if (!match) {
    return {
      leadingWhitespace: "",
      directive: null,
      rest: rawContent,
    };
  }

  const leadingWhitespace = match[1] ?? "";
  const directive = match[2] ?? "";
  const categoryName = match[3] ?? "";

  if (!categoryName || DOMAIN_LIKE_SUFFIX_REGEX.test(categoryName)) {
    return {
      leadingWhitespace: "",
      directive: null,
      rest: rawContent,
    };
  }

  const consumedLength = leadingWhitespace.length + directive.length;
  return {
    leadingWhitespace,
    directive,
    rest: rawContent.slice(consumedLength),
  };
}

export interface ParsedCaptureResult {
  /** 문두 `@카테고리` 지시어가 감지된 경우 추출된 카테고리명 (미감지 시 null) */
  categoryHint: string | null;
  /** 낙관적 카드 본문에 표시할 정돈된 텍스트 */
  displayContent: string;
}

/**
 * 사용자가 입력한 메모 문두의 `@카테고리` 지시어를 캡처 직전 미리 파싱합니다.
 *
 * 백엔드 `AiService.parseLeadingCategoryDirective`와 동일한 규칙으로 동작하여,
 * 서버 응답 대기 없이 0ms 낙관적 카드 상단에 즉시 카테고리 배지를 표출할 수 있습니다.
 *
 * @param rawContent 사용자가 입력한 원본 텍스트
 * @returns 추출된 `categoryHint`와 정돈된 `displayContent`
 */
export function parseCaptureContent(rawContent: string): ParsedCaptureResult {
  const trimmed = rawContent.trim();
  const match = LEADING_CATEGORY_REGEX.exec(trimmed);

  if (!match) {
    return {
      categoryHint: null,
      displayContent: trimmed,
    };
  }

  const categoryHint = match[1]?.trim() || null;
  const remainingBody = match[2]?.trim() || "";

  if (!categoryHint || !remainingBody) {
    return {
      categoryHint: null,
      displayContent: trimmed,
    };
  }

  return {
    categoryHint,
    displayContent: remainingBody,
  };
}

/**
 * 클립보드 텍스트가 유효한 단일 `http://` 또는 `https://` URL인지 검증하여 반환합니다.
 *
 * @param clipboardText 클립보드에서 읽은 원본 문자열
 * @returns 유효한 HTTP(S) URL 또는 null
 */
export function extractValidClipboardUrl(clipboardText: string): string | null {
  const trimmed = clipboardText.trim();
  if (!trimmed || !VALID_HTTP_URL_REGEX.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}
