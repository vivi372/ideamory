import { create } from "zustand";

/**
 * 토스트 알림 심각도 유형 (`INFO`: 안내, `WARN`: 경고, `ERROR`: 실패)
 */
export type ToastKind = "info" | "warn" | "error";

/**
 * 전역 피드백 토스트 아이템 모델
 */
export interface FeedbackToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  duration?: number;
}

/**
 * 전역 다이얼로그 모달 유형 (`alert`: 1-Button 안내, `confirm`: 2-Button 확인/취소, `fatal`: 장애 오버레이)
 */
export type FeedbackModalKind = "alert" | "confirm" | "fatal";

/**
 * 전역 피드백 다이얼로그 모달 모델
 */
export interface FeedbackModalState {
  kind: FeedbackModalKind;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** FATAL 장애 발생 시 디버깅 추적을 위해 화면에 표출할 32자리 Trace ID */
  traceId?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface FeedbackStoreState {
  toasts: FeedbackToastItem[];
  modal: FeedbackModalState | null;
  showToast: (kind: ToastKind, message: string, duration?: number) => string;
  dismissToast: (id: string) => void;
  openModal: (modal: FeedbackModalState) => void;
  closeModal: () => void;
  openAlert: (params: {
    title?: string;
    description: string;
    confirmLabel?: string;
    onConfirm?: () => void;
  }) => void;
  openConfirm: (params: {
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  }) => Promise<boolean>;
  openFatal: (params: {
    title?: string;
    description: string;
    traceId?: string;
    onRetry?: () => void;
    onGoHome?: () => void;
  }) => void;
}

let toastSequence = 0;

/**
 * 전역 Toast 알림과 Alert/Confirm/Fatal 다이얼로그 상태를 관리하는 Zustand 스토어입니다.
 * `error-dispatcher`로부터 유입되는 백엔드 UX 태그 에러와, 사용자 확인이 필요한 파괴적 작업(초기화/탈퇴/영구삭제)을
 * 일원화된 큐 및 모달 상태로 제어합니다.
 */
export const useFeedbackStore = create<FeedbackStoreState>((set, get) => ({
  toasts: [],
  modal: null,

  showToast: (kind, message, duration = 3000) => {
    toastSequence += 1;
    const id = `toast_${Date.now()}_${toastSequence}`;
    set((state) => ({
      // 토스트가 과도하게 누적되지 않도록 최근 3개만 유지
      toasts: [...state.toasts.slice(-2), { id, kind, message, duration }],
    }));
    return id;
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((item) => item.id !== id),
    }));
  },

  openModal: (modal) => {
    set({ modal });
  },

  closeModal: () => {
    set({ modal: null });
  },

  openAlert: ({ title = "안내", description, confirmLabel = "확인", onConfirm }) => {
    set({
      modal: {
        kind: "alert",
        title,
        description,
        confirmLabel,
        onConfirm: () => {
          get().closeModal();
          onConfirm?.();
        },
      },
    });
  },

  openConfirm: ({
    title,
    description,
    confirmLabel = "확인 및 삭제",
    cancelLabel = "취소",
    destructive = true,
  }) => {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        get().closeModal();
        resolve(result);
      };

      set({
        modal: {
          kind: "confirm",
          title,
          description,
          confirmLabel,
          cancelLabel,
          destructive,
          onConfirm: () => finish(true),
          onCancel: () => finish(false),
        },
      });
    });
  },

  openFatal: ({
    title = "일시적인 시스템 오류가 발생했습니다",
    description,
    traceId,
    onRetry,
    onGoHome,
  }) => {
    set({
      modal: {
        kind: "fatal",
        title,
        description,
        traceId,
        confirmLabel: "다시 시도",
        cancelLabel: "홈으로 이동",
        onConfirm: () => {
          get().closeModal();
          onRetry?.();
        },
        onCancel: () => {
          get().closeModal();
          onGoHome?.();
        },
      },
    });
  },
}));

/**
 * 컴포넌트 외부(유틸/서비스)나 컴포넌트 내부에서 간결하게 피드백 액션을 호출하기 위한 헬퍼
 */
export function useFeedback() {
  const showToast = useFeedbackStore((state) => state.showToast);
  const dismissToast = useFeedbackStore((state) => state.dismissToast);
  const openAlert = useFeedbackStore((state) => state.openAlert);
  const openConfirm = useFeedbackStore((state) => state.openConfirm);
  const openFatal = useFeedbackStore((state) => state.openFatal);

  return {
    showToast,
    dismissToast,
    openAlert,
    openConfirm,
    openFatal,
  };
}
