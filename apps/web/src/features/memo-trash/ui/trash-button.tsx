"use client";

import { RotateCcw, Trash2 } from "lucide-react";

export interface TrashButtonProps {
  /** 휴지통 뷰 여부 (`true`면 복구 버튼, `false`면 버리기 버튼 렌더링) */
  isTrash?: boolean;
  /** 클릭 시 실행할 삭제 또는 복구 핸들러 */
  onAction: () => void;
}

/**
 * 메모 카드 우측 상단에 배치되는 원클릭 버리기(Soft Delete) 또는 휴지통 복구 버튼입니다.
 *
 * @param props 휴지통 모드 여부 및 액션 콜백
 * @returns 액션 버튼 JSX
 */
export function TrashButton({ isTrash = false, onAction }: TrashButtonProps) {
  if (isTrash) {
    return (
      <button
        type="button"
        className="inline-flex h-7 items-center gap-1 rounded-md border border-cyan-400/30 bg-sky-900/30 px-2.5 text-[11px] font-medium text-cyan-200 transition hover:border-cyan-300 hover:bg-sky-800/40"
        onClick={onAction}
        aria-label="메모 복구"
      >
        <RotateCcw size={12} aria-hidden="true" />
        <span>복구</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-sky-900/20 text-slate-400 transition hover:bg-rose-950/50 hover:text-rose-300"
      onClick={onAction}
      aria-label="휴지통으로 버리기"
      title="휴지통으로 버리기"
    >
      <Trash2 size={14} aria-hidden="true" />
    </button>
  );
}
