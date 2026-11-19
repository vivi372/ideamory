import { create } from "zustand";

/**
 * 메인 타임라인의 3가지 뷰 모드입니다.
 * - `ALL`: 전체 메모 (최신 캐시)
 * - `CATEGORY`: 특정 카테고리 필터링 뷰
 * - `TRASH`: 30일 휴지통 보관함
 */
export type ViewMode = "ALL" | "CATEGORY" | "TRASH";

export interface CategoryPickerTarget {
  /** 카테고리를 변경할 대상 메모 UUID v7 */
  memoId: string;
  /** 현재 메모가 속한 카테고리 UUID v7 */
  currentCategoryId: string;
}

export interface ViewStoreState {
  /** 현재 활성화된 타임라인 뷰 모드 */
  viewMode: ViewMode;
  /** `CATEGORY` 모드일 때 선택된 카테고리 UUID v7 (미선택 시 null) */
  selectedCategoryId: string | null;
  /** 관련 메모 1-Depth 라이브 필터링 대상 원본 메모 UUID v7 (해제 시 null) */
  relatedFilterMemoId: string | null;
  /** 명시적 하이브리드 검색 질의어 (Enter 또는 [검색] 실행 시에만 설정, 빈 문자열이면 비활성) */
  searchQuery: string;
  /** 0ms 카테고리 수동 변경 피커 바텀시트 대상 메모 정보 (닫힘 시 null) */
  categoryPickerTarget: CategoryPickerTarget | null;
  /** 뷰 모드를 전환합니다. (`ALL`/`TRASH` 전환 시 카테고리·검색·연관 필터 초기화) */
  setViewMode: (mode: ViewMode) => void;
  /** 특정 카테고리를 선택하여 `CATEGORY` 뷰로 전환합니다. */
  setSelectedCategory: (categoryId: string | null) => void;
  /** 관련 메모 1-Depth 필터링 대상 메모를 설정하거나 해제합니다. */
  setRelatedFilterMemo: (memoId: string | null) => void;
  /** 명시적 하이브리드 검색 질의어를 설정합니다. */
  setSearchQuery: (query: string) => void;
  /** 하이브리드 검색 모드를 즉시 해제합니다. */
  clearSearch: () => void;
  /** 카테고리 수동 변경 피커 바텀시트를 엽니다. */
  openCategoryPicker: (target: CategoryPickerTarget) => void;
  /** 카테고리 수동 변경 피커 바텀시트를 닫습니다. */
  closeCategoryPicker: () => void;
  /** 모든 뷰 및 필터 상태를 초기값(`ALL`)으로 리셋합니다. */
  resetView: () => void;
}

/**
 * 타임라인의 뷰 모드(`ALL` / `CATEGORY` / `TRASH`), 하이브리드 검색,
 * 1-Depth 연관 메모 필터 및 카테고리 피커 상태를 관리하는 Zustand 전역 스토어입니다.
 */
export const useViewStore = create<ViewStoreState>((set) => ({
  viewMode: "ALL",
  selectedCategoryId: null,
  relatedFilterMemoId: null,
  searchQuery: "",
  categoryPickerTarget: null,

  setViewMode: (mode) =>
    set({
      viewMode: mode,
      selectedCategoryId: mode === "CATEGORY" ? undefined : null,
      relatedFilterMemoId: null,
      searchQuery: "",
    }),

  setSelectedCategory: (categoryId) =>
    set({
      viewMode: categoryId ? "CATEGORY" : "ALL",
      selectedCategoryId: categoryId,
      relatedFilterMemoId: null,
      searchQuery: "",
    }),

  setRelatedFilterMemo: (memoId) =>
    set({
      relatedFilterMemoId: memoId,
      searchQuery: "",
    }),

  setSearchQuery: (query) =>
    set({
      searchQuery: query.trim(),
      relatedFilterMemoId: null,
    }),

  clearSearch: () =>
    set({
      searchQuery: "",
    }),

  openCategoryPicker: (target) =>
    set({
      categoryPickerTarget: target,
    }),

  closeCategoryPicker: () =>
    set({
      categoryPickerTarget: null,
    }),

  resetView: () =>
    set({
      viewMode: "ALL",
      selectedCategoryId: null,
      relatedFilterMemoId: null,
      searchQuery: "",
      categoryPickerTarget: null,
    }),
}));
