/**
 * @ideamory/api-spec
 * 프론트엔드(apps/web)와 백엔드(apps/api)가 공유하는 단일 진실 공급원(Single Source of Truth)
 * Zod DTO 스키마 및 z.infer 정적 타입 정의 전역 Barrel Export
 */

// 전역 에러 코드 상수 및 인증 규격 상수 (SSOT)
export * from "./constants/error-code.constant";
export * from "./constants/auth.constant";
export * from "./utils/error.util";

// 공통 도메인 스키마 및 타입
export * from "./schemas/common.schema";

// OGP 메타데이터 캐시 도메인 스키마 및 타입
export * from "./schemas/ogp.schema";

// 메모 도메인 스키마 및 타입
export * from "./schemas/memo.schema";

// 카테고리 도메인 스키마 및 타입
export * from "./schemas/category.schema";

// 인증 및 계정 세션 도메인 스키마 및 타입
export * from "./schemas/auth.schema";

// Zod 핵심 객체 및 타입 리익스포트
export { z, ZodSchema, ZodError, type ZodIssue } from "zod";
