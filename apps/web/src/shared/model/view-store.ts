import { create } from "zustand";

/**
 * 메인 타임라인의 3가지 뷰 모드입니다.
 * - `ALL`: 전체 메모 (최신 캐시)
 * - `CATEGORY`: 특정 카테고리 필터링 뷰
 * - `TRASH`: 30일 휴지통 보관함
 */
export type ViewMode = "ALL" | "CATEGORY" | "TRASH";

export interface ViewStoreState {
  /** 현재 활성화된 타임라인 뷰 모드 */
  viewMode: ViewMode;
  /** `CATEGORY` 모드일 때 선택된 카테고리 UUID v7 (미선택 시 null) */
  selectedCategoryId: string | null;
  /** 관련 메모 1-Depth 라이브 필터링 대상 원본 메모 UUID v7 (해제 시 null) */
  relatedFilterMemoId: string | null;
  /** 뷰 모드를 전환합니다. (`ALL`/`TRASH` 전환 시 카테고리 선택을 초기화) */
  setViewMode: (mode: ViewMode) => void;
  /** 특정 카테고리를 선택하여 `CATEGORY` 뷰로 전환합니다. */
  setSelectedCategory: (categoryId: string | null) => void;
  /** 관련 메모 1-Depth 필터링 대상 메모를 설정하거나 해제합니다. */
  setRelatedFilterMemo: (memoId: string | null) => void;
  /** 모든 뷰 및 필터 상태를 초기값(`ALL`)으로 리셋합니다. */
  resetView: () => void;
}

/**
 * 타임라인의 뷰 모드(`ALL` / `CATEGORY` / `TRASH`)와 1-Depth 필터 상태를 관리하는 Zustand 전역 스토어입니다.
 */
export const useViewStore = create<ViewStoreState>((set) => ({
  viewMode: "ALL",
  selectedCategoryId: null,
  relatedFilterMemoId: null,

  setViewMode: (mode) =>
    set({
      viewMode: mode,
      selectedCategoryId: mode === "CATEGORY" ? undefined : null,
      relatedFilterMemoId: null,
    }),

  setSelectedCategory: (categoryId) =>
    set({
      viewMode: categoryId ? "CATEGORY" : "ALL",
      selectedCategoryId: categoryId,
      relatedFilterMemoId: null,
    }),

  setRelatedFilterMemo: (memoId) =>
    set({
      relatedFilterMemoId: memoId,
    }),

  resetView: () =>
    set({
      viewMode: "ALL",
      selectedCategoryId: null,
      relatedFilterMemoId: null,
    }),
}));
