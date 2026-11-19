"use client";

import { useEffect, useRef, useState } from "react";
import type { CategoryResponseDto } from "@ideamory/api-spec";
import { Archive, Trash2, X } from "lucide-react";
import type { ViewMode } from "@/shared/model/view-store";
import { AccountSection } from "./account-section";

/** 스와이프로 드로어를 열 때 허용하는 화면 좌측 시작 비율 (45%) 및 최소 너비(160px) */
const SWIPE_OPEN_ZONE_RATIO = 0.45;
const SWIPE_OPEN_ZONE_MIN_PX = 160;
/** 스와이프 열기/닫기 판정을 위한 최소 수평 이동 거리(px) */
const SWIPE_TRIGGER_DISTANCE_PX = 40;

/** 드로어 오픈 스와이프에서 제외해야 하는 입력·오버레이 셀렉터 */
const SWIPE_IGNORE_SELECTOR =
  "input, textarea, select, [contenteditable='true'], .category-sheet, .social-sheet, .legal-sheet, .alert-dialog, .demo-modal";

interface SidebarDrawerProps {
  /** 드로어 열림 여부 */
  open: boolean;
  /** 현재 뷰 모드 */
  viewMode: ViewMode;
  /** 현재 선택된 카테고리 UUID v7 */
  selectedCategoryId: string | null;
  /** 활성 카테고리 목록 */
  categories: CategoryResponseDto[];
  /** 전체 활성 메모 개수 */
  totalMemoCount: number;
  /** 병합 제안이 대기 중인 카테고리 ID 집합 (오렌지 닷 표시용) */
  suggestionCategoryIds: Set<string>;
  /** Zero-Profile 계정 상태 문구 */
  accountStatusLabel: string;
  /** 게스트 모드 여부 */
  isGuest: boolean;
  /** 초기화/탈퇴 진행 중 여부 */
  isMutating: boolean;
  /** 좌측 엣지 스와이프로 드로어를 여는 콜백 */
  onOpen?: () => void;
  onClose: () => void;
  onSelectAllMemos: () => void;
  onSelectCategory: (categoryId: string) => void;
  onSelectTrash: () => void;
  onOpenSocialSheet: () => void;
  onResetGuestData: () => void;
}

/**
 * 상단 햄버거 메뉴 터치 시 화면 좌측에서 슬라이딩 오픈되는 1-Depth 사이드바 드로어입니다.
 * `LIBRARY` (전체 메모, 활성 카테고리 + 병합 제안 오렌지 닷, 30일 휴지통) 및
 * 하단 `AccountSection`을 렌더링합니다.
 *
 * @param props 드로어 상태 및 뷰/계정 액션 콜백
 * @returns 사이드바 드로어 JSX
 */
export function SidebarDrawer({
  open,
  viewMode,
  selectedCategoryId,
  categories,
  totalMemoCount,
  suggestionCategoryIds,
  accountStatusLabel,
  isGuest,
  isMutating,
  onOpen,
  onClose,
  onSelectAllMemos,
  onSelectCategory,
  onSelectTrash,
  onOpenSocialSheet,
  onResetGuestData,
}: SidebarDrawerProps) {
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDraggingClose, setIsDraggingClose] = useState(false);
  const closeTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * 드로어가 닫혀 있을 때 화면 좌측 영역(최소 160px 또는 화면 폭 45% 이내)에서
   * 우측으로 자연스럽게 스와이프하면 드로어를 여는 터치 제스처를 바인딩합니다.
   * 입력란이나 다른 시트/모달 위에서 시작한 터치는 무시합니다.
   */
  useEffect(() => {
    if (open || !onOpen || typeof window === "undefined") {
      return;
    }

    let edgeStart: { x: number; y: number } | null = null;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(SWIPE_IGNORE_SELECTOR)) {
        edgeStart = null;
        return;
      }

      const touch = event.touches[0];
      const maxStartX = Math.max(
        SWIPE_OPEN_ZONE_MIN_PX,
        Math.round(window.innerWidth * SWIPE_OPEN_ZONE_RATIO)
      );
      if (touch.clientX <= maxStartX) {
        edgeStart = { x: touch.clientX, y: touch.clientY };
      } else {
        edgeStart = null;
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!edgeStart || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const deltaX = touch.clientX - edgeStart.x;
      const deltaY = Math.abs(touch.clientY - edgeStart.y);

      // 수직 스크롤 의도가 더 크면 스와이프 추적을 취소합니다.
      if (deltaY > Math.abs(deltaX) && deltaY > 18) {
        edgeStart = null;
        return;
      }

      if (deltaX >= SWIPE_TRIGGER_DISTANCE_PX && deltaX > deltaY * 1.35) {
        edgeStart = null;
        onOpen();
      }
    };

    const handleTouchEnd = () => {
      edgeStart = null;
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onOpen, open]);

  const handleDrawerTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (!open || event.touches.length !== 1) return;
    const touch = event.touches[0];
    closeTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDraggingClose(false);
  };

  const handleDrawerTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    if (!open || !closeTouchStartRef.current || event.touches.length !== 1) {
      return;
    }
    const touch = event.touches[0];
    const deltaX = touch.clientX - closeTouchStartRef.current.x;
    const deltaY = Math.abs(touch.clientY - closeTouchStartRef.current.y);

    if (!isDraggingClose) {
      if (deltaY > Math.abs(deltaX) && deltaY > 14) {
        closeTouchStartRef.current = null;
        return;
      }
      if (deltaX < -10) {
        setIsDraggingClose(true);
      }
    }

    if (deltaX < 0) {
      setDragOffsetX(deltaX);
    }
  };

  const handleDrawerTouchEnd = () => {
    if (isDraggingClose && dragOffsetX <= -SWIPE_TRIGGER_DISTANCE_PX) {
      setDragOffsetX(0);
      setIsDraggingClose(false);
      closeTouchStartRef.current = null;
      onClose();
      return;
    }

    setDragOffsetX(0);
    setIsDraggingClose(false);
    closeTouchStartRef.current = null;
  };

  return (
    <>
      {open && (
        <div
          className="drawer-backdrop"
          onClick={onClose}
          onTouchStart={handleDrawerTouchStart}
          onTouchMove={handleDrawerTouchMove}
          onTouchEnd={handleDrawerTouchEnd}
        />
      )}
      <aside
        className={`drawer ${open ? "open" : ""}`}
        aria-label="사이드바 내비게이션"
        aria-hidden={!open}
        onTouchStart={handleDrawerTouchStart}
        onTouchMove={handleDrawerTouchMove}
        onTouchEnd={handleDrawerTouchEnd}
        style={
          open && isDraggingClose
            ? {
                transform: `translateX(${Math.min(0, dragOffsetX)}px)`,
                transition: "none",
              }
            : undefined
        }
      >
        <div className="drawer-header">
          <div className="drawer-brand">
            <img src="/ideamory-logo.png" alt="Ideamory 로고" />
            <strong>IDEAMORY</strong>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="메뉴 닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-section drawer-section-first">
          <p className="drawer-caption">LIBRARY</p>
          <button
            type="button"
            className={`drawer-item ${viewMode === "ALL" ? "selected" : ""}`}
            onClick={onSelectAllMemos}
          >
            <Archive size={17} aria-hidden="true" />
            전체 메모
            <span>{totalMemoCount}</span>
          </button>

          {categories.map((category) => {
            const hasSuggestion = suggestionCategoryIds.has(category.id);
            return (
              <button
                key={category.id}
                type="button"
                className={`drawer-item ${
                  viewMode === "CATEGORY" && selectedCategoryId === category.id
                    ? "selected"
                    : ""
                }`}
                onClick={() => onSelectCategory(category.id)}
              >
                <span
                  className="dot"
                  style={
                    hasSuggestion
                      ? {
                          background: "#E9A14E",
                          boxShadow: "0 0 8px rgba(233, 161, 78, 0.55)",
                        }
                      : undefined
                  }
                />
                {category.name}
                <span>{category.memoCount ?? 0}</span>
              </button>
            );
          })}
        </div>

        <div className="drawer-bottom">
          <button
            type="button"
            className={`drawer-item ${viewMode === "TRASH" ? "selected" : ""}`}
            onClick={onSelectTrash}
          >
            <Trash2 size={17} aria-hidden="true" />
            휴지통
            <span>30일</span>
          </button>

          <AccountSection
            accountStatusLabel={accountStatusLabel}
            isGuest={isGuest}
            isMutating={isMutating}
            onOpenSocialSheet={onOpenSocialSheet}
            onResetGuestData={onResetGuestData}
          />
        </div>
      </aside>
    </>
  );
}
