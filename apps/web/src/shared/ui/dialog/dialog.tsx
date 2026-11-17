"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, CircleAlert, TriangleAlert } from "lucide-react";
import type { FeedbackModalState } from "../../lib/feedback/use-feedback";

interface FeedbackDialogProps {
  /** 현재 표시할 모달 상태 (null이면 닫힘) */
  modal: FeedbackModalState | null;
  /** 모달 닫기 요청 콜백 */
  onClose: () => void;
}

/**
 * WAI-ARIA 접근성(포커스 트랩, ESC 키 닫기, 스크린 리더 레이블)을 준수하는
 * `@radix-ui/react-dialog` 기반 전역 피드백 모달입니다.
 *
 * - **`alert`**: 확인 버튼 1개짜리 안내 다이얼로그 (예: `AUTH_ALERT_SESSION_EXPIRED`)
 * - **`confirm`**: 취소/확인 2버튼 다이얼로그 (예: 게스트 초기화, 회원탈퇴, 영구 삭제)
 * - **`fatal`**: 재시도/홈 이동 버튼을 제공하는 시스템 장애 오버레이 (`SYSTEM_FATAL_*`)
 *
 * @param props 모달 상태 및 닫기 콜백
 * @returns Radix Dialog JSX
 */
export function FeedbackDialog({ modal, onClose }: FeedbackDialogProps) {
  const isOpen = modal !== null;

  const handleOpenChange = (open: boolean) => {
    if (!open && modal) {
      if (modal.kind === "confirm" || modal.kind === "fatal") {
        modal.onCancel?.();
      }
      onClose();
    }
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={handleOpenChange}>
      {modal && (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="demo-modal-layer" />
          <DialogPrimitive.Content
            className={`demo-modal demo-${modal.kind}`}
            onPointerDownOutside={(event) => {
              // 치명적 장애(FATAL) 또는 파괴적 확인(CONFIRM) 모달은 바깥 클릭 오조작 방지
              if (modal.kind === "fatal" || modal.kind === "confirm") {
                event.preventDefault();
              }
            }}
          >
            <div className="demo-modal-icon" aria-hidden="true">
              {modal.kind === "fatal" ? (
                <CircleAlert size={24} />
              ) : modal.kind === "confirm" ? (
                <TriangleAlert size={24} />
              ) : (
                <Check size={24} />
              )}
            </div>

            <DialogPrimitive.Title asChild>
              <h2>{modal.title}</h2>
            </DialogPrimitive.Title>

            <DialogPrimitive.Description asChild>
              <p>
                {modal.description}
                {modal.kind === "fatal" && modal.traceId && (
                  <>
                    <br />
                    <small style={{ opacity: 0.72, fontFamily: "ui-monospace, monospace" }}>
                      Trace ID: {modal.traceId.slice(0, 8)}
                    </small>
                  </>
                )}
              </p>
            </DialogPrimitive.Description>

            <div className="demo-modal-actions">
              {modal.kind === "confirm" ? (
                <>
                  <button type="button" onClick={() => modal.onCancel?.()}>
                    {modal.cancelLabel ?? "취소"}
                  </button>
                  <button
                    type="button"
                    className={modal.destructive !== false ? "danger-button" : "primary-demo-button"}
                    onClick={() => modal.onConfirm?.()}
                  >
                    {modal.confirmLabel ?? "확인"}
                  </button>
                </>
              ) : modal.kind === "fatal" ? (
                <>
                  <button type="button" onClick={() => modal.onConfirm?.()}>
                    {modal.confirmLabel ?? "다시 시도"}
                  </button>
                  <button type="button" onClick={() => modal.onCancel?.()}>
                    {modal.cancelLabel ?? "홈으로 이동"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="primary-demo-button"
                  onClick={() => modal.onConfirm?.()}
                >
                  {modal.confirmLabel ?? "확인"}
                </button>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
}
