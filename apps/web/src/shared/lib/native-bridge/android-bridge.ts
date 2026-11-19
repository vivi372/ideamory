import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";

/**
 * 안드로이드 네이티브 웹뷰(또는 Capacitor 브릿지)와 통신하기 위한
 * `window.AndroidBridge` JavascriptInterface 규격입니다.
 *
 * iOS WebKit 분기 없이 안드로이드 단일 타깃으로 경량화하여 관리합니다.
 */
export interface AndroidNativeBridge {
  /** 네이티브 액티비티에서 뒤로가기 하드웨어 키를 가로채 웹으로 위임 */
  onBackPressed?: () => boolean;
  /** 앱 종료 확인 네이티브 토스트 표출 요청 */
  showExitToast?: (message: string) => void;
  /** 네이티브 액티비티 즉시 종료 */
  finishApp?: () => void;
  /** 네이티브 스플래시 화면 즉시 닫기 (0ms Fast-Path) */
  dismissNativeSplash?: () => void;
}

/**
 * 외부 앱 '공유하기(Share Intent)'를 통해 유입되는 텍스트/링크 페이로드 규격입니다.
 */
export interface ShareTargetPayload {
  text?: string;
  url?: string;
  title?: string;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidNativeBridge;
  }
}

export const ANDROID_SHARE_TARGET_EVENT = "android:share_target";

/**
 * 현재 런타임이 브라우저 클라이언트인지 안전하게 판별합니다. (Next.js SSR 가드)
 */
export function isBrowserClient(): boolean {
  return typeof window !== "undefined";
}

/**
 * 현재 환경이 Capacitor 네이티브 앱 컨텍스트(Android 등)인지 확인합니다.
 */
export function isCapacitorNative(): boolean {
  if (!isBrowserClient()) {
    return false;
  }
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/**
 * 현재 기기가 터치 기반 모바일 환경(Capacitor 앱 또는 coarse 포인터/모바일 UA)인지 판별합니다.
 * PC에서는 Enter=저장 / Shift+Enter=줄바꿈, 모바일에서는 Enter=줄바꿈 / 버튼=저장으로 분리할 때 사용합니다.
 */
export function isMobileTouchDevice(): boolean {
  if (!isBrowserClient()) {
    return false;
  }
  if (isCapacitorNative()) {
    return true;
  }
  const hasCoarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const isMobileUa =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      window.navigator.userAgent
    );
  return hasCoarsePointer || isMobileUa;
}

/**
 * URL 쿼리스트링(`?share_text=...&share_url=...&share_title=...`)에서
 * 안드로이드 Share Intent 페이로드를 파싱합니다.
 *
 * @param search `window.location.search` 문자열
 * @returns 파싱된 공유 페이로드 또는 공유 파라미터가 없으면 null
 */
export function parseShareTargetFromQuery(
  search: string
): ShareTargetPayload | null {
  if (!search) {
    return null;
  }
  const params = new URLSearchParams(search);
  const text = params.get("share_text")?.trim() || undefined;
  const url = params.get("share_url")?.trim() || undefined;
  const title = params.get("share_title")?.trim() || undefined;

  if (!text && !url && !title) {
    return null;
  }

  return { text, url, title };
}

/**
 * 전달받은 Share Target 페이로드(`title`, `text`, `url`)를 중복 없이 정돈된 단일 메모 초안으로 조합합니다.
 *
 * @param payload 공유 수신 페이로드
 * @returns 썸존 입력창에 바로 바인딩할 문자열
 */
export function formatShareDraftText(payload: ShareTargetPayload): string {
  const parts: string[] = [];
  const title = payload.title?.trim();
  const text = payload.text?.trim();
  const url = payload.url?.trim();

  if (title && text !== title) {
    parts.push(title);
  }
  if (text) {
    parts.push(text);
  }
  // text 본문 안에 이미 동일 URL이 포함되어 공유된 경우 중복 삽입 방지
  if (url && !parts.some((segment) => segment.includes(url))) {
    parts.push(url);
  }

  return parts.join("\n").trim();
}

/**
 * 정상 진입 시(Fast-Path) 안드로이드 네이티브 스플래시 화면을 0ms 지연 없이 즉시 닫습니다.
 */
export function dismissAndroidNativeSplash(): void {
  if (!isBrowserClient()) {
    return;
  }
  try {
    window.AndroidBridge?.dismissNativeSplash?.();
  } catch {
    // 네이티브 브릿지 미탑재 웹 브라우저 환경에서는 조용히 무시
  }
}

/**
 * 뒤로가기 1회 입력 시 네이티브 토스트를 요청합니다.
 * 네이티브 브릿지가 없는 일반 웹/Capacitor 환경에서는 false를 반환해 웹 토스트 폴백을 유도합니다.
 */
export function tryShowNativeExitToast(message: string): boolean {
  if (!isBrowserClient()) {
    return false;
  }
  try {
    if (typeof window.AndroidBridge?.showExitToast === "function") {
      window.AndroidBridge.showExitToast(message);
      return true;
    }
  } catch {
    // 브릿지 호출 실패 시 웹 토스트 폴백
  }
  return false;
}

/**
 * 2초 이내 연속 뒤로가기 2회 입력 시 안드로이드 앱 종료를 수행합니다.
 * 커스텀 `AndroidBridge.finishApp()`을 우선 호출하고, Capacitor 네이티브 환경이면 `App.exitApp()`을 실행합니다.
 */
export function exitAndroidApp(): void {
  if (!isBrowserClient()) {
    return;
  }
  try {
    if (typeof window.AndroidBridge?.finishApp === "function") {
      window.AndroidBridge.finishApp();
      return;
    }
    if (isCapacitorNative()) {
      void CapacitorApp.exitApp();
    }
  } catch {
    // 일반 데스크톱/모바일 브라우저 탭은 보안상 스크립트 종료가 제한되므로 무시
  }
}
