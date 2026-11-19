"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clipboard, Plus, X } from "lucide-react";
import { useViewStore } from "../../../shared/model/view-store";
import { generateUuidV7 } from "../../../shared/lib/uuid-v7";
import { useAndroidShareTarget } from "../../native-share";
import { extractValidClipboardUrl } from "../lib/capture-parser";
import { useCreateMemo } from "../model/use-create-memo";

const MAX_MEMO_LENGTH = 5000;
const BASE_TEXTAREA_HEIGHT = 24;

/**
 * 모바일 한 손 조작성(Thumb-Zone)에 최적화된 0.1초 퀵 캡처 하단 입력 바입니다.
 *
 * [설계 원칙]
 * 1. **Zero-Friction & 스크롤 없는 확장 입력란**: 기본 1줄(`24px` 알약형)에서 텍스트 줄바꿈/길이에 따라
 *    스크롤 없이 최대 뷰포트 `35vh`까지 부드럽게 확장(`.is-expanded`)됩니다.
 * 2. **보편적 단축키**: `Enter`로 즉시 저장(IME 조합 중 방어), `Shift + Enter`로 줄바꿈을 지원합니다.
 * 3. **클립보드 URL 원클릭 포착**: 포커스/화면 복귀 시 `navigator.clipboard.readText()`를 안전하게 감지해
 *    유효한 `http(s)://` 링크가 있으면 상단에 `링크 붙여넣기` 칩을 띄우고 터치 시 0ms 삽입합니다.
 * 4. **휴지통 뷰 자동 숨김**: `viewMode === "TRASH"` 상태에서는 캡처 바를 숨깁니다.
 *
 * @returns 하단 썸존 퀵 캡처 JSX (휴지통 뷰에서는 null)
 */
export function CaptureInput() {
  const viewMode = useViewStore((state) => state.viewMode);
  const { mutate: createMemo } = useCreateMemo();

  const [value, setValue] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [dismissedUrl, setDismissedUrl] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  /**
   * 퍼블리싱 규격에 맞춰 입력란 높이를 스크롤 없이 내용량에 맞게 자동 조절합니다.
   */
  const syncTextareaHeight = useCallback((el: HTMLTextAreaElement | null, nextText: string) => {
    if (!el || typeof window === "undefined") {
      return;
    }
    el.style.height = "0px";
    const maxHeight = Math.max(BASE_TEXTAREA_HEIGHT, window.innerHeight * 0.35);
    const nextHeight = nextText
      ? Math.max(BASE_TEXTAREA_HEIGHT, Math.min(el.scrollHeight, maxHeight))
      : BASE_TEXTAREA_HEIGHT;
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    setIsExpanded(nextHeight > BASE_TEXTAREA_HEIGHT);
  }, []);

  // 안드로이드 외부 앱 '공유하기(Share Intent)' 유입 시 썸존 입력란에 0ms 즉시 주입 및 포커스
  useAndroidShareTarget(
    useCallback(
      (sharedDraft: string) => {
        setValue(sharedDraft);
        setFieldError(null);
        requestAnimationFrame(() => {
          syncTextareaHeight(textareaRef.current, sharedDraft);
          textareaRef.current?.focus();
        });
      },
      [syncTextareaHeight]
    )
  );

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
    syncTextareaHeight(textareaRef.current, "");
    createMemo({ id: generateUuidV7(), rawContent: trimmed });
  };

  const handleInsertClipboardUrl = () => {
    if (!clipboardUrl) {
      return;
    }
    const separator = value.trim().length > 0 ? "\n" : "";
    const nextValue = `${value.trimEnd()}${separator}${clipboardUrl}`;
    setValue(nextValue);
    setDismissedUrl(clipboardUrl);
    setClipboardUrl(null);
    setFieldError(null);
    requestAnimationFrame(() => {
      syncTextareaHeight(textareaRef.current, nextValue);
      textareaRef.current?.focus();
    });
  };

  return (
    <div className="capture-zone">
      {clipboardUrl ? (
        <div className="clipboard-chip">
          <button type="button" onClick={handleInsertClipboardUrl}>
            <Clipboard size={15} aria-hidden="true" />
            <span>링크 붙여넣기</span>
          </button>
          <button
            type="button"
            aria-label="클립보드 제안 닫기"
            onClick={() => {
              setDismissedUrl(clipboardUrl);
              setClipboardUrl(null);
            }}
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className={`capture-box${isExpanded ? " is-expanded" : ""}`}>
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          placeholder="지금 떠오른 생각을 기록하세요..."
          aria-label="빠른 메모 입력"
          onFocus={() => {
            void checkClipboardForUrl();
          }}
          onChange={(event) => {
            const nextText = event.target.value;
            setValue(nextText);
            syncTextareaHeight(event.currentTarget, nextText);
            if (fieldError) {
              setFieldError(null);
            }
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
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
          {trimmed ? (
            <Check size={17} aria-hidden="true" />
          ) : (
            <Plus size={18} aria-hidden="true" />
          )}
          <span>저장</span>
        </button>
      </div>

      {fieldError ? <p className="field-error">{fieldError}</p> : null}
    </div>
  );
}
