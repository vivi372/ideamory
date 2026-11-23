"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { useAuthStore } from "@/features/auth-drawer";
import { useViewModeStore } from "@/features/view-mode";
import { useFeedbackStore } from "@/shared/lib/feedback/use-feedback";
import {
  exitAndroidApp,
  isCapacitorNative,
  tryShowNativeExitToast,
} from "@/shared/lib/native-bridge";
import {
  EXIT_CONFIRM_TOAST_MESSAGE,
  resolveNextBackAction,
} from "@/shared/lib/navigation/back-button-handler";
import { useViewStore } from "@/shared/model/view-store";

interface BackButtonProviderProps {
  children: ReactNode;
}

/**
 * 안드로이드 물리 뒤로가기 키, 제스처 뒤로가기(`popstate`) 및 Capacitor `backButton` 이벤트를
 * 단일 계층 스택으로 통합 제어하는 전역 프로바이더입니다.
 *
 * 앱이 즉시 꺼지는 현상을 방지하고, 열린 오버레이(모달 → 카테고리 시트 → 드로어)와
 * 검색/연관 필터 뷰를 역순으로 1개씩 닫은 뒤 홈 타임라인에서만 2초 내 2회 연속 입력 시 종료합니다.
 *
 * @param props 하위 애플리케이션 트리
 * @returns 프로바이더 래퍼 JSX
 */
export function BackButtonProvider({ children }: BackButtonProviderProps) {
  const lastBackPressedAtRef = useRef<number | null>(null);
  const sentinelPushedRef = useRef(false);

  useEffect(() => {
    const handleBackPress = (): boolean => {
      const authState = useAuthStore.getState();
      const viewState = useViewStore.getState();
      const viewModeState = useViewModeStore.getState();
      const feedbackState = useFeedbackStore.getState();

      const nowMs = Date.now();
      const action = resolveNextBackAction(
        {
          drawerOpen: authState.drawerOpen,
          categoryPickerOpen: Boolean(viewState.categoryPickerTarget),
          socialSheetOpen: authState.socialSheetOpen,
          legalModalOpen: Boolean(authState.legalModalType),
          feedbackModalOpen: Boolean(feedbackState.modal),
          searchActive: viewState.searchQuery.trim().length > 0,
          relatedFilterActive: Boolean(viewState.relatedFilterMemoId),
          graphNodeFocused: Boolean(viewModeState.focusedNodeId),
          viewMode: viewState.viewMode,
        },
        nowMs,
        lastBackPressedAtRef.current
      );

      switch (action) {
        case "CLOSE_FEEDBACK_MODAL":
          feedbackState.closeModal();
          return true;
        case "CLOSE_LEGAL_MODAL":
          authState.closeLegalModal();
          return true;
        case "CLOSE_SOCIAL_SHEET":
          authState.setSocialSheetOpen(false);
          return true;
        case "CLOSE_CATEGORY_PICKER":
          viewState.closeCategoryPicker();
          return true;
        case "CLOSE_DRAWER":
          authState.setDrawerOpen(false);
          return true;
        case "CLEAR_SEARCH":
          viewState.clearSearch();
          return true;
        case "CLEAR_RELATED_FILTER":
          viewState.setRelatedFilterMemo(null);
          return true;
        case "CLEAR_GRAPH_FOCUS":
          viewModeState.clearFocus();
          return true;
        case "RESET_VIEW_TO_ALL":
          viewState.resetView();
          return true;
        case "SHOW_EXIT_PROMPT": {
          lastBackPressedAtRef.current = nowMs;
          const handledByNative = tryShowNativeExitToast(
            EXIT_CONFIRM_TOAST_MESSAGE
          );
          if (!handledByNative) {
            feedbackState.showToast("info", EXIT_CONFIRM_TOAST_MESSAGE, 2000);
          }
          return true;
        }
        case "EXIT_APP":
          lastBackPressedAtRef.current = null;
          exitAndroidApp();
          return false;
      }
    };

    // 1. 커스텀 안드로이드 WebView JavascriptInterface 위임 훅 등록
    const bridge = window.AndroidBridge ?? {};
    bridge.onBackPressed = handleBackPress;
    window.AndroidBridge = bridge;

    // 2. 모바일 제스처/브라우저 popstate 가로채기용 히스토리 센티넬 푸시
    if (!sentinelPushedRef.current) {
      window.history.pushState({ ideamoryGuard: true }, "");
      sentinelPushedRef.current = true;
    }

    const onPopState = () => {
      const consumed = handleBackPress();
      // 오버레이를 닫았거나 종료 확인 1회차인 경우 센티넬을 복원해 다음 뒤로가기도 가로챔
      if (consumed) {
        window.history.pushState({ ideamoryGuard: true }, "");
      }
    };
    window.addEventListener("popstate", onPopState);

    // 3. Capacitor 네이티브 환경인 경우 하드웨어 뒤로가기 이벤트 구독
    let removeCapacitorListener: (() => Promise<void>) | undefined;
    if (isCapacitorNative()) {
      void CapacitorApp.addListener("backButton", () => {
        handleBackPress();
      }).then((handle) => {
        removeCapacitorListener = () => handle.remove();
      });
    }

    return () => {
      window.removeEventListener("popstate", onPopState);
      if (removeCapacitorListener) {
        void removeCapacitorListener();
      }
      if (window.AndroidBridge?.onBackPressed === handleBackPress) {
        delete window.AndroidBridge.onBackPressed;
      }
    };
  }, []);

  return <>{children}</>;
}
