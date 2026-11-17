"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardPaste, Send, X } from "lucide-react";
import { useViewStore } from "../../../shared/model/view-store";
import { extractValidClipboardUrl } from "../lib/capture-parser";
import { useCreateMemo } from "../model/use-create-memo";

const MAX_MEMO_LENGTH = 5000;

/**
 * 모바일 한 손 조작성(Thumb-Zone)에 최적화된 0.1초 퀵 캡처 하단 입력 바입니다.
 *
 * [설계 원칙]
 * 1. **Zero-Friction**: 입력창 주변에 카테고리/태그/날짜 선택 UI를 일체 배제하여 떠올린 즉시 기록합니다.
 * 2. **클립보드 URL 원클릭 포착**: 포커스/화면 복귀 시 `navigator.clipboard.readText()`를 안전하게 감지해
 *    유효한 `http(s)://` 링크가 있으면 상단에 `📋 복사한 링크 붙여넣기` 칩을 띄우고 터치 시 0ms 삽입합니다.
 * 3. **휴지통 뷰 자동 숨김**: `viewMode === "TRASH"` 상태에서는 캡처 바를 숨겨 보관함 맥락과 충돌하지 않습니다.
 *
 * @returns 하단 썸존 퀵 캡처 JSX (휴지통 뷰에서는 null)
 */
export function CaptureInput() {
  const viewMode = useViewStore((state) => state.viewMode);
  const { mutate: createMemo } = useCreateMemo();

  const [value, setValue] = useState("");
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [dismissedUrl, setDismissedUrl] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /**
   * 브라우저 클립보드에서 유효한 URL을 비침투적으로 감지합니다.
   * 권한 거부 또는 미지원 환경에서는 예외를 삼키고 조용히 무시합니다.
   */
  const checkClipboardForUrl = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.readText !== "function"
    ) {
      return;
    }

    try {
      const rawText = await navigator.clipboard.readText();
      const detectedUrl = extractValidClipboardUrl(rawText);
      if (
        detectedUrl &&
        detectedUrl !== dismissedUrl &&
        !value.includes(detectedUrl)
      ) {
        setClipboardUrl(detectedUrl);
      } else {
        setClipboardUrl(null);
      }
    } catch {
      // 클립보드 읽기 권한 미허용 환경에서는 조용히 무시
    }
  }, [dismissedUrl, value]);

  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void checkClipboardForUrl();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [checkClipboardForUrl]);

  if (viewMode === "TRASH") {
    return null;
  }

  const trimmed = value.trim();
  const isExpanded = value.includes("\n") || value.length > 42;

  const handleSubmit = () => {
    if (!trimmed) {
      setFieldError("메모 내용을 입력해 주세요.");
      textareaRef.current?.focus();
      return;
    }

    if (trimmed.length > MAX_MEMO_LENGTH) {
      setFieldError(`메모는 최대 ${MAX_MEMO_LENGTH}자까지 작성할 수 있습니다.`);
      return;
    }

    setFieldError(null);
    setValue("");
    setClipboardUrl(null);
    createMemo({ rawContent: trimmed });
  };

  const handleInsertClipboardUrl = () => {
    if (!clipboardUrl) {
      return;
    }
    const separator = value.trim().length > 0 ? "\n" : "";
    setValue((prev) => `${prev.trimEnd()}${separator}${clipboardUrl}`);
    setDismissedUrl(clipboardUrl);
    setClipboardUrl(null);
    setFieldError(null);
    textareaRef.current?.focus();
  };

  return (
    <div className="capture-zone">
      <div className="mx-auto w-full max-w-md">
        {clipboardUrl ? (
          <div className="mb-2 flex items-center justify-start">
            <div className="clipboard-chip max-w-full">
              <button
                type="button"
                className="flex min-w-0 items-center gap-2 border-0 bg-transparent p-0 text-inherit"
                onClick={handleInsertClipboardUrl}
              >
                <ClipboardPaste size={13} aria-hidden="true" className="shrink-0" />
                <span className="truncate">
                  📋 복사한 링크 붙여넣기 ({clipboardUrl})
                </span>
              </button>
              <button
                type="button"
                className="shrink-0 border-0 bg-transparent p-0 text-inherit"
                aria-label="클립보드 제안 닫기"
                onClick={() => {
                  setDismissedUrl(clipboardUrl);
                  setClipboardUrl(null);
                }}
              >
                <X size={12} />
              </button>
            </div>
          </div>
        ) : null}

        <div className={`capture-box${isExpanded ? " is-expanded" : ""}`}>
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            placeholder="떠오른 생각이나 링크를 바로 적어보세요 (@카테고리)"
            aria-label="빠른 메모 입력"
            onFocus={() => {
              void checkClipboardForUrl();
            }}
            onChange={(event) => {
              setValue(event.target.value);
              if (fieldError) {
                setFieldError(null);
              }
            }}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                handleSubmit();
              }
            }}
          />
          <button
            type="button"
            className="save-button shrink-0"
            onClick={handleSubmit}
            aria-label="메모 저장"
          >
            <Send size={16} aria-hidden="true" />
            <span>저장</span>
          </button>
        </div>

        {fieldError ? <p className="field-error">{fieldError}</p> : null}
      </div>
    </div>
  );
}
