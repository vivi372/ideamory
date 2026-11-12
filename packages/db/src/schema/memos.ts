import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth";
import { categories } from "./categories";
import { ogpCaches } from "./ogp-caches";

/**
 * 메모 테이블 스키마 정의
 * 사용자의 핵심 지식 자산(텍스트, 768차원 임베딩, OGP 링크, 카테고리 관계) 관리
 */
export const memos = pgTable(
  "memos",
  {
    id: uuid("id").primaryKey(), // 애플리케이션 선발급 UUID v7
    userId: uuid("user_id").references(() => authUsers.id, {
      onDelete: "cascade",
    }),
    guestToken: varchar("guest_token", { length: 64 }),
    categoryId: uuid("category_id")
      .references(() => categories.id, { onDelete: "restrict" })
      .notNull(),
    ogpId: uuid("ogp_id").references(() => ogpCaches.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    // Gemini text-embedding-004 모델 기준 768차원 임베딩 벡터
    embedding: vector("embedding", { dimensions: 768 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // 30일 보관 Soft Delete 일시 (NULL이면 활성 상태)
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // 소셜/게스트 배타적 소유권 제약조건 (둘 중 정확히 하나만 존재해야 함)
    check(
      "chk_memos_owner",
      sql`(user_id IS NOT NULL AND guest_token IS NULL) OR (user_id IS NULL AND guest_token IS NOT NULL)`
    ),
    // 소셜 사용자별 활성 메모 역순 타임라인 조회 부분 인덱스
    index("idx_memos_user_timeline")
      .on(table.userId, table.createdAt.desc())
      .where(sql`user_id IS NOT NULL AND deleted_at IS NULL`),
    // 게스트 사용자별 활성 메모 역순 타임라인 조회 부분 인덱스
    index("idx_memos_guest_timeline")
      .on(table.guestToken, table.createdAt.desc())
      .where(sql`guest_token IS NOT NULL AND deleted_at IS NULL`),
    // 카테고리별 활성 메모 역순 타임라인 조회 부분 인덱스
    index("idx_memos_category_timeline")
      .on(table.categoryId, table.createdAt.desc())
      .where(sql`deleted_at IS NULL`),
    // 한국어/영어 통합 검색을 위한 PostgreSQL simple 사전 Full-Text Search GIN 인덱스
    index("idx_memos_content_fts").using(
      "gin",
      sql`to_tsvector('simple', ${table.content})`
    ),
    // pgvector 코사인 유사도 검색 가속을 위한 HNSW 인덱스 (m = 16, ef_construction = 64)
    index("idx_memos_embedding_hnsw")
      .using("hnsw", table.embedding.op("vector_cosine_ops"))
      .with({ m: 16, ef_construction: 64 }),
  ]
);

export type Memo = typeof memos.$inferSelect;
export type NewMemo = typeof memos.$inferInsert;

