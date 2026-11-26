import { create } from "zustand";
import type { AiSearchResponseDto } from "@ideamory/api-spec";

interface AiModeData {
  /** 썸존 [AI] 질의 모드 활성화 여부 */
  isAiMode: boolean;
  /** AI 브리핑 API 요청 진행 여부 */
  isSearching: boolean;
  /** 가장 최근 AI 브리핑 응답 (Single-Briefing Replace: 항상 1건만 유지) */
  briefingResult: AiSearchResponseDto | null;
  /** 현재 브리핑을 생성한 사용자 질문 원문 */
  activeQuery: string;
}

interface AiModeState extends AiModeData {
  /** AI 모드 토글 (끄면 브리핑 상태도 즉시 초기화하여 타임라인으로 복귀) */
  toggleAiMode: () => void;
  /** AI 모드 명시적 설정 */
  setAiMode: (enabled: boolean) => void;
  /** AI 검색 로딩 상태 설정 */
  setSearching: (searching: boolean, query?: string) => void;
  /** 새로운 질의 및 브리핑 응답을 Single-Briefing Replace 원칙으로 덮어쓰기 */
  setBriefingResult: (query: string, result: AiSearchResponseDto) => void;
  /** 근거 메모 카드 인라인 수정 시 브리핑 출처 목록 본문 낙관적 갱신 */
  updateSourceContent: (memoId: string, content: string) => void;
  /** 브리핑 상태 초기화 및 AI 모드 종료 (0ms 타임라인 복귀) */
  resetAiSearch: () => void;
}

const INITIAL_AI_MODE_STATE: AiModeData = {
  isAiMode: false,
  isSearching: false,
  briefingResult: null,
  activeQuery: "",
};

/**
 * 썸존 `[AI]` 질의 모드 및 단일 브리핑(Single-Briefing Replace) 상태를 관리하는 전역 공유 스토어입니다.
 *
 * FSD 단방향 레이어링 원칙에 따라 `shared/model`에 위치하며,
 * `memo-capture`, `memo-search`, `widgets/ai-briefing`, `BackButtonProvider`가
 * 상호 참조 없이 단일 스토어를 구독할 수 있도록 합니다.
 */
export const useAiModeStore = create<AiModeState>((set) => ({
  ...INITIAL_AI_MODE_STATE,
  toggleAiMode: () =>
    set((state) =>
      state.isAiMode ? INITIAL_AI_MODE_STATE : { isAiMode: true }
    ),
  setAiMode: (enabled) =>
    set(() => (enabled ? { isAiMode: true } : INITIAL_AI_MODE_STATE)),
  setSearching: (searching, query) =>
    set((state) => ({
      isSearching: searching,
      ...(query !== undefined ? { activeQuery: query } : {}),
      ...(searching ? { isAiMode: true } : { isAiMode: state.isAiMode }),
    })),
  setBriefingResult: (query, result) =>
    set({
      isAiMode: true,
      isSearching: false,
      activeQuery: query,
      briefingResult: result,
    }),
  updateSourceContent: (memoId, content) =>
    set((state) => {
      if (!state.briefingResult) {
        return state;
      }
      return {
        briefingResult: {
          ...state.briefingResult,
          sources: state.briefingResult.sources.map((source) =>
            source.id === memoId ? { ...source, content } : source
          ),
        },
      };
    }),
  resetAiSearch: () => set(INITIAL_AI_MODE_STATE),
}));
