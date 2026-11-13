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
