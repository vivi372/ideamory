import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth";

/**
 * Ideamory MCP(Model Context Protocol) 외부 AI 에이전트 연동용 API 키 테이블 스키마입니다.
 *
 * - 원문 키(`idm_live_{32hex}`)는 발급 응답 시점에만 1회 반환하고 DB에는 SHA-256 해시(`key_hash`)만 저장합니다.
 * - 소유자(소셜 `user_id` 또는 `guest_token`)당 최대 1개의 활성 키만 유지하도록 부분 유니크 제약을 적용합니다.
 */
export const mcpApiKeys = pgTable(
  "mcp_api_keys",
  {
    id: uuid("id").primaryKey(), // 애플리케이션 선발급 UUID v7
    userId: uuid("user_id").references(() => authUsers.id, {
      onDelete: "cascade",
    }),
    guestToken: varchar("guest_token", { length: 64 }),
    keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
    keyPrefix: varchar("key_prefix", { length: 16 }).notNull(),
    scopes: varchar("scopes", { length: 32 })
      .array()
      .notNull()
      .default(sql`ARRAY['READ']::VARCHAR(32)[]`),
    fixedCategoryName: varchar("fixed_category_name", { length: 10 }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "chk_mcp_keys_owner",
      sql`(user_id IS NOT NULL AND guest_token IS NULL) OR (user_id IS NULL AND guest_token IS NOT NULL)`,
    ),
    uniqueIndex("uq_mcp_keys_user")
      .on(table.userId)
      .where(sql`user_id IS NOT NULL`),
    uniqueIndex("uq_mcp_keys_guest")
      .on(table.guestToken)
      .where(sql`guest_token IS NOT NULL`),
    index("idx_mcp_keys_hash").on(table.keyHash),
  ],
);

export type McpApiKey = typeof mcpApiKeys.$inferSelect;
export type NewMcpApiKey = typeof mcpApiKeys.$inferInsert;
