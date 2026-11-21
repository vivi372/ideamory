"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
} from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Globe, Sparkles } from "lucide-react";
import type { MemoResponseDto } from "@ideamory/api-spec";
import { useFeedbackStore } from "@/shared/lib/feedback/use-feedback";
import {
  extractHostname,
  formatMemoTimestamp,
  isInternalGuideUrl,
  MEMO_URL_EXTRACT_REGEX,
  pickMarkerClass,
} from "../lib/memo-card.helper";

const LONG_PRESS_DURATION_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

async function copyMemoContentToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 모바일 웹뷰/비보안 컨텍스트 등 Clipboard API 실패 시 execCommand 폴백 시도
    }
  }

  if (typeof document === "undefined") {
    return false;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export interface MemoCardProps {
  /** 렌더링할 메모 DTO */
  memo: MemoResponseDto;
  /** 인라인 편집 활성화 여부 */
  isEditing?: boolean;
  /** 휴지통 뷰 여부 (편집 및 카테고리 피커 비활성화) */
  isTrash?: boolean;
  /** AI 백그라운드 분류/임베딩 대기 여부 */
  isCategorizing?: boolean;
  /** 본문 터치 시 인라인 편집 진입 콜백 */
  onStartEdit?: (memo: MemoResponseDto) => void;
  /** 상단 카테고리 배지 터치 시 카테고리 피커 오픈 콜백 */
  onCategoryClick?: (memo: MemoResponseDto) => void;
  /** 인라인 편집기 슬롯 (`features/memo-edit`에서 주입) */
  editorSlot?: ReactNode;
  /** 우측 상단 액션 버튼 슬롯 (`features/memo-trash`에서 주입) */
  actionSlot?: ReactNode;
  /** 카드 하단 푸터 슬롯 (`features/related-memos` 칩 등 주입) */
  footerSlot?: ReactNode;
}

/**
 * 단일 메모를 타임라인 마커, 카테고리 배지, 본문, OGP 카드와 함께 렌더링하는 엔티티 표현 컴포넌트입니다.
 *
 * FSD 단방향 레이어링 원칙에 따라 비즈니스 뮤테이션을 직접 호출하지 않고,
 * 편집기(`editorSlot`)와 삭제/복구 버튼(`actionSlot`)을 상위 위젯으로부터 슬롯으로 주입받습니다.
 *
 * @param props 메모 DTO 및 슬롯/인터랙션 콜백
 * @returns 메모 카드 JSX
 */
export function MemoCard({
  memo,
  isEditing = false,
  isTrash = false,
  isCategorizing = false,
  onStartEdit,
  onCategoryClick,
  editorSlot,
  actionSlot,
  footerSlot,
}: MemoCardProps) {
  const effectiveAiStatus =
    memo.aiStatus ?? (isCategorizing ? "PENDING" : "COMPLETED");
  const isPendingAi = isCategorizing || effectiveAiStatus === "PENDING";
  const displayCategoryLabel = isPendingAi
    ? "ai 분류 중..."
    : effectiveAiStatus === "FAILED"
      ? "미분류"
      : memo.categoryName;
  const markerClass = pickMarkerClass(
    isPendingAi ? "미분류" : displayCategoryLabel || "미분류"
  );
  const hasUrlInContent = MEMO_URL_EXTRACT_REGEX.test(memo.content);
  const showOgpSkeleton = !isTrash && !memo.ogp && hasUrlInContent;

  const longPressTimerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const pointerOriginRef = useRef<{ x: number; y: number } | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = null;
    pointerOriginRef.current = null;
  }, []);

  useEffect(() => cancelLongPress, [cancelLongPress]);

  const handleCopyPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    cancelLongPress();
    longPressedRef.current = false;
    pointerOriginRef.current = { x: event.clientX, y: event.clientY };

    if (typeof window === "undefined") {
      return;
    }

    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      longPressedRef.current = true;
      pointerOriginRef.current = null;

      void copyMemoContentToClipboard(memo.content).then((copied) => {
        if (copied) {
          if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
            navigator.vibrate(15);
          }
          useFeedbackStore
            .getState()
            .showToast("info", "메모 내용을 클립보드에 복사했습니다.");
        } else {
          useFeedbackStore
            .getState()
            .showToast("warn", "클립보드 복사에 실패했습니다.");
        }
      });
    }, LONG_PRESS_DURATION_MS);
  };

  const handleCopyPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!pointerOriginRef.current) {
      return;
    }
    const dx = event.clientX - pointerOriginRef.current.x;
    const dy = event.clientY - pointerOriginRef.current.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) {
      cancelLongPress();
    }
  };

  const handleCopyTouchMove = (event: TouchEvent<HTMLButtonElement>) => {
    if (event.touches.length !== 1) {
      cancelLongPress();
      return;
    }
    if (!pointerOriginRef.current) {
      return;
    }
    const touch = event.touches[0];
    const dx = touch.clientX - pointerOriginRef.current.x;
    const dy = touch.clientY - pointerOriginRef.current.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) {
      cancelLongPress();
    }
  };

  return (
    <article
      className={`note-card${isEditing ? " is-editing" : ""}`}
      data-memo-id={memo.id}
    >
      <span className={`note-marker ${markerClass}`} aria-hidden="true" />

      <div className="note-meta">
        <time dateTime={memo.createdAt} className="shrink-0">
          {formatMemoTimestamp(memo.createdAt)}
        </time>

        <div className="note-meta-actions">
          <button
            type="button"
            className="category-label max-w-40 truncate"
            onClick={() => {
              if (!isTrash && !isPendingAi) {
                onCategoryClick?.(memo);
              }
            }}
            disabled={isTrash || isPendingAi}
            aria-label={
              isTrash
                ? `카테고리 ${displayCategoryLabel}`
                : isPendingAi
                  ? "ai 분류 중 (분류 완료 후 카테고리 변경 가능)"
                  : `${displayCategoryLabel} 카테고리 변경`
            }
          >
            {isPendingAi ? (
              <span className="inline-flex items-center gap-1 animate-pulse">
                <Sparkles size={11} />
                {displayCategoryLabel}
              </span>
            ) : (
              displayCategoryLabel
            )}
          </button>
          {actionSlot}
        </div>
      </div>

      <div className="note-content">
        {isEditing && editorSlot ? (
          editorSlot
        ) : (
          <button
            type="button"
            className="note-copy wrap-break-word whitespace-pre-wrap"
            onPointerDown={handleCopyPointerDown}
            onPointerMove={handleCopyPointerMove}
            onPointerUp={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onTouchMove={handleCopyTouchMove}
            onTouchCancel={cancelLongPress}
            onContextMenu={(event) => {
              if (longPressedRef.current) {
                event.preventDefault();
              }
            }}
            onClick={() => {
              if (longPressedRef.current) {
                longPressedRef.current = false;
                return;
              }
              if (!isTrash) {
                onStartEdit?.(memo);
              }
            }}
            aria-disabled={isTrash || undefined}
            aria-label={
              isTrash
                ? "휴지통 메모 본문 (길게 눌러 복사)"
                : "메모 본문 (탭하여 수정, 길게 눌러 복사)"
            }
          >
            {memo.content}
          </button>
        )}

        {memo.ogp ? (
          isInternalGuideUrl(memo.ogp.targetUrl) ? (
            <Link href="/guide" className="ogp-card">
              <div className="ogp-icon" aria-hidden="true">
                {memo.ogp.thumbnailUrl ? (
                  <img
                    src={memo.ogp.thumbnailUrl}
                    alt=""
                    className="h-full w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Globe size={15} />
                )}
              </div>
              <div>
                <strong className="truncate">
                  {memo.ogp.title || "Ideamory 사용 가이드"}
                </strong>
                {memo.ogp.description ? (
                  <span>{memo.ogp.description}</span>
                ) : null}
                <small>앱 내 사용 가이드</small>
              </div>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          ) : (
            <a
              href={memo.ogp.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ogp-card"
            >
              <div className="ogp-icon" aria-hidden="true">
                {memo.ogp.thumbnailUrl ? (
                  <img
                    src={memo.ogp.thumbnailUrl}
                    alt=""
                    className="h-full w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <Globe size={15} />
                )}
              </div>
              <div>
                <strong className="truncate">
                  {memo.ogp.title || extractHostname(memo.ogp.targetUrl)}
                </strong>
                {memo.ogp.description ? (
                  <span>{memo.ogp.description}</span>
                ) : null}
                <small>{extractHostname(memo.ogp.targetUrl)}</small>
              </div>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          )
        ) : null}

        {showOgpSkeleton ? (
          <div
            className="ogp-card animate-pulse"
            aria-label="링크 미리보기 불러오는 중"
          >
            <div className="ogp-icon" aria-hidden="true">
              <Globe size={15} />
            </div>
            <div>
              <strong>링크 메타데이터를 분석하고 있습니다...</strong>
              <span>잠시 후 제목과 요약 카드가 자동으로 표시됩니다</span>
            </div>
          </div>
        ) : null}

        {footerSlot}
      </div>
    </article>
  );
}
