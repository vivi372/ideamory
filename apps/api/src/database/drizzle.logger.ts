import { Logger } from "@nestjs/common";
import type { DrizzleQueryLogger } from "@ideamory/db";
import { traceStore } from "../common/logging/trace-store";
import { safeStringifyForLog } from "../common/utils/log-sanitizer.util";

/**
 * Drizzle ORM에서 PostgreSQL로 실행되는 원시 SQL과 바인딩 파라미터를 추적하는 커스텀 로거입니다.
 *
 * `AsyncLocalStorage`(`traceStore`)에서 현재 요청의 32자리 Trace ID 앞 8자리를 읽어
 * 서비스/컨트롤러 로그와 동일한 트레이스 접두어로 연결하며,
 * `safeStringifyForLog`를 통해 768차원 벡터(`[vector(768)]`) 및 민감 파라미터(`[MASKED]`)를 안전하게 축약합니다.
 */
export class AppDrizzleLogger implements DrizzleQueryLogger {
  private readonly logger = new Logger("Drizzle");

  /**
   * Drizzle ORM 쿼리 실행 시 호출되는 표준 로깅 훅입니다.
   *
   * @param query 실행되는 SQL 원시 쿼리 문자열
   * @param params 바인딩 파라미터 배열
   */
  logQuery(query: string, params: unknown[]): void {
    try {
      const traceId = traceStore.getStore();
      const shortTraceId = traceId ? traceId.slice(0, 8) : "no-trace";
      const compactSql = query.replace(/\s+/g, " ").trim();
      const safeParams = safeStringifyForLog(params);

      this.logger.log(
        `[${shortTraceId}] [Drizzle:Query] SQL: ${compactSql} | PARAMS: ${safeParams}`
      );
    } catch {
      // 무간섭 원칙(Fail-Safe): 쿼리 로깅 오류가 DB 작업을 중단시키지 않도록 방어
    }
  }
}
