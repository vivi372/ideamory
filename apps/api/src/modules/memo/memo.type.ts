import type { OgpCache } from "@ideamory/db";

/**
 * 카테고리 및 OGP 캐시 정보가 조인된 메모 도메인 조회 모델
 */
export interface MemoWithRelations {
  id: string;
  content: string;
  categoryId: string;
  categoryName: string;
  ogpId: string | null;
  ogp: OgpCache | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raw SQL에서 LEFT JOIN으로 함께 조회되는 유효 OGP 캐시 컬럼 묶음
 */
export interface JoinedOgpRawFields {
  ogpId: string | null;
  ogpTargetUrl: string | null;
  ogpTitle: string | null;
  ogpThumbnailUrl: string | null;
  ogpDescription: string | null;
  ogpExpiresAt: Date | string | null;
  ogpFetchedAt: Date | string | null;
}

/**
 * Drizzle Raw SQL 하이브리드 검색(FTS 0.4 + Vector 0.6) 결과 행 타입
 */
export interface HybridSearchRawRow extends JoinedOgpRawFields {
  id: string;
  content: string;
  categoryId: string;
  categoryName: string;
  ftsScore: number;
  vectorScore: number;
  finalScore: number;
  createdAt: Date | string;
}

/**
 * Drizzle Raw SQL 1-Depth 연관 메모 추천 결과 행 타입
 */
export interface RelatedMemoRawRow extends JoinedOgpRawFields {
  id: string;
  content: string;
  categoryId: string;
  categoryName: string;
  similarity: number;
  createdAt: Date | string;
}

