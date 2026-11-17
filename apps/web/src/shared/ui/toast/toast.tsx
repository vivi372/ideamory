"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { Check, CircleAlert, TriangleAlert, X } from "lucide-react";
import type { FeedbackToastItem, ToastKind } from "../../lib/feedback/use-feedback";

interface FeedbackToastViewportProps {
  /** 화면에 표시할 활성 토스트 목록 */
  toasts: FeedbackToastItem[];
  /** 토스트 닫힘 시 호출되는 콜백 */
  onDismiss: (id: string) => void;
}

const TOAST_ICON_MAP: Record<ToastKind, typeof Check> = {
  info: Check,
  warn: TriangleAlert,
  error: CircleAlert,
};

/**
 * WAI-ARIA 접근성을 준수하는 `@radix-ui/react-toast` 기반 전역 토스트 뷰포트입니다.
 *
 * 헤드리스 Radix UI를 채택하여 스크린 리더(`role="status"` / `aria-live`) 호환성과
 * 모바일 썸존 스와이프 제스처(`swipeDirection="right"`)를 보장하면서,
 * 시각적으로는 `publishing/`의 `.status-toast` / `.toast-info|warn|error` 다크 미니멀 디자인을 그대로 유지합니다.
 *
 * @param props 활성 토스트 배열 및 닫힘 핸들러
 * @returns Radix Toast Provider 및 Viewport JSX
 */
export function FeedbackToastViewport({
  toasts,
  onDismiss,
}: FeedbackToastViewportProps) {
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={3000}>
      {toasts.map((toast) => {
        const Icon = TOAST_ICON_MAP[toast.kind];
        return (
          <ToastPrimitive.Root
            key={toast.id}
            duration={toast.duration ?? 3000}
            className={`status-toast toast-${toast.kind}`}
            onOpenChange={(open) => {
              if (!open) {
                onDismiss(toast.id);
              }
            }}
          >
            <Icon size={17} aria-hidden="true" />
            <ToastPrimitive.Description asChild>
              <span>{toast.message}</span>
            </ToastPrimitive.Description>
            <ToastPrimitive.Close asChild>
              <button type="button" aria-label="알림 닫기">
                <X size={14} />
              </button>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="toast-viewport" />
    </ToastPrimitive.Provider>
  );
}
