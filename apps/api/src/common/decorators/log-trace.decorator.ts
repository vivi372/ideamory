import { Logger } from "@nestjs/common";
import { performance } from "node:perf_hooks";
import { traceStore } from "../logging/trace-store";
import { safeStringifyForLog } from "../utils/log-sanitizer.util";

/**
 * `@LogTrace()` AOP 데코레이터 동작 옵션
 */
export interface LogTraceOptions {
  /** 메서드 진입 시 전달 인자(`args`) 로깅 여부 (기본값: true) */
  logArgs?: boolean;
  /** 메서드 정상 종료 시 반환값(`result`) 로깅 여부 (기본값: true) */
  logResult?: boolean;
}

const aopLogger = new Logger("LogTrace");

/**
 * 로깅 시스템 자체의 장애로 인해 비즈니스 로직이 중단되지 않도록 격리된 안전 로깅 래퍼입니다.
 *
 * @param level 로그 레벨 (`log` | `error`)
 * @param message 출력할 메시지
 */
function safeEmitLog(level: "log" | "error", message: string): void {
  try {
    if (level === "error") {
      aopLogger.error(message);
    } else {
      aopLogger.log(message);
    }
  } catch {
    // 무간섭 원칙(Fail-Safe): 로깅 실패가 트랜잭션을 방해하지 않도록 무시
  }
}

/**
 * Service 및 Repository 메서드 상단에 부착하여 진입(`[ENTRY]`), 정상 이탈(`[EXIT]`),
 * 예외 이탈(`[ERROR]`) 흐름과 소요 시간(ms)을 선언적으로 자동 추적하는 AOP 데코레이터입니다.
 *
 * `AsyncLocalStorage`(`traceStore`)에서 32자리 Trace ID를 읽어 앞 8자리를 접두어로 표출하며,
 * `safeStringifyForLog`를 통해 민감 정보 마스킹 및 768차원 벡터 축약을 자동 적용합니다.
 *
 * @param options 인자/반환값 로깅 제어 옵션
 * @returns TypeScript 메서드 데코레이터
 */
export function LogTrace(options: LogTraceOptions = {}): MethodDecorator {
  const { logArgs = true, logResult = true } = options;

  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
    const className = target.constructor?.name || "UnknownClass";
    const methodName = String(propertyKey);

    descriptor.value = function (...args: unknown[]) {
      const traceId = traceStore.getStore();
      const shortTraceId = traceId ? traceId.slice(0, 8) : "no-trace";
      const prefix = `[${shortTraceId}] [${className}.${methodName}]`;
      const argsText = logArgs ? safeStringifyForLog(args) : "[omitted]";

      safeEmitLog("log", `${prefix} [ENTRY] args: ${argsText}`);
      const startedAt = performance.now();

      try {
        const result = originalMethod.apply(this, args);

        // 비동기 Promise 반환 메서드 처리
        if (
          result !== null &&
          (typeof result === "object" || typeof result === "function") &&
          typeof (result as Promise<unknown>).then === "function"
        ) {
          return (result as Promise<unknown>).then(
            (resolved) => {
              const elapsed = (performance.now() - startedAt).toFixed(2);
              const resultText = logResult
                ? safeStringifyForLog(resolved)
                : "[omitted]";
              safeEmitLog(
                "log",
                `${prefix} [EXIT] elapsed: ${elapsed}ms result: ${resultText}`
              );
              return resolved;
            },
            (err: unknown) => {
              const elapsed = (performance.now() - startedAt).toFixed(2);
              const errName = err instanceof Error ? err.name : "UnknownError";
              const errMsg = err instanceof Error ? err.message : String(err);
              safeEmitLog(
                "error",
                `${prefix} [ERROR] elapsed: ${elapsed}ms error: "${errName}: ${errMsg}" args: ${argsText}`
              );
              throw err;
            }
          );
        }

        // 동기 메서드 처리
        const elapsed = (performance.now() - startedAt).toFixed(2);
        const resultText = logResult ? safeStringifyForLog(result) : "[omitted]";
        safeEmitLog(
          "log",
          `${prefix} [EXIT] elapsed: ${elapsed}ms result: ${resultText}`
        );
        return result;
      } catch (err: unknown) {
        const elapsed = (performance.now() - startedAt).toFixed(2);
        const errName = err instanceof Error ? err.name : "UnknownError";
        const errMsg = err instanceof Error ? err.message : String(err);
        safeEmitLog(
          "error",
          `${prefix} [ERROR] elapsed: ${elapsed}ms error: "${errName}: ${errMsg}" args: ${argsText}`
        );
        throw err;
      }
    };

    return descriptor;
  };
}
