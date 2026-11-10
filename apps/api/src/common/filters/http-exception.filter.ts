import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import { Request, Response } from "express";
import type { ErrorResponseDto } from "@ideamory/api-spec";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const traceId = (request.headers["x-trace-id"] as string) || "unknown";

    // 표준 [도메인]_[UX태그]_[상세원인] 기본값
    let errorCode = "SYSTEM_ERROR_INTERNAL";
    let message = "서버 내부 오류가 발생했습니다.";

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const anyRes = res as any;
        errorCode = anyRes.errorCode || "SYSTEM_WARN_HTTP_ERROR";
        message = anyRes.message || exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const errorResponse: ErrorResponseDto = {
      statusCode: status,
      errorCode,
      message: Array.isArray(message) ? message.join(", ") : message,
      traceId,
      timestamp: new Date().toISOString()
    };

    this.logger.error(`[${traceId}] Error: ${errorCode} - ${message}`);

    response.status(status).json(errorResponse);
  }
}

