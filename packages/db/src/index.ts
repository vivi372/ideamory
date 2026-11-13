import { db } from "./client";

/**
 * Ideamory 데이터베이스 패키지 메인 진입점
 * Drizzle ORM 클라이언트, 스키마, 연산자 및 TypeScript 타입 단일 진실 공급원(SSOT)
 */
export * from "./client";
export * from "./schema";

/** Drizzle 트랜잭션 컨텍스트 타입 */
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** 일반 DB 클라이언트 또는 Drizzle 트랜잭션 실행기 타입 */
export type DbExecutor = typeof db | DbTransaction;
export {
  eq,
  and,
  or,
  ne,
  lt,
  lte,
  gt,
  gte,
  isNull,
  isNotNull,
  inArray,
  sql,
  desc,
  asc,
} from "drizzle-orm";
