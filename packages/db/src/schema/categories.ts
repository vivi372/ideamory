import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth";

/**
 * 카테고리 테이블 스키마 정의
 * 소셜 로그인 회원 및 게스트 사용자의 메모 분류 메타데이터 관리
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey(), // 애플리케이션 선발급 UUID v7
    userId: uuid("user_id").references(() => authUsers.id, {
      onDelete: "cascade",
    }),
    guestToken: varchar("guest_token", { length: 64 }),
    name: varchar("name", { length: 10 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 10 }).notNull(),
    // Gemini gemini-embedding-2 모델 기준 768차원 카테고리명 임베딩 벡터 (유사 카테고리 탐지용)
    embedding: vector("embedding", { dimensions: 768 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // 소셜/게스트 배타적 소유권 제약조건 (둘 중 정확히 하나만 존재해야 함)
    check(
      "chk_categories_owner",
      sql`(user_id IS NOT NULL AND guest_token IS NULL) OR (user_id IS NULL AND guest_token IS NOT NULL)`
    ),
    // 카테고리명 1~10자 길이 제약조건
    check(
      "chk_categories_name_length",
      sql`char_length(name) >= 1 AND char_length(name) <= 10`
    ),
    // 소셜 사용자별 정규화 카테고리명 부분 유니크 인덱스
    uniqueIndex("idx_categories_user_normalized")
      .on(table.userId, table.normalizedName)
      .where(sql`user_id IS NOT NULL`),
    // 게스트 사용자별 정규화 카테고리명 부분 유니크 인덱스
    uniqueIndex("idx_categories_guest_normalized")
      .on(table.guestToken, table.normalizedName)
      .where(sql`guest_token IS NOT NULL`),
  ]
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

/**
 * 유사 카테고리 병합 제안 큐 테이블 스키마 정의
 * pgvector 코사인 유사도 0.85 이상으로 탐지된 유사 카테고리 쌍을 비동기 큐잉하며,
 * source/target 카테고리 삭제 시 ON DELETE CASCADE로 자동 영구 소멸됩니다.
 */
export const categoryMergeSuggestions = pgTable(
  "category_merge_suggestions",
  {
    id: uuid("id").primaryKey(), // 애플리케이션 선발급 UUID v7
    userId: uuid("user_id").references(() => authUsers.id, {
      onDelete: "cascade",
    }),
    guestToken: varchar("guest_token", { length: 64 }),
    sourceCategoryId: uuid("source_category_id")
      .references(() => categories.id, { onDelete: "cascade" })
      .notNull(),
    targetCategoryId: uuid("target_category_id")
      .references(() => categories.id, { onDelete: "cascade" })
      .notNull(),
    similarity: doublePrecision("similarity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // 소셜/게스트 배타적 소유권 제약조건 (둘 중 정확히 하나만 존재해야 함)
    check(
      "chk_category_merge_suggestions_owner",
      sql`(user_id IS NOT NULL AND guest_token IS NULL) OR (user_id IS NULL AND guest_token IS NOT NULL)`
    ),
    // 동일 (source, target) 쌍 중복 제안 방지 유니크 인덱스
    uniqueIndex("uq_category_merge_suggestions_pair").on(
      table.sourceCategoryId,
      table.targetCategoryId
    ),
  ]
);

export type CategoryMergeSuggestion =
  typeof categoryMergeSuggestions.$inferSelect;
export type NewCategoryMergeSuggestion =
  typeof categoryMergeSuggestions.$inferInsert;

