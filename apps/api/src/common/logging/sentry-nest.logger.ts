import { ConsoleLogger } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";
import { traceStore } from "./trace-store";
import { safeStringifyForLog } from "../utils/log-sanitizer.util";

export type SentryLogLevel = "info" | "warn" | "error" | "debug" | "trace";
export type SentryBreadcrumbLevel = "info" | "warning" | "error" | "debug" | "log";

export interface SentryLogSink {
  isInitialized(): boolean;
  log(
    level: SentryLogLevel,
    message: string,
    attributes: Record<string, string>
  ): void;
  addBreadcrumb(breadcrumb: {
    category: string;
    message: string;
    level: SentryBreadcrumbLevel;
    data?: Record<string, string>;
  }): void;
}

const defaultSentryLogSink: SentryLogSink = {
  isInitialized: () => Sentry.isInitialized(),
  log: (level, message, attributes) => {
    Sentry.logger[level](message, attributes);
  },
  addBreadcrumb: (breadcrumb) => {
    Sentry.addBreadcrumb(breadcrumb);
  },
};

/**
 * NestJS `ConsoleLogger`를 확장하여 터미널 표준 출력과 동일하게
 * Sentry Logs(`Sentry.logger.*`) 및 Breadcrumb으로 순수 로그를 실시간 미러링하는 전역 로거입니다.
 *
 * `NestFactory.create(AppModule, { logger: new SentryNestLogger() })`로 등록하면
 * `[HTTP]`, `[LogTrace]`, `[Drizzle]`, `[ExceptionFilter]`, 부트스트랩 로그 등
 * 애플리케이션 전역의 모든 NestJS `Logger` 출력이 터미널과 Sentry에 동시에 기록됩니다.
 */
export class SentryNestLogger extends ConsoleLogger {
  constructor(
    private readonly sentrySink: SentryLogSink = defaultSentryLogSink
  ) {
    super();
  }

  override log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(message, ...optionalParams);
    this.forwardToSentry("info", "info", message, optionalParams);
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...optionalParams);
    this.forwardToSentry("error", "error", message, optionalParams);
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(message, ...optionalParams);
    this.forwardToSentry("warn", "warning", message, optionalParams);
  }

  override debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(message, ...optionalParams);
    this.forwardToSentry("debug", "debug", message, optionalParams);
  }

  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose(message, ...optionalParams);
    this.forwardToSentry("trace", "log", message, optionalParams);
  }

  /**
   * 터미널 로그 포맷(`[Context] message`)을 그대로 Sentry Logs와 Breadcrumb으로 전송합니다.
   * 로깅 전송 실패가 비즈니스 로직을 방해하지 않도록 Fail-Safe로 동작합니다.
   */
  private forwardToSentry(
    sentryLevel: SentryLogLevel,
    breadcrumbLevel: SentryBreadcrumbLevel,
    message: unknown,
    optionalParams: unknown[]
  ): void {
    try {
      if (!this.sentrySink.isInitialized()) {
        return;
      }

      const lastParam =
        optionalParams.length > 0
          ? optionalParams[optionalParams.length - 1]
          : undefined;
      const resolvedContext =
        typeof lastParam === "string" ? lastParam : this.context;

      const text =
        typeof message === "string" ? message : safeStringifyForLog(message);
      const formattedLine = resolvedContext
        ? `[${resolvedContext}] ${text}`
        : text;

      const traceId = traceStore.getStore();
      const attributes: Record<string, string> = {};
      if (resolvedContext) {
        attributes.context = resolvedContext;
      }
      if (traceId) {
        attributes.trace_id = traceId;
      }

      this.sentrySink.log(sentryLevel, formattedLine, attributes);
      this.sentrySink.addBreadcrumb({
        category: resolvedContext ?? "nest",
        message: formattedLine,
        level: breadcrumbLevel,
        data: traceId ? { trace_id: traceId } : undefined,
      });
    } catch {
      // 무간섭 원칙(Fail-Safe): Sentry 로그 전송 오류가 애플리케이션 흐름을 방해하지 않도록 무시
    }
  }
}
