import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { randomUUID } from "node:crypto";

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

    const startTime = Date.now();
    const { method, originalUrl } = req;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        // 콘솔 로깅 시 앞 8자리 가독성 표기 (전체 ID는 헤더/로그 컨텍스트에 보존)
        this.logger.log(`[${traceId.slice(0, 8)}] ${method} ${originalUrl} - ${duration}ms`);
      })
    );
  }
}

