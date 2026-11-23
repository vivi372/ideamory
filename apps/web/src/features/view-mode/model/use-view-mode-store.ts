"use client";

import { create } from "zustand";
import { STORAGE_KEYS } from "@/shared/config/storage-keys";
import {
  setScreenOrientationAuto,
  setScreenOrientationPortrait,
} from "@/shared/lib/native-bridge";

/**
 * 메인 화면 표시 모드입니다.
 * - CACHE: 기존 퀵 캡처 + 시간순 타임라인 리스트
 * - GRAPH: Zero-Effort AI 제텔카스텐 지식망 그래프
 */
export type DisplayMode = "CACHE" | "GRAPH";

export const DEFAULT_GRAPH_THRESHOLD = 0.8;
export const MIN_GRAPH_THRESHOLD = 0.6;
export const MAX_GRAPH_THRESHOLD = 0.85;

function clampThreshold(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_GRAPH_THRESHOLD;
  }
  const rounded = Math.round(value * 100) / 100;
  return Math.min(MAX_GRAPH_THRESHOLD, Math.max(MIN_GRAPH_THRESHOLD, rounded));
}

function syncOrientation(mode: DisplayMode): void {
  if (mode === "GRAPH") {
    setScreenOrientationAuto();
  } else {
    setScreenOrientationPortrait();
  }
}

interface ViewModeState {
  displayMode: DisplayMode;
  threshold: number;
  focusedNodeId: string | null;
  breadcrumb: string[];
  hasHydrated: boolean;
  hydrateFromStorage: () => void;
  setDisplayMode: (mode: DisplayMode) => void;
  toggleDisplayMode: () => void;
  setThreshold: (value: number) => void;
  focusNode: (memoId: string) => void;
  navigateBreadcrumb: (memoId: string) => void;
  clearFocus: () => void;
}

/**
 * 캐시 모드 ⇄ 지식망 모드 전환과 그래프 포커스/임계값 상태를 관리하는 스토어입니다.
 */
export const useViewModeStore = create<ViewModeState>((set, get) => ({
  displayMode: "CACHE",
  threshold: DEFAULT_GRAPH_THRESHOLD,
  focusedNodeId: null,
  breadcrumb: [],
  hasHydrated: false,

  hydrateFromStorage: () => {
    if (get().hasHydrated || typeof window === "undefined") {
      return;
    }

    let nextMode: DisplayMode = "CACHE";
    let nextThreshold = DEFAULT_GRAPH_THRESHOLD;

    try {
      const savedMode = window.localStorage.getItem(STORAGE_KEYS.VIEW_MODE);
      if (savedMode === "GRAPH" || savedMode === "CACHE") {
        nextMode = savedMode;
      }

      const savedThreshold = window.localStorage.getItem(
        STORAGE_KEYS.GRAPH_THRESHOLD,
      );
      if (savedThreshold !== null) {
        nextThreshold = clampThreshold(Number.parseFloat(savedThreshold));
      }
    } catch {
      // 스토리지 접근 제한 환경에서는 기본값 유지
    }

    set({
      displayMode: nextMode,
      threshold: nextThreshold,
      hasHydrated: true,
    });
    syncOrientation(nextMode);
  },

  setDisplayMode: (mode) => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.VIEW_MODE, mode);
    } catch {
      // 무시
    }
    set({
      displayMode: mode,
      ...(mode === "CACHE" ? { focusedNodeId: null, breadcrumb: [] } : {}),
    });
    syncOrientation(mode);
  },

  toggleDisplayMode: () => {
    const nextMode: DisplayMode =
      get().displayMode === "CACHE" ? "GRAPH" : "CACHE";
    get().setDisplayMode(nextMode);
  },

  setThreshold: (value) => {
    const clamped = clampThreshold(value);
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.GRAPH_THRESHOLD,
        clamped.toFixed(2),
      );
    } catch {
      // 무시
    }
    set({ threshold: clamped });
  },

  focusNode: (memoId) => {
    set((state) => {
      if (state.focusedNodeId === memoId) {
        return state;
      }
      const existingIndex = state.breadcrumb.indexOf(memoId);
      const nextBreadcrumb =
        existingIndex >= 0
          ? state.breadcrumb.slice(0, existingIndex + 1)
          : [...state.breadcrumb, memoId].slice(-6);

      return {
        focusedNodeId: memoId,
        breadcrumb: nextBreadcrumb,
      };
    });
  },

  navigateBreadcrumb: (memoId) => {
    set((state) => {
      const index = state.breadcrumb.indexOf(memoId);
      const nextBreadcrumb =
        index >= 0 ? state.breadcrumb.slice(0, index + 1) : [memoId];
      return {
        focusedNodeId: memoId,
        breadcrumb: nextBreadcrumb,
      };
    });
  },

  clearFocus: () => {
    set({ focusedNodeId: null, breadcrumb: [] });
  },
}));
