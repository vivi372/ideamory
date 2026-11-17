const LEADING_CATEGORY_REGEX = /^@(\S+)(?:\s+([\s\S]*))?$/;
const VALID_HTTP_URL_REGEX = /^https?:\/\/[^\s<>"{}|\\^`[\]]+$/i;

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
