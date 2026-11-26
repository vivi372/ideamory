"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clipboard, Plus, Search, Sparkles, X } from "lucide-react";
import {
  isMobileTouchDevice,
  useAndroidShareTarget,
} from "@/shared/lib/native-bridge";
import { generateUuidV7 } from "@/shared/lib/uuid-v7";
import { useAiModeStore } from "@/shared/model/ai-mode-store";
import { useViewStore } from "@/shared/model/view-store";
import {
  extractValidClipboardUrl,
  splitLeadingCategoryHighlight,
} from "../lib/capture-parser";
import { useCreateMemo } from "../model/use-create-memo";

const MAX_MEMO_LENGTH = 5000;
const BASE_TEXTAREA_HEIGHT = 24;
/** 1줄 입력 시 Android WebView 폰트 메트릭(25~27px)으로 오탐 확장되는 현상을 막기 위한 2줄 판정 임계치 */
const MULTILINE_EXPAND_THRESHOLD = 32;

export interface CaptureInputProps {
  /** AI 질의 모드에서 질문 전송 시 호출되는 콜백 */
  onAiSubmit?: (query: string) => void;
  /** AI 브리핑 요청 진행 여부 */
  isAiSearching?: boolean;
}

/**
 * 모바일 한 손 조작성(Thumb-Zone)에 최적화된 0.1초 퀵 캡처 & AI 질의 겸용 하단 입력 바입니다.
 *
 * [설계 원칙]
 * 1. **Zero-Friction & 스크롤 없는 확장 입력란**: 기본 1줄(`24px` 알약형)에서 텍스트 줄바꿈/길이에 따라
 *    스크롤 없이 최대 뷰포트 `35vh`까지 부드럽게 확장(`.is-expanded`)됩니다.
 * 2. **보편적 단축키**: `Enter`로 즉시 저장/AI 전송(IME 조합 중 방어), `Shift + Enter`로 줄바꿈을 지원합니다.
 * 3. **썸존 `[AI]` 모드 토글**: 좌측 `[AI]` 버튼 활성화 시 우측 버튼이 150ms 모핑으로 `[🔍]`로 전환되며,
 *    전송 즉시 입력창을 비우고 포커스를 해제해 가상 키보드를 내려 포커스 브리핑 영역을 확보합니다.
 * 4. **휴지통 뷰 자동 숨김**: `viewMode === "TRASH"` 상태에서는 캡처 바를 숨깁니다.
 *
 * @param props AI 질의 제출 콜백 및 로딩 상태
 * @returns 하단 썸존 퀵 캡처 JSX (휴지통 뷰에서는 null)
 */
export function CaptureInput({
  onAiSubmit,
  isAiSearching = false,
}: CaptureInputProps) {
  const viewMode = useViewStore((state) => state.viewMode);
  const { mutate: createMemo } = useCreateMemo();
  const isAiMode = useAiModeStore((state) => state.isAiMode);
  const toggleAiMode = useAiModeStore((state) => state.toggleAiMode);

  const [value, setValue] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [dismissedUrl, setDismissedUrl] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMobileDevice(isMobileTouchDevice());
  }, []);

  const directiveHighlight = useMemo(
    () => splitLeadingCategoryHighlight(value),
    [value]
  );
  const hasDirectiveHighlight = directiveHighlight.directive !== null;

  /**
   * 퍼블리싱 규격에 맞춰 입력란 높이를 스크롤 없이 내용량에 맞게 자동 조절합니다.
   */
  const syncTextareaHeight = useCallback((el: HTMLTextAreaElement | null, nextText: string) => {
    if (!el || typeof window === "undefined") {
      return;
    }
    el.style.height = "0px";
    const maxHeight = Math.max(BASE_TEXTAREA_HEIGHT, window.innerHeight * 0.35);
    const measuredHeight = nextText
      ? Math.max(BASE_TEXTAREA_HEIGHT, Math.min(el.scrollHeight, maxHeight))
      : BASE_TEXTAREA_HEIGHT;
    const expanded = measuredHeight > MULTILINE_EXPAND_THRESHOLD;
    const nextHeight = expanded ? measuredHeight : BASE_TEXTAREA_HEIGHT;
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    setIsExpanded(expanded);
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
      setFieldError(
        isAiMode ? "질문 내용을 입력해 주세요." : "메모 내용을 입력해 주세요."
      );
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

    if (isAiMode) {
      textareaRef.current?.blur();
      onAiSubmit?.(trimmed);
      return;
    }

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
      {!isAiMode && clipboardUrl ? (
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

      <div
        className={`capture-box${isExpanded ? " is-expanded" : ""}${isAiMode ? " is-ai-mode" : ""}`}
      >
        <button
          type="button"
          className={`ai-mode-toggle shrink-0${isAiMode ? " is-active" : ""}`}
          onClick={() => {
            toggleAiMode();
            setFieldError(null);
            textareaRef.current?.focus();
          }}
          aria-pressed={isAiMode}
          aria-label={isAiMode ? "AI 검색 모드 끄기" : "AI 검색 모드 켜기"}
        >
          <Sparkles size={14} aria-hidden="true" />
          <span>AI</span>
        </button>
        <div className="capture-input-wrap">
          {!isAiMode && hasDirectiveHighlight ? (
            <div
              ref={backdropRef}
              className="capture-highlight-backdrop"
              aria-hidden="true"
            >
              {directiveHighlight.leadingWhitespace}
              <span className="capture-directive-highlight">
                {directiveHighlight.directive}
              </span>
              {directiveHighlight.rest}
              {value.endsWith("\n") ? "\n " : ""}
            </div>
          ) : null}
          <textarea
            ref={textareaRef}
            className={
              !isAiMode && hasDirectiveHighlight
                ? "has-directive-highlight"
                : undefined
            }
            value={value}
            rows={1}
            enterKeyHint={isAiMode ? "search" : isMobileDevice ? "enter" : "send"}
            placeholder={
              isAiMode
                ? "내 메모에 대해 무엇이든 물어보세요..."
                : "지금 떠오른 생각을 기록하세요..."
            }
            aria-label={isAiMode ? "AI 질문 입력" : "빠른 메모 입력"}
            onFocus={() => {
              if (!isAiMode) {
                void checkClipboardForUrl();
              }
            }}
            onScroll={(event) => {
              if (backdropRef.current) {
                backdropRef.current.scrollTop = event.currentTarget.scrollTop;
              }
            }}
            onChange={(event) => {
              const nextText = event.target.value;
              setValue(nextText);
              syncTextareaHeight(event.currentTarget, nextText);
              if (backdropRef.current) {
                backdropRef.current.scrollTop = event.currentTarget.scrollTop;
              }
              if (fieldError) {
                setFieldError(null);
              }
            }}
            onKeyDown={(event) => {
              if (
                !(isMobileDevice && !isAiMode) &&
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
        <button
          type="button"
          className={`save-button shrink-0${isAiMode ? " is-ai-mode" : ""}`}
          onClick={handleSubmit}
          disabled={isAiMode && isAiSearching}
          aria-label={isAiMode ? "AI 질문 전송" : "메모 저장"}
        >
          {isAiMode ? (
            <>
              <Search size={17} aria-hidden="true" />
              <span>검색</span>
            </>
          ) : (
            <>
              {trimmed ? (
                <Check size={17} aria-hidden="true" />
              ) : (
                <Plus size={18} aria-hidden="true" />
              )}
              <span>저장</span>
            </>
          )}
        </button>
      </div>

      {fieldError ? <p className="field-error">{fieldError}</p> : null}
    </div>
  );
}
