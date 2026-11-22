/**
 * 환경변수 `NEXT_PUBLIC_API_URL`에 `/api/v1` 프리픽스가 포함되어 있든 없든
 * 일관된 `/api/v1` Base URL을 반환하도록 정규화합니다.
 * 백엔드 모든 도메인(`auth`, `memos`, `categories`, `ogp`)이 `/api/v1/*` 프리픽스로 통일되어 있으므로
 * 호출부에서는 `/auth/...`, `/memos/...` 등 버전 프리픽스 이후 경로만 전달하면 됩니다.
 *
 * @returns `/api/v1`이 보장된 REST API Base URL
 */
export function resolveApiBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    const normalizedHost = configuredUrl
      .replace(/\/+$/, "")
      .replace(/\/api\/v1$/, "");
    return `${normalizedHost}/api/v1`;
  }

  // 실기기 테스트 시 브라우저가 PC의 LAN IP(예: 192.168.x.x:3000)로 접속한 경우 동일 호스트의 :3001 API를 자동 타겟팅
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:3001/api/v1`;
    }
  }

  return "http://localhost:3001/api/v1";
}
