import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Drizzle ORM 원시 SQL 쿼리 로거 인터페이스
 */
export interface DrizzleQueryLogger {
  logQuery(query: string, params: unknown[]): void;
}

let activeDatabaseLogger: DrizzleQueryLogger | null = null;

/**
 * 애플리케이션 부트스트랩 시 Drizzle ORM 원시 쿼리 로거를 주입합니다.
 * `@ideamory/db`가 NestJS 프레임워크에 직접 의존하지 않도록 인터페이스로 분리합니다.
 *
 * @param logger 등록할 커스텀 쿼리 로거 (해제 시 null)
 */
export function setDatabaseLogger(logger: DrizzleQueryLogger | null): void {
  activeDatabaseLogger = logger;
}

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
 * 스키마 정의 및 런타임 쿼리 로거 위임 핸들러를 바인딩합니다.
 */
export const db = drizzle(sqlClient, {
  schema,
  logger: {
    logQuery(query: string, params: unknown[]) {
      activeDatabaseLogger?.logQuery(query, params);
    },
  },
});

export type DatabaseInstance = typeof db;
