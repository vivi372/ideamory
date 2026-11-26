import { create } from "zustand";
import type { AiSearchResponseDto } from "@ideamory/api-spec";

interface AiModeState {
  /** 썸존 [AI] 질의 모드 활성화 여부 */
  isAiMode: boolean;
  /** AI 브리핑 API 요청 진행 여부 */
  isSearching: boolean;
  /** 가장 최근 AI 브리핑 응답 (Single-Briefing Replace: 항상 1건만 유지) */
  briefingResult: AiSearchResponseDto | null;
  /** 현재 브리핑을 생성한 사용자 질문 원문 */
  activeQuery: string;
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

/**
 * 썸존 `[AI]` 질의 모드 및 단일 브리핑(Single-Briefing Replace) 상태를 관리하는 Zustand 스토어입니다.
 *
 * 대화 히스토리 누적 없이 항상 최신 질문 1건과 브리핑 결과만 유지하며,
 * 뒤로가기나 `[AI]` 토글 해제 시 0ms 지연으로 기존 타임라인 상태로 복귀합니다.
 */
export const useAiModeStore = create<AiModeState>((set) => ({
  isAiMode: false,
  isSearching: false,
  briefingResult: null,
  activeQuery: "",
  toggleAiMode: () =>
    set((state) =>
      state.isAiMode
        ? {
            isAiMode: false,
            isSearching: false,
            briefingResult: null,
            activeQuery: "",
          }
        : { isAiMode: true }
    ),
  setAiMode: (enabled) =>
    set(() =>
      enabled
        ? { isAiMode: true }
        : {
            isAiMode: false,
            isSearching: false,
            briefingResult: null,
            activeQuery: "",
          }
    ),
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
  resetAiSearch: () =>
    set({
      isAiMode: false,
      isSearching: false,
      briefingResult: null,
      activeQuery: "",
    }),
}));
