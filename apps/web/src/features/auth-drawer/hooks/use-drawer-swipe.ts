"use client";

import { useEffect, useRef, useState } from "react";

/** 스와이프로 드로어를 열 때 허용하는 화면 좌측 시작 비율 (45%) 및 최소 너비(160px) */
const SWIPE_OPEN_ZONE_RATIO = 0.45;
const SWIPE_OPEN_ZONE_MIN_PX = 160;

/** 스와이프 열기/닫기 판정을 위한 최소 수평 이동 거리(px) */
const SWIPE_TRIGGER_DISTANCE_PX = 40;

/** 드로어 오픈 스와이프에서 제외해야 하는 입력·오버레이 셀렉터 */
const SWIPE_IGNORE_SELECTOR =
  "input, textarea, select, [contenteditable='true'], .category-sheet, .social-sheet, .legal-sheet, .alert-dialog, .demo-modal";

export interface UseDrawerSwipeOptions {
  /** 현재 사이드바 드로어 열림 상태 */
  open: boolean;
  /** 좌측 영역에서 우측 스와이프 시 드로어를 여는 콜백 */
  onOpen?: () => void;
  /** 열린 드로어를 좌측으로 스와이프하여 닫는 콜백 */
  onClose: () => void;
}

export interface UseDrawerSwipeResult {
  /** 닫기 드래그 중인 수평 오프셋(음수 px) */
  dragOffsetX: number;
  /** 현재 좌측 닫기 드래그 제스처 진행 여부 */
  isDraggingClose: boolean;
  /** 드로어/백드롭 터치 시작 핸들러 */
  handleDrawerTouchStart: (event: React.TouchEvent<HTMLElement>) => void;
  /** 드로어/백드롭 터치 이동 핸들러 */
  handleDrawerTouchMove: (event: React.TouchEvent<HTMLElement>) => void;
  /** 드로어/백드롭 터치 종료 핸들러 */
  handleDrawerTouchEnd: () => void;
}

/**
 * 사이드바 드로어의 좌측 영역 열기 스와이프(Edge-to-Mid Open Swipe)와
 * 열린 드로어를 좌측으로 밀어 닫는 드래그 제스처(Drag-to-Close)를 제어하는 커스텀 훅입니다.
 *
 * [제스처 판정 규칙]
 * 1. 드로어가 닫혀 있을 때 화면 좌측 45%(최소 160px) 영역에서 우측으로 40px 이상(수평 변위 > 수직 변위 * 1.35)
 *    스와이프하면 `onOpen()`을 트리거합니다. 입력란 및 열린 모달 위에서 시작된 터치는 제외합니다.
 * 2. 드로어가 열려 있을 때 좌측으로 드래그하면 실시간 `translateX` 오프셋을 반영하고,
 *    -40px 이상 이동 후 손을 떼면 `onClose()`를 트리거합니다.
 *
 * @param options 드로어 열림 상태 및 열기/닫기 콜백
 * @returns 드래그 오프셋 상태 및 React 터치 이벤트 핸들러
 */
export function useDrawerSwipe({
  open,
  onOpen,
  onClose,
}: UseDrawerSwipeOptions): UseDrawerSwipeResult {
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [isDraggingClose, setIsDraggingClose] = useState(false);
  const closeTouchStartRef = useRef<{ x: number; y: number } | null>(null);

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

      // 수직 스크롤 의도가 더 크면 스와이프 추적을 즉시 취소합니다.
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

  return {
    dragOffsetX,
    isDraggingClose,
    handleDrawerTouchStart,
    handleDrawerTouchMove,
    handleDrawerTouchEnd,
  };
}
