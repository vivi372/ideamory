"use client";

import { useEffect, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Check, X } from "lucide-react";

export interface InlineEditorProps {
  /** 편집 대상 메모의 기존 본문 */
  initialContent: string;
  /** 변경된 본문 저장 콜백 */
  onSave: (nextContent: string) => void;
  /** 편집 취소 및 뷰 모드 복귀 콜백 */
  onCancel: () => void;
}

/**
 * 별도 상세 페이지 이동 없이 카드 내부에서 즉시 본문을 수정하는
 * `react-textarea-autosize` 기반 1-Depth 인라인 편집기입니다.
 *
 * 포커스 아웃(Blur) 또는 `[완료]` 버튼 터치 시 기존 텍스트와 다를 경우에만 저장을 호출하고,
 * 공백만 남거나 기존 내용과 동일하면 불필요한 API 호출 없이 편집 모드를 종료합니다.
 *
 * @param props 초기 본문, 저장/취소 콜백
 * @returns 인라인 텍스트 영역 및 완료/취소 액션 JSX
 */
export function InlineEditor({
  initialContent,
  onSave,
  onCancel,
}: InlineEditorProps) {
  const [draft, setDraft] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      const length = el.value.length;
      el.setSelectionRange(length, length);
    }
  }, []);

  const commitIfChanged = () => {
    if (committedRef.current) {
      return;
    }
    committedRef.current = true;

    const trimmed = draft.trim();
    if (!trimmed || trimmed === initialContent.trim()) {
      onCancel();
      return;
    }
    onSave(trimmed);
  };

  return (
    <div className="space-y-2">
      <TextareaAutosize
        ref={textareaRef}
        value={draft}
        minRows={3}
        maxRows={14}
        aria-label="메모 본문 수정"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitIfChanged}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            committedRef.current = true;
            onCancel();
            return;
          }
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            commitIfChanged();
          }
        }}
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md bg-slate-800/80 px-2.5 text-xs text-slate-300 hover:bg-slate-700"
          onMouseDown={(event) => {
            event.preventDefault();
            committedRef.current = true;
            onCancel();
          }}
        >
          <X size={13} aria-hidden="true" />
          <span>취소</span>
        </button>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1 rounded-md bg-cyan-400 px-2.5 text-xs font-semibold text-slate-950 hover:bg-cyan-300"
          onMouseDown={(event) => {
            event.preventDefault();
            commitIfChanged();
          }}
        >
          <Check size={13} aria-hidden="true" />
          <span>완료</span>
        </button>
      </div>
    </div>
  );
}
