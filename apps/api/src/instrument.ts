import * as Sentry from "@sentry/nestjs";

/**
 * Ideamory 백엔드 Sentry SDK 조기 부트스트랩 모듈입니다.
 *
 * `main.ts` 최상단에서 다른 모듈(NestFactory, Express, Drizzle 등)이 로드되기 전에 import되어
 * 자동 계측과 예외 추적을 활성화합니다. `SENTRY_DSN` 환경변수가 설정되지 않은 로컬 개발 환경에서는
 * 예외 없이 조용히 비활성화 상태를 유지합니다.
 */
const sentryDsn = process.env.SENTRY_DSN?.trim();

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
    ],
  });
}
