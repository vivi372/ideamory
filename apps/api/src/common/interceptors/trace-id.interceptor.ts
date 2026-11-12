import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { traceStore } from "../logging/trace-store";

/**
 * W3C 및 Sentry 분산 추적 표준 호환 32자리 16진수 Trace ID 인터셉터
 * 모든 HTTP 요청에 32자리 Hex 식별자를 부여하고, AsyncLocalStorage 컨텍스트에 바인딩하며,
 * CORS 헤더 노출, 정밀 실행 시간 측정 및 민감 정보 마스킹 로깅을 전담합니다.
 */
@Injectable()
export class TraceIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  /**
   * 민감 정보 마스킹 대상 키 목록 (소문자 기준)
   */
  private readonly sensitiveKeys = new Set([
    "password",
    "token",
    "secret",
    "accesstoken",
    "guesttoken",
    "refreshtoken",
    "authorization",
  ]);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    // 1. W3C / Sentry 32자리 16진수 Trace ID 검증 및 상속/발급 (All-Zero 무효화 포함)
    const rawTraceId = req.headers["x-trace-id"];
    let traceId: string;

    if (
      typeof rawTraceId === "string" &&
      /^[0-9a-fA-F]{32}$/.test(rawTraceId) &&
      !/^0{32}$/.test(rawTraceId)
    ) {
      traceId = rawTraceId.toLowerCase();
    } else {
      // 헤더 부재, 정규식 불일치, 또는 All-Zero 유입 시 암호학적 32자리 Hex 신규 생성
      traceId = randomBytes(16).toString("hex");
    }

    req.headers["x-trace-id"] = traceId;
    res.setHeader("X-Trace-Id", traceId);

    // 2. CORS 환경에서 프론트엔드가 X-Trace-Id 헤더를 읽을 수 있도록 Expose-Headers 등록
    // 소문자 유입, 배열 형태 및 부분 일치 오탐을 방지하기 위해 콤마 단위 토큰 정규화 검사 수행
    const existingExpose = res.getHeader("Access-Control-Expose-Headers");
    if (existingExpose) {
      const exposeTokens = (
        Array.isArray(existingExpose)
          ? existingExpose.join(",")
          : String(existingExpose)
      )
        .split(",")
        .map((header) => header.trim())
        .filter((header) => header.length > 0);

      const hasTraceId = exposeTokens.some(
        (header) => header.toLowerCase() === "x-trace-id"
      );

      if (!hasTraceId) {
        res.setHeader(
          "Access-Control-Expose-Headers",
          [...exposeTokens, "X-Trace-Id"].join(", ")
        );
      }
    } else {
      res.setHeader("Access-Control-Expose-Headers", "X-Trace-Id");
    }

    const startTime = performance.now();
    const { method, originalUrl } = req;
    const shortTraceId = traceId.slice(0, 8);

    // 3. AsyncLocalStorage 스코프 내에서 핸들러 체인 실행 및 실행 시간 정밀 측정
    return traceStore.run(traceId, () => {
      return next.handle().pipe(
        tap({
          next: () => {
            const duration = (performance.now() - startTime).toFixed(2);
            // 콘솔 로깅 시 터미널 가독성을 위해 앞 8자리 축약 표기 (전체 32자리는 헤더/컨텍스트에 보존)
            this.logger.log(
              `[${shortTraceId}] ${method} ${originalUrl} - ${duration}ms`
            );
          },
          error: (err) => {
            const duration = (performance.now() - startTime).toFixed(2);
            this.logger.warn(
              `[${shortTraceId}] ${method} ${originalUrl} - ${duration}ms (오류 발생: ${err?.message || err})`
            );
          },
        })
      );
    });
  }

  /**
   * 객체 내 민감 정보 필드를 [MASKED]로 안전하게 치환합니다.
   * WeakSet 기반 순환 참조 감지, Date/RegExp 특수 객체 원형 보존 및 최대 10-Depth 제어로 스택 오버플로를 방어합니다.
   * @param data 마스킹 처리할 데이터 객체
   * @param visited 순환 참조 탐지용 WeakSet
   * @param depth 현재 재귀 깊이
   */
  public maskSensitiveData(
    data: any,
    visited = new WeakSet<object>(),
    depth = 0
  ): any {
    // 1. 원시 타입 또는 null/undefined 즉시 반환
    if (!data || typeof data !== "object") {
      return data;
    }

    // 2. 최대 재귀 깊이(10-Depth) 초과 시 안전 중단 (CPU DoS 방어)
    if (depth > 10) {
      return "[MAX_DEPTH_EXCEEDED]";
    }

    // 3. Date, RegExp 등 특수 객체는 분해하지 않고 원형 보존
    if (data instanceof Date || data instanceof RegExp) {
      return data;
    }

    // 4. 순환 참조(Circular Reference) 감지 시 무한 루프 차단
    if (visited.has(data)) {
      return "[CIRCULAR]";
    }
    visited.add(data);

    // 5. 배열 재귀 탐색
    if (Array.isArray(data)) {
      return data.map((item) => this.maskSensitiveData(item, visited, depth + 1));
    }

    // 6. 객체 키-값 재귀 탐색
    const masked: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (this.sensitiveKeys.has(lowerKey)) {
        masked[key] = "[MASKED]";
      } else if (typeof value === "object" && value !== null) {
        masked[key] = this.maskSensitiveData(value, visited, depth + 1);
      } else {
        masked[key] = value;
      }
    }
    return masked;
  }
}
