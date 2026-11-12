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
import { randomUUID } from "node:crypto";

/**
 * W3C 및 Sentry 분산 추적 표준 호환 32자리 16진수 Trace ID 인터셉터
 * 요청별 고유 식별자를 추적하고, CORS 노출 및 콘솔 가독성 로깅(앞 8자리)을 지원합니다.
 */
@Injectable()
export class TraceIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    // W3C / Sentry 32자리 16진수 Trace ID 검증 및 상속/발급 (All-Zero 무효화 포함)
    const rawTraceId = req.headers["x-trace-id"];
    let traceId =
      typeof rawTraceId === "string" &&
      /^[0-9a-fA-F]{32}$/.test(rawTraceId) &&
      !/^0{32}$/.test(rawTraceId)
        ? rawTraceId.toLowerCase()
        : randomUUID().replace(/-/g, "");

    req.headers["x-trace-id"] = traceId;
    res.setHeader("X-Trace-Id", traceId);

    // CORS 환경에서 프론트엔드가 X-Trace-Id 헤더를 읽을 수 있도록 Expose-Headers 등록
    const existingExpose = res.getHeader("Access-Control-Expose-Headers");
    if (existingExpose) {
      if (!String(existingExpose).includes("X-Trace-Id")) {
        res.setHeader(
          "Access-Control-Expose-Headers",
          `${existingExpose}, X-Trace-Id`
        );
      }
    } else {
      res.setHeader("Access-Control-Expose-Headers", "X-Trace-Id");
    }

    const startTime = Date.now();
    const { method, originalUrl } = req;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        // 콘솔 로깅 시 터미널 가독성을 위해 앞 8자리 축약 표기 (전체 32자리는 헤더/응답에 보존)
        this.logger.log(
          `[${traceId.slice(0, 8)}] ${method} ${originalUrl} - ${duration}ms`
        );
      })
    );
  }
}
