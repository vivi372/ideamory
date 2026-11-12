import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * OGP 캐시 테이블 스키마 정의
 * 메모 내 URL 링크의 오픈 그래프 메타데이터 캐싱 및 자동 만료 관리
 */
export const ogpCaches = pgTable(
  "ogp_caches",
  {
    id: uuid("id").primaryKey(), // 애플리케이션 선발급 UUID v7
    targetUrl: text("target_url").notNull(),
    title: text("title"),
    thumbnailUrl: text("thumbnail_url"),
    description: text("description"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    // 대상 URL 기준 OGP 캐시 조회를 위한 유니크 인덱스
    uniqueIndex("idx_ogp_caches_target_url").on(table.targetUrl),
    // 만료된 OGP 캐시 배치를 위한 만료 일시 인덱스
    index("idx_ogp_caches_expires_at").on(table.expiresAt),
  ]
);

export type OgpCache = typeof ogpCaches.$inferSelect;
export type NewOgpCache = typeof ogpCaches.$inferInsert;

