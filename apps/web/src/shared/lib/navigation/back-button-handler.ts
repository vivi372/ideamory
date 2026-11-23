import type { ViewMode } from "../../model/view-store";

export const EXIT_CONFIRM_WINDOW_MS = 2000;
export const EXIT_CONFIRM_TOAST_MESSAGE =
  "뒤로가기 버튼을 한 번 더 누르면 종료됩니다.";

/**
 * 현재 화면에 열려 있는 UI 오버레이 및 필터 스택 스냅샷입니다.
 */
export interface BackStackSnapshot {
  drawerOpen: boolean;
  categoryPickerOpen: boolean;
  socialSheetOpen: boolean;
  legalModalOpen: boolean;
  feedbackModalOpen: boolean;
  searchActive: boolean;
  relatedFilterActive: boolean;
  graphNodeFocused?: boolean;
  viewMode: ViewMode;
}

export type BackButtonAction =
  | "CLOSE_FEEDBACK_MODAL"
  | "CLOSE_LEGAL_MODAL"
  | "CLOSE_SOCIAL_SHEET"
  | "CLOSE_CATEGORY_PICKER"
  | "CLOSE_DRAWER"
  | "CLEAR_SEARCH"
  | "CLEAR_RELATED_FILTER"
  | "CLEAR_GRAPH_FOCUS"
  | "RESET_VIEW_TO_ALL"
  | "SHOW_EXIT_PROMPT"
  | "EXIT_APP";

/**
 * 안드로이드 물리 뒤로가기 키/제스처 입력 시 계층적 오버레이 스택의 최상위 레이어부터
 * 역순으로 1개씩 닫기 위한 다음 동작을 순수하게 결정합니다.
 *
 * [닫힘 우선순위]
 * 1순위: 사이드바 드로어 / 최상위 다이얼로그 (전역 피드백/약관/소셜/카테고리/드로어)
 *   - 단, 드로어 위에 소셜·약관·피드백 모달이 떠 있는 경우가 있으므로 최상위 모달부터 닫고 드로어를 닫습니다.
 * 2순위: 검색 결과 뷰 / 관련 메모 1-Depth 라이브 필터 / 카테고리·휴지통 뷰 → 메인 타임라인(`ALL`) 복귀
 * 3순위: 메인 홈 타임라인에서 2초 이내 2회 연속 입력 시 앱 종료, 최초 입력 시 종료 안내 토스트 표출
 *
 * @param snapshot 현재 활성 UI 레이어 스냅샷
 * @param nowMs 현재 타임스탬프(ms)
 * @param lastBackPressedAt 직전 홈 화면 뒤로가기 입력 시각(ms)
 * @returns 수행해야 할 뒤로가기 액션
 */
export function resolveNextBackAction(
  snapshot: BackStackSnapshot,
  nowMs: number,
  lastBackPressedAt: number | null
): BackButtonAction {
  // 최상위 z-index 다이얼로그/모달부터 순차 Pop
  if (snapshot.feedbackModalOpen) {
    return "CLOSE_FEEDBACK_MODAL";
  }
  if (snapshot.legalModalOpen) {
    return "CLOSE_LEGAL_MODAL";
  }
  if (snapshot.socialSheetOpen) {
    return "CLOSE_SOCIAL_SHEET";
  }
  if (snapshot.categoryPickerOpen) {
    return "CLOSE_CATEGORY_PICKER";
  }
  if (snapshot.drawerOpen) {
    return "CLOSE_DRAWER";
  }

  // 오버레이가 모두 닫혀 있으면 활성 검색/연관 필터/서브 뷰를 해제하고 메인 최신순 타임라인으로 복귀
  if (snapshot.searchActive) {
    return "CLEAR_SEARCH";
  }
  if (snapshot.relatedFilterActive) {
    return "CLEAR_RELATED_FILTER";
  }
  if (snapshot.graphNodeFocused) {
    return "CLEAR_GRAPH_FOCUS";
  }
  if (snapshot.viewMode !== "ALL") {
    return "RESET_VIEW_TO_ALL";
  }

  // 홈 타임라인 최하단 레이어에서는 2초 내 2회 연속 뒤로가기 시 앱 종료
  if (
    lastBackPressedAt !== null &&
    nowMs - lastBackPressedAt <= EXIT_CONFIRM_WINDOW_MS
  ) {
    return "EXIT_APP";
  }

  return "SHOW_EXIT_PROMPT";
}
