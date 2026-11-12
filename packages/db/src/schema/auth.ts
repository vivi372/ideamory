import { pgSchema, uuid } from "drizzle-orm/pg-core";

/**
 * Supabase Auth 스키마 정의 (외래키 참조용)
 * auth.users 테이블의 id 식별자를 참조하기 위한 최소 스키마 모델
 */
export const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

