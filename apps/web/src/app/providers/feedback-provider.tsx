"use client";

import { useEffect, type ReactNode } from "react";
import { subscribeApiError, type ApiErrorEvent } from "@/shared/api";
import {
  useFeedbackStore,
  type ToastKind,
} from "@/shared/lib/feedback/use-feedback";
import { FeedbackDialog, FeedbackToastViewport } from "@/shared/ui";

const UX_TAG_TO_TOAST_KIND: Partial<Record<ApiErrorEvent["uxTag"], ToastKind>> = {
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
};

/**
 * 3-1의 `error-dispatcher` 이벤트를 전역 구독하여 Radix Toast & Dialog 피드백 UI로
 * 라우팅하는 애플리케이션 루트 피드백 Provider입니다.
 *
 * FSD 단방향 레이어링 원칙에 따라 `shared/api`와 `shared/ui`는 서로 직접 참조하지 않으며,
 * 오직 최상위 `app/providers` 레이어에서만 두 모듈을 연결합니다.
 *
 * @param props 하위 React 노드
 * @returns 피드백 Toast/Dialog가 마운트된 레이아웃 래퍼
 */
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const toasts = useFeedbackStore((state) => state.toasts);
  const modal = useFeedbackStore((state) => state.modal);
  const dismissToast = useFeedbackStore((state) => state.dismissToast);
  const closeModal = useFeedbackStore((state) => state.closeModal);

  useEffect(() => {
    const unsubscribe = subscribeApiError((event) => {
      const { showToast, openAlert, openConfirm, openFatal } =
        useFeedbackStore.getState();

      const toastKind = UX_TAG_TO_TOAST_KIND[event.uxTag];
      if (toastKind) {
        showToast(toastKind, event.message);
        return;
      }

      if (event.uxTag === "ALERT") {
        openAlert({
          title: "안내",
          description: event.message,
        });
        return;
      }

      if (event.uxTag === "CONFIRM") {
        void openConfirm({
          title: "확인이 필요합니다",
          description: event.message,
          confirmLabel: "확인",
          destructive: false,
        });
        return;
      }

      if (event.uxTag === "FATAL") {
        openFatal({
          title: "일시적인 시스템 오류가 발생했습니다",
          description: event.message,
          traceId: event.traceId,
          onRetry: () => window.location.reload(),
          onGoHome: () => window.location.assign("/"),
        });
      }
    });

    return unsubscribe;
  }, []);

  return (
    <>
      {children}
      <FeedbackToastViewport toasts={toasts} onDismiss={dismissToast} />
      <FeedbackDialog modal={modal} onClose={closeModal} />
    </>
  );
}
