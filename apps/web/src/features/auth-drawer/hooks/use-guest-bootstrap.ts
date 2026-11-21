"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  clearGuestToken,
  getAccessToken,
  getAuthProvider,
  getGuestToken,
  queryKeys,
  registerAuthBootstrapPromise,
  setAccessToken,
  setAuthProvider,
  setGuestToken,
} from "@/shared/api";
import { useFeedbackStore } from "@/shared/lib/feedback/use-feedback";
import { generateUuidV7 } from "@/shared/lib/uuid-v7";
import { initGuestSessionApi, linkSocialAccountApi } from "../api/auth.api";
import { useAuthStore, type SocialProvider } from "../model/auth-store";

const PENDING_PROVIDER_SESSION_KEY = "ideamory_pending_oauth_provider";

/**
 * React 19 StrictMode 개발 환경에서 마운트 2회 실행 시 `POST /api/v1/auth/guest/init`가
 * 중복 호출되어 시드 메모가 2번 생성되는 것을 방지하기 위한 모듈 단위 진행 중 Promise 가드입니다.
 */
let bootstrapInFlight: Promise<void> | null = null;

/**
 * URL 해시(`#access_token=...`)로부터 OAuth 콜백 토큰을 추출하고 URL을 정리합니다.
 *
 * @returns 콜백 토큰 및 대기 중인 소셜 제공자 정보 (없으면 null)
 */
function parseSocialProvider(raw: string | null): SocialProvider {
  if (raw === "kakao" || raw === "google" || raw === "github") {
    return raw;
  }
  return "kakao";
}

function consumeOAuthCallbackFromUrl(): {
  idToken: string;
  provider: SocialProvider;
} | null {
  if (typeof window === "undefined") {
    return null;
  }

  const hash = window.location.hash;
  if (!hash || !hash.includes("access_token=")) {
    return null;
  }

  const params = new URLSearchParams(hash.slice(1));
  const idToken = params.get("access_token");
  const rawProvider = window.sessionStorage.getItem(PENDING_PROVIDER_SESSION_KEY);
  const provider = parseSocialProvider(rawProvider);

  window.sessionStorage.removeItem(PENDING_PROVIDER_SESSION_KEY);
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search
  );

  if (!idToken) {
    return null;
  }

  return { idToken, provider };
}

/**
 * 소셜 로그인 OAuth 리다이렉트 직전 선택한 제공자를 sessionStorage에 기록합니다.
 *
 * @param provider 사용자가 선택한 소셜 제공자 (`kakao` | `google` | `github`)
 */
export function rememberPendingOAuthProvider(provider: SocialProvider): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(PENDING_PROVIDER_SESSION_KEY, provider);
}

/**
 * 앱 최초 진입 시 0.1초 익명 게스트 세션을 자동 부트스트랩하고,
 * OAuth 콜백 유입 시 게스트 데이터를 정식 소셜 계정으로 이관하는 초기화 훅입니다.
 *
 * @returns 세션 부트스트랩 완료 여부(`isBootstrapped`)
 */
export function useGuestBootstrap(): { isBootstrapped: boolean } {
  const queryClient = useQueryClient();
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);

  useEffect(() => {
    if (useAuthStore.getState().isBootstrapped) {
      return;
    }

    const runBootstrap = async () => {
      const { setBootstrapped, setSocialProvider } = useAuthStore.getState();

      try {
        // 1. OAuth 리다이렉트 콜백(#access_token=...)이 존재하는 경우 게스트 데이터 이관 처리
        const oauthCallback = consumeOAuthCallbackFromUrl();
        if (oauthCallback) {
          const existingGuestToken = getGuestToken();
          if (existingGuestToken) {
            await linkSocialAccountApi({
              provider: oauthCallback.provider,
              idToken: oauthCallback.idToken,
            });
          }
          setAccessToken(oauthCallback.idToken);
          setAuthProvider(oauthCallback.provider);
          clearGuestToken();
          setSocialProvider(oauthCallback.provider);
          await queryClient.invalidateQueries({ queryKey: queryKeys.memos.all });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.categories.all,
          });
          setBootstrapped(true);
          return;
        }

        // 2. 기존 소셜 JWT 보유 시 소셜 세션 복원
        const accessToken = getAccessToken();
        if (accessToken) {
          const provider = parseSocialProvider(getAuthProvider());
          setSocialProvider(provider);
          setBootstrapped(true);
          return;
        }

        // 3. 기존 게스트 토큰 미보유 시 0.1초 익명 게스트 세션 + 온보딩 시드 메모 신규 발급
        if (!getGuestToken()) {
          const response = await initGuestSessionApi({
            memoId: generateUuidV7(),
            categoryId: generateUuidV7(),
          });
          setGuestToken(response.guestToken);
          await queryClient.invalidateQueries({ queryKey: queryKeys.memos.all });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.categories.all,
          });
        }

        setSocialProvider(null);
        setBootstrapped(true);
      } catch {
        // 실패 시에도 무한 재요청 루프를 방지하고, 에러 인터셉터가 전역 토스트/모달로 안내합니다.
        useFeedbackStore
          .getState()
          .showToast("error", "세션 초기화 중 문제가 발생했습니다. 새로고침해 주세요.");
      } finally {
        bootstrapInFlight = null;
        registerAuthBootstrapPromise(null);
      }
    };

    if (!bootstrapInFlight) {
      bootstrapInFlight = runBootstrap();
      registerAuthBootstrapPromise(bootstrapInFlight);
    }
  }, [queryClient]);

  return { isBootstrapped };
}
