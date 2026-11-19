/**
 * 메모 카드(`MemoCard`) 타임라인 좌측 마커 색상 클래스 목록
 */
const MARKER_CLASSES = [
  "marker-cyan",
  "marker-violet",
  "marker-blue",
  "marker-amber",
] as const;

/**
 * 메모 본문 내 첫 번째 `http(s)://` URL 존재 여부를 판별하는 정규식
 */
export const MEMO_URL_EXTRACT_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/i;

/**
 * 카테고리 이름의 문자 코드 합산 해시를 기반으로 타임라인 좌측 마커 색상 클래스를 결정합니다.
 *
 * @param categoryName 카테고리 표시 이름
 * @returns 결정론적 마커 CSS 클래스명
 */
export function pickMarkerClass(categoryName: string): string {
  let sum = 0;
  for (let i = 0; i < categoryName.length; i += 1) {
    sum += categoryName.charCodeAt(i);
  }
  return MARKER_CLASSES[sum % MARKER_CLASSES.length] ?? "marker-cyan";
}

/**
 * ISO-8601 타임스탬프를 사용자 친화적인 한국어 상대 시각(`방금 전`, `N분 전`, `N시간 전`) 또는 날짜 문자열로 포맷합니다.
 *
 * @param isoString ISO-8601 타임스탬프 문자열
 * @returns 한국어 포맷 시각 문자열
 */
export function formatMemoTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) {
    return "방금 전";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * 외부 URL 문자열에서 `www.` 접두사를 제거한 호스트명을 안전하게 추출합니다.
 *
 * @param rawUrl 원본 URL 문자열
 * @returns 호스트명(파싱 실패 시 원본 문자열 반환)
 */
export function extractHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
}

/**
 * OGP 대상 URL이 Ideamory 자체 온보딩 가이드(`/guide`)를 가리키는지 판별합니다.
 * Capacitor 앱(`https://localhost`)이나 LAN IP 접속 시 `localhost:3000/guide` 외부 브라우저 이탈을 막고
 * 동일 앱 내부 라우팅(`<Link href="/guide">`)으로 이동하기 위해 사용합니다.
 *
 * @param rawUrl OGP 대상 URL 문자열
 * @returns 앱 내부 `/guide` 라우트이면 true
 */
export function isInternalGuideUrl(rawUrl: string): boolean {
  if (rawUrl.startsWith("/guide")) {
    return true;
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.pathname !== "/guide") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    const currentHost =
      typeof window !== "undefined"
        ? window.location.hostname.toLowerCase()
        : "";
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "ideamory.app" ||
      (Boolean(currentHost) && host === currentHost)
    );
  } catch {
    return false;
  }
}
