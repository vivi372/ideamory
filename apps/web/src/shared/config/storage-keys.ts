/**
 * 클라이언트 `localStorage`에 영속화하는 애플리케이션 전역 스토리지 키 상수입니다.
 */
export const STORAGE_KEYS = {
  /** 듀얼 뷰 모드 상태 (`'CACHE' | 'GRAPH'`) */
  VIEW_MODE: "ideamory_view_mode",
  /** 지식망 모드 연결도 코사인 유사도 임계치 (`0.70 ~ 0.85`, 기본 `0.80`) */
  GRAPH_THRESHOLD: "ideamory_graph_threshold",
} as const;
