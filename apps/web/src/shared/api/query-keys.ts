/**
 * TanStack Query v5 캐시 무효화 및 키 일관성 유지를 위한 중앙 Query Key 팩토리입니다.
 *
 * 문자열 키 하드코딩으로 인한 캐시 무효화 누락을 방지하기 위해
 * 도메인(`memos`, `categories`)별 계층형 튜플 키를 단일 진실 공급원으로 관리합니다.
 */
export const queryKeys = {
  memos: {
    all: ["memos"] as const,
    timeline: (categoryId?: string) =>
      ["memos", "timeline", { categoryId: categoryId ?? null }] as const,
    search: (query: string) => ["memos", "search", { query }] as const,
    related: (id: string) => ["memos", "related", id] as const,
    trash: () => ["memos", "trash"] as const,
  },
  categories: {
    all: ["categories"] as const,
    list: () => ["categories", "list"] as const,
    mergeSuggestions: () => ["categories", "merge-suggestions"] as const,
  },
} as const;
