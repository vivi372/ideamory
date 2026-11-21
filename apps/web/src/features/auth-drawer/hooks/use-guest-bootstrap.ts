"use client";

import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { App as CapacitorApp } from "@capacitor/app";
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
import { isCapacitorNative } from "@/shared/lib/native-bridge";
import { generateUuidV7 } from "@/shared/lib/uuid-v7";
import { initGuestSessionApi, linkSocialAccountApi } from "../api/auth.api";
import { useAuthStore, type SocialProvider } from "../model/auth-store";

const PENDING_PROVIDER_STORAGE_KEY = "ideamory_pending_oauth_provider";
const PENDING_PROVIDER_CLEANUP_DELAY_MS = 1500;

function clearPendingProviderStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(PENDING_PROVIDER_STORAGE_KEY);
  } catch {
    // localStorage 접근 불가 환경 폴백
  }
  try {
    window.sessionStorage.removeItem(PENDING_PROVIDER_STORAGE_KEY);
  } catch {
    // sessionStorage 정리 실패 무시
  }
}

function hasPendingProviderInStorage(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    if (window.localStorage.getItem(PENDING_PROVIDER_STORAGE_KEY)) {
      return true;
    }
  } catch {
    // 무시
  }
  try {
    return Boolean(window.sessionStorage.getItem(PENDING_PROVIDER_STORAGE_KEY));
  } catch {
    return false;
  }
}

/**
 * React 19 StrictMode 개발 환경에서 마운트 2회 실행 시 `POST /api/v1/auth/guest/init`가
 * 중복 호출되어 시드 메모가 2번 생성되는 것을 방지하기 위한 모듈 단위 진행 중 Promise 가드입니다.
 */
let bootstrapInFlight: Promise<void> | null = null;

/**
 * 외부 브라우저 OAuth 딥링크 복귀 시 동일한 콜백 토큰이 중복 이관(`linkSocialAccountApi`)되는 것을
 * 방지하기 위해 처리 완료/진행 중인 토큰을 기록합니다.
 */
const processedOAuthTokens = new Set<string>();
let oauthCallbackInFlight: Promise<boolean> | null = null;

function parseSocialProvider(raw: string | null): SocialProvider {
  if (raw === "kakao" || raw === "google" || raw === "github") {
    return raw;
  }
  return "kakao";
}

function readAndClearPendingProvider(): SocialProvider {
  if (typeof window === "undefined") {
    return "kakao";
  }

  let rawProvider: string | null = null;
  try {
    rawProvider = window.localStorage.getItem(PENDING_PROVIDER_STORAGE_KEY);
    window.localStorage.removeItem(PENDING_PROVIDER_STORAGE_KEY);
  } catch {
    // localStorage 접근 불가 환경 폴백
  }

  if (!rawProvider) {
    try {
      rawProvider = window.sessionStorage.getItem(PENDING_PROVIDER_STORAGE_KEY);
    } catch {
      // sessionStorage 접근 불가 환경 폴백
    }
  }
  try {
    window.sessionStorage.removeItem(PENDING_PROVIDER_STORAGE_KEY);
  } catch {
    // sessionStorage 정리 실패 무시
  }

  return parseSocialProvider(rawProvider);
}

interface ParsedOAuthCallback {
  idToken: string | null;
  provider: SocialProvider;
  errorMessage?: string;
}

/**
 * 전달받은 URL 문자열(웹 `window.location.href` 또는 Capacitor 딥링크 `com.ideamory.app://auth/callback#access_token=...`)에서
 * Supabase OAuth 콜백 토큰 및 에러 정보를 추출합니다.
 */
function parseOAuthCallbackFromUrlString(
  rawUrl: string,
  cleanBrowserUrl: boolean
): ParsedOAuthCallback | null {
  if (typeof window === "undefined" || !rawUrl) {
    return null;
  }

  const hashIndex = rawUrl.indexOf("#");
  const hashString = hashIndex >= 0 ? rawUrl.slice(hashIndex + 1) : "";
  const queryIndex = rawUrl.indexOf("?");
  const queryEnd = hashIndex >= 0 ? hashIndex : rawUrl.length;
  const queryString =
    queryIndex >= 0 && queryIndex < queryEnd
      ? rawUrl.slice(queryIndex + 1, queryEnd)
      : "";

  const hashParams = new URLSearchParams(hashString);
  const queryParams = new URLSearchParams(queryString);
  const idToken = hashParams.get("access_token");
  const errorMessage =
    hashParams.get("error_description") ??
    queryParams.get("error_description") ??
    hashParams.get("error") ??
    queryParams.get("error") ??
    undefined;

  if (!idToken && !errorMessage) {
    return null;
  }

  const provider = readAndClearPendingProvider();

  if (cleanBrowserUrl) {
    window.history.replaceState(
      null,
      "",
      window.location.pathname
    );
  }

  return {
    idToken,
    provider,
    errorMessage,
  };
}

/**
 * OAuth 콜백 토큰을 검증하여 게스트 데이터 이관 및 정식 소셜 세션 전환을 수행합니다.
 */
async function handleOAuthCallback(
  callback: ParsedOAuthCallback,
  queryClient: QueryClient
): Promise<boolean> {
  if (callback.errorMessage || !callback.idToken) {
    useFeedbackStore
      .getState()
      .showToast(
        "error",
        callback.errorMessage
          ? `소셜 로그인에 실패했습니다: ${callback.errorMessage}`
          : "소셜 로그인 토큰을 확인하지 못했습니다."
      );
    return false;
  }

  const { idToken, provider } = callback;
  if (processedOAuthTokens.has(idToken)) {
    return true;
  }
  if (oauthCallbackInFlight) {
    return oauthCallbackInFlight;
  }

  const run = async (): Promise<boolean> => {
    const { setBootstrapped, setSocialProvider, setSocialSheetOpen, setDrawerOpen } =
      useAuthStore.getState();
    const existingGuestToken = getGuestToken();

    try {
      if (existingGuestToken) {
        await linkSocialAccountApi({
          provider,
          idToken,
        });
      }
      processedOAuthTokens.add(idToken);
      setAccessToken(idToken);
      setAuthProvider(provider);
      clearGuestToken();
      setSocialProvider(provider);
      setSocialSheetOpen(false);
      setDrawerOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.memos.all });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.categories.all,
      });
      setBootstrapped(true);
      useFeedbackStore
        .getState()
        .showToast("info", "소셜 계정 연동이 완료되었습니다.");
      return true;
    } catch {
      useFeedbackStore
        .getState()
        .showToast(
          "error",
          "소셜 계정 연동 처리 중 오류가 발생했습니다. 다시 시도해 주세요."
        );
      return false;
    }
  };

  oauthCallbackInFlight = run().finally(() => {
    oauthCallbackInFlight = null;
  });

  return oauthCallbackInFlight;
}

/**
 * 소셜 로그인 OAuth 리다이렉트 직전 선택한 제공자를 localStorage 및 sessionStorage에 기록합니다.
 * 외부 브라우저 인증 후 안드로이드 앱 딥링크 복귀 시 프로세스 재시작에도 유지되도록 localStorage를 함께 사용합니다.
 *
 * @param provider 사용자가 선택한 소셜 제공자 (`kakao` | `google` | `github`)
 */
export function rememberPendingOAuthProvider(provider: SocialProvider): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(PENDING_PROVIDER_STORAGE_KEY, provider);
  } catch {
    // localStorage 접근 불가 시 무시
  }
  try {
    window.sessionStorage.setItem(PENDING_PROVIDER_STORAGE_KEY, provider);
  } catch {
    // sessionStorage 접근 불가 시 무시
  }
}

/**
 * 앱 최초 진입 시 0.1초 익명 게스트 세션을 자동 부트스트랩하고,
 * 웹 리다이렉트 및 안드로이드 딥링크 OAuth 콜백 유입 시 게스트 데이터를 정식 소셜 계정으로 이관하는 초기화 훅입니다.
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
        // 1. 웹 URL(#access_token=...) 또는 Capacitor 콜드 스타트 딥링크(getLaunchUrl) OAuth 콜백 확인
        let oauthCallback = parseOAuthCallbackFromUrlString(
          window.location.href,
          true
        );

        if (!oauthCallback && isCapacitorNative()) {
          try {
            const launch = await CapacitorApp.getLaunchUrl();
            if (launch?.url) {
              oauthCallback = parseOAuthCallbackFromUrlString(
                launch.url,
                false
              );
            }
          } catch {
            // getLaunchUrl 조회 실패 시 일반 부트스트랩 계속 진행
          }
        }

        if (oauthCallback) {
          const handled = await handleOAuthCallback(oauthCallback, queryClient);
          if (handled) {
            return;
          }
        } else {
          // 콜드 스타트 시 OAuth 콜백 URL이 없다면 이전 세션에서 취소된 잔류 제공자 키를 정리
          clearPendingProviderStorage();
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

  // Capacitor 네이티브 환경: 외부 브라우저에서 로그인 후 딥링크(com.ideamory.app://auth/callback#access_token=...)로
  // 포그라운드 복귀할 때 실시간으로 OAuth 토큰을 수신해 게스트 데이터 이관 및 세션 전환을 수행합니다.
  // 사용자가 인증을 취소하고 딥링크 없이 앱으로 복귀한 경우에는 유예 시간 후 잔류 제공자 키를 정리합니다.
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cleanupTimer: number | null = null;

    const cancelPendingCleanup = () => {
      if (cleanupTimer !== null) {
        window.clearTimeout(cleanupTimer);
        cleanupTimer = null;
      }
    };

    const schedulePendingCleanup = () => {
      if (!hasPendingProviderInStorage()) {
        return;
      }
      cancelPendingCleanup();
      cleanupTimer = window.setTimeout(() => {
        cleanupTimer = null;
        if (!oauthCallbackInFlight) {
          clearPendingProviderStorage();
        }
      }, PENDING_PROVIDER_CLEANUP_DELAY_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        schedulePendingCleanup();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    let removeUrlListener: (() => Promise<void>) | undefined;
    let removeStateListener: (() => Promise<void>) | undefined;
    let isUnmounted = false;

    if (isCapacitorNative()) {
      void CapacitorApp.addListener("appUrlOpen", ({ url }) => {
        cancelPendingCleanup();
        const oauthCallback = parseOAuthCallbackFromUrlString(url, false);
        if (oauthCallback) {
          void handleOAuthCallback(oauthCallback, queryClient);
        }
      }).then((handle) => {
        if (isUnmounted) {
          void handle.remove();
          return;
        }
        removeUrlListener = () => handle.remove();
      });

      void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          schedulePendingCleanup();
        }
      }).then((handle) => {
        if (isUnmounted) {
          void handle.remove();
          return;
        }
        removeStateListener = () => handle.remove();
      });
    }

    return () => {
      isUnmounted = true;
      cancelPendingCleanup();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (removeUrlListener) {
        void removeUrlListener();
      }
      if (removeStateListener) {
        void removeStateListener();
      }
    };
  }, [queryClient]);

  return { isBootstrapped };
}
