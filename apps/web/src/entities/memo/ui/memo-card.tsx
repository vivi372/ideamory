"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Globe, Sparkles } from "lucide-react";
import type { MemoResponseDto } from "@ideamory/api-spec";

const MARKER_CLASSES = [
  "marker-cyan",
  "marker-violet",
  "marker-blue",
  "marker-amber",
] as const;

const URL_EXTRACT_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/i;

/**
 * 카테고리 이름 해시를 기반으로 타임라인 좌측 마커 색상을 결정합니다.
 */
function pickMarkerClass(categoryName: string): string {
  let sum = 0;
  for (let i = 0; i < categoryName.length; i += 1) {
    sum += categoryName.charCodeAt(i);
  }
  return MARKER_CLASSES[sum % MARKER_CLASSES.length] ?? "marker-cyan";
}

/**
 * ISO 타임스탬프를 사용자 친화적인 한국어 상대/시각 문자열로 포맷합니다.
 */
function formatMemoTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 1) {
    return "방금 전";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * URL 문자열에서 호스트명을 안전하게 추출합니다.
 */
function extractHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
}

/**
 * OGP 대상 URL이 Ideamory 자체 온보딩 가이드(`/guide`)를 가리키는지 판별합니다.
 * Capacitor 앱(`https://localhost`)이나 LAN IP 접속 시 `localhost:3000/guide` 외부 이탈을 막고
 * 동일 앱 내부 라우팅으로 이동하기 위해 사용합니다.
 */
function isInternalGuideUrl(rawUrl: string): boolean {
  if (rawUrl.startsWith("/guide")) {
    return true;
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.pathname !== "/guide") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    const currentHost =
      typeof window !== "undefined"
        ? window.location.hostname.toLowerCase()
        : "";
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "ideamory.app" ||
      (Boolean(currentHost) && host === currentHost)
    );
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
  const markerClass = pickMarkerClass(memo.categoryName || "미분류");
  const hasUrlInContent = URL_EXTRACT_REGEX.test(memo.content);
  const showOgpSkeleton = !isTrash && !memo.ogp && hasUrlInContent;

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
            className="category-label max-w-[160px] truncate"
            onClick={() => {
              if (!isTrash) {
                onCategoryClick?.(memo);
              }
            }}
            disabled={isTrash}
            aria-label={isTrash ? `카테고리 ${memo.categoryName}` : `${memo.categoryName} 카테고리 변경`}
          >
            {isCategorizing ? (
              <span className="inline-flex items-center gap-1">
                <Sparkles size={11} className="animate-pulse" />
                {memo.categoryName}
              </span>
            ) : (
              memo.categoryName
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
            className="note-copy break-words whitespace-pre-wrap"
            onClick={() => {
              if (!isTrash) {
                onStartEdit?.(memo);
              }
            }}
            disabled={isTrash}
            aria-label={isTrash ? "휴지통 메모 본문" : "메모 본문 인라인 편집"}
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
                    className="h-full w-full rounded-[8px] object-cover"
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
                    className="h-full w-full rounded-[8px] object-cover"
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
