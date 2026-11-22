import axios from "axios";
import type { RefreshSocialAuthResponseDto } from "@ideamory/api-spec";
import {
  clearAccessToken,
  clearAuthProvider,
  clearRefreshToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "../lib/token-storage";

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

let refreshInFlight: Promise<string | null> | null = null;

function resolveRefreshBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    const normalizedHost = configuredUrl
      .replace(/\/+$/, "")
      .replace(/\/api\/v1$/, "");
    return `${normalizedHost}/api/v1`;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:3001/api/v1`;
    }
  }

  return "http://localhost:3001/api/v1";
}

function notifySessionExpired(): void {
  clearAccessToken();
  clearRefreshToken();
  clearAuthProvider();
  sessionExpiredListeners.forEach((listener) => listener());
}

/**
 * 소셜 인증 세션이 만료되어 복구할 수 없을 때 호출되는 구독 리스너를 등록합니다.
 */
export function subscribeAuthSessionExpired(
  listener: SessionExpiredListener
): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

/**
 * 저장된 Refresh Token을 사용해 백엔드 `/auth/social/refresh`로 Access Token을 단일 비행(Single-Flight) 갱신합니다.
 * 동시 다발적인 401 응답 시에도 갱신 요청은 1회만 전송되며, 실패 시 만료된 소셜 토큰/제공자 상태를 정리합니다.
 *
 * @returns 새로 발급된 Access Token (갱신 실패 또는 Refresh Token 미보유 시 null)
 */
export async function refreshAccessTokenSingleFlight(): Promise<string | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    notifySessionExpired();
    return null;
  }

  refreshInFlight = axios
    .post<RefreshSocialAuthResponseDto>(
      `${resolveRefreshBaseUrl()}/auth/social/refresh`,
      { refreshToken },
      {
        timeout: 10000,
        headers: { "Content-Type": "application/json" },
      }
    )
    .then(({ data }) => {
      if (!data?.accessToken || !data?.refreshToken) {
        notifySessionExpired();
        return null;
      }
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      return data.accessToken;
    })
    .catch(() => {
      notifySessionExpired();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}
