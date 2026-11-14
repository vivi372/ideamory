import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { randomBytes } from "crypto";
import {
  type ErrorResponseDto,
  ERROR_CODES,
  mapHttpStatusToErrorCode,
} from "@ideamory/api-spec";
import { BusinessException } from "../exceptions/business.exception";
import { getTraceId } from "../logging/trace-store";

/**
 * 32자리 Hex Trace ID 검증 정규식 (W3C/Sentry 표준)
 */
const TRACE_ID_REGEX = /^[0-9a-fA-F]{32}$/;

/**
 * 애플리케이션 전역 예외 포착 및 표준 ErrorResponseDto 규격 변환 필터
 * 비즈니스 예외(BusinessException), HTTP 표준 예외, 시스템 장애를 통합 처리하며
 * W3C 32자리 분산 Trace ID 및 [도메인]_[UX태그]_[원인] 규격 에러 코드를 반환합니다.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. W3C 32자리 Hex Trace ID 획득 (AsyncLocalStorage 우선, 헤더, 신규 발급 순)
    let traceId = getTraceId();
    if (!traceId || !TRACE_ID_REGEX.test(traceId)) {
      const headerTraceId = request.headers["x-trace-id"];
      if (
        typeof headerTraceId === "string" &&
        TRACE_ID_REGEX.test(headerTraceId) &&
        headerTraceId !== "00000000000000000000000000000000"
      ) {
        traceId = headerTraceId.toLowerCase();
      } else {
        traceId = randomBytes(16).toString("hex");
      }
    }

    // 2. 상태 코드 및 에러 코드, 메시지 분류
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode: string = ERROR_CODES.SYSTEM_FATAL_INTERNAL;
    let message = "서버 내부 오류가 발생했습니다.";

    if (exception instanceof BusinessException) {
      status = exception.getStatus();
      errorCode = exception.errorCode;
      message = exception.message;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
        errorCode = mapHttpStatusToErrorCode(status);
      } else if (typeof res === "object" && res !== null) {
        const resObj = res as Record<string, any>;
        errorCode = resObj.errorCode || mapHttpStatusToErrorCode(status);

        if (Array.isArray(resObj.message)) {
          // 유효성 검사 에러 배열 처리 (첫 번째 에러 메시지 우선)
          message = resObj.message.join(", ");
        } else if (typeof resObj.message === "string") {
          message = resObj.message;
        } else {
          message = exception.message;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `[${traceId.slice(0, 8)}] Unhandled Error: ${exception.message}`,
        exception.stack
      );
    }

    // 3. 표준 ErrorResponseDto 응답 객체 생성
    const errorResponse: ErrorResponseDto = {
      statusCode: status,
      errorCode,
      message,
      traceId,
      timestamp: new Date().toISOString(),
    };

    // 4. 가독성을 위해 터미널 콘솔에는 앞 8자리 축약 표출
    this.logger.error(
      `[${traceId.slice(0, 8)}] [${request.method} ${request.url}] Status: ${status}, ErrorCode: ${errorCode} - ${message}`
    );

    // Guard 등 Interceptor 이전 단계에서 발생한 예외 응답에서도 클라이언트가 X-Trace-Id 헤더를 읽을 수 있도록 보장
    response.setHeader("X-Trace-Id", traceId);
    response.status(status).json(errorResponse);
  }
}
