"use client";

import { useEffect, useRef } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import {
  ANDROID_SHARE_TARGET_EVENT,
  formatShareDraftText,
  isCapacitorNative,
  parseShareTargetFromQuery,
  type ShareTargetPayload,
} from "./android-bridge";

/**
 * 외부 안드로이드 앱(브라우저, 유튜브, SNS 등)에서 '공유하기'로 전달된
 * 텍스트 및 URL(Share Intent)을 수신해 0.1초 퀵 캡처 입력창에 바인딩하는 브릿지 훅입니다.
 *
 * [수신 채널]
 * 1. **URL 쿼리스트링**: `/?share_text=...&share_url=...&share_title=...` 진입 시 즉시 파싱 후
 *    `window.history.replaceState`로 주소창에서 공유 파라미터를 깔끔하게 제거합니다.
 * 2. **네이티브 커스텀 이벤트**: 포그라운드 복귀 상태에서 `window.dispatchEvent(new CustomEvent('android:share_target', ...))` 수신.
 * 3. **Capacitor `appUrlOpen`**: 딥링크/Intent URL로 백그라운드 웹뷰가 재활성화될 때 쿼리 파라미터 파싱.
 *
 * @param onShareReceived 정돈된 공유 텍스트를 썸존 입력창에 주입하는 콜백
 */
export function useAndroidShareTarget(
  onShareReceived: (draftText: string) => void
) {
  const callbackRef = useRef(onShareReceived);
  callbackRef.current = onShareReceived;

  useEffect(() => {
    const emitIfPresent = (payload: ShareTargetPayload | null) => {
      if (!payload) {
        return;
      }
      const formatted = formatShareDraftText(payload);
      if (formatted) {
        callbackRef.current(formatted);
      }
    };

    // 1-a. 안드로이드 MainActivity가 콜드 스타트 시 주입한 대기 공유 페이로드 소비
    const win = window as Window & {
      __IDEAMORY_PENDING_SHARE__?: ShareTargetPayload;
    };
    if (win.__IDEAMORY_PENDING_SHARE__) {
      emitIfPresent(win.__IDEAMORY_PENDING_SHARE__);
      delete win.__IDEAMORY_PENDING_SHARE__;
    }

    // 1-b. 초기 진입 URL 쿼리스트링에서 공유 데이터 추출 및 히스토리 정리
    const queryPayload = parseShareTargetFromQuery(window.location.search);
    if (queryPayload) {
      emitIfPresent(queryPayload);
      const url = new URL(window.location.href);
      url.searchParams.delete("share_text");
      url.searchParams.delete("share_url");
      url.searchParams.delete("share_title");
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    }

    // 2. 안드로이드 웹뷰 브릿지 CustomEvent 수신
    const handleShareEvent = (event: Event) => {
      const customEvent = event as CustomEvent<ShareTargetPayload>;
      emitIfPresent(customEvent.detail ?? null);
    };
    window.addEventListener(ANDROID_SHARE_TARGET_EVENT, handleShareEvent);

    // 3. Capacitor 네이티브 환경인 경우 appUrlOpen 이벤트 구독
    let removeUrlListener: (() => Promise<void>) | undefined;
    if (isCapacitorNative()) {
      void CapacitorApp.addListener("appUrlOpen", ({ url }) => {
        try {
          const parsedUrl = new URL(url);
          emitIfPresent(parseShareTargetFromQuery(parsedUrl.search));
        } catch {
          // 유효하지 않은 딥링크 URL 형식은 무시
        }
      }).then((handle) => {
        removeUrlListener = () => handle.remove();
      });
    }

    return () => {
      window.removeEventListener(ANDROID_SHARE_TARGET_EVENT, handleShareEvent);
      if (removeUrlListener) {
        void removeUrlListener();
      }
    };
  }, []);
}
