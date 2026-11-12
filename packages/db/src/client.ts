import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * PostgreSQL 커넥션 인프로세스 풀링 인스턴스 생성
 * Always-On 단일 인스턴스 최적화: max: 10, idle_timeout: 20s
 */
const connectionString = process.env.DATABASE_URL || "";

export const sqlClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
});

/**
 * Ideamory Drizzle ORM 데이터베이스 클라이언트 단일 인스턴스
 * 스키마 정의를 바인딩하여 타입 안전한 쿼리 빌딩 지원
 */
export const db = drizzle(sqlClient, { schema });

export type DatabaseInstance = typeof db;

