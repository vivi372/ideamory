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

@Injectable()
export class TraceIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    // 6자리 Hex Trace ID 발급 또는 헤더 상속
    const traceId =
      (req.headers["x-trace-id"] as string) ||
      Math.random().toString(16).substring(2, 8);

    req.headers["x-trace-id"] = traceId;
    res.setHeader("X-Trace-Id", traceId);

    const startTime = Date.now();
    const { method, originalUrl } = req;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(`[${traceId}] ${method} ${originalUrl} - ${duration}ms`);
      })
    );
  }
}

