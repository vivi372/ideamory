"use client";

import { useEffect, useRef, useState } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { RotateCcw } from "lucide-react";
import { isMobileTouchDevice } from "@/shared/lib/native-bridge";

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
 * 데스크톱에서는 포커스 아웃(Blur) 또는 `Enter` 입력 시 저장(`Shift + Enter`로 줄바꿈)하며,
 * 터치 기반 모바일 환경에서는 `Enter`로 줄바꿈을 입력하고 에디터 바깥 영역 터치(Blur) 시 저장합니다.
 * 하단에는 수정 내용을 되돌리는 단일 복원 아이콘 버튼만 배치하여 화면 밀도를 최소화합니다.
 *
 * @param props 초기 본문, 저장/취소 콜백
 * @returns 인라인 텍스트 영역 및 단일 복원 아이콘 버튼 JSX
 */
export function InlineEditor({
  initialContent,
  onSave,
  onCancel,
}: InlineEditorProps) {
  const [draft, setDraft] = useState(initialContent);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    setIsMobileDevice(isMobileTouchDevice());
  }, []);

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
    <div style={{ position: "relative" }}>
      <TextareaAutosize
        ref={textareaRef}
        value={draft}
        minRows={1}
        maxRows={14}
        enterKeyHint={isMobileDevice ? "enter" : "done"}
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
          if (
            !isMobileDevice &&
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            commitIfChanged();
          }
        }}
      />
      <div
        className="note-actions inline-actions inline-editor-actions"
        style={{ position: "absolute", right: 0, bottom: 2, zIndex: 2, margin: 0 }}
      >
        <button
          type="button"
          aria-label="수정 취소 및 복원"
          title="수정 취소 및 복원"
          onMouseDown={(event) => {
            event.preventDefault();
            committedRef.current = true;
            onCancel();
          }}
        >
          <RotateCcw size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
