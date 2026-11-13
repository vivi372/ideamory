import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { TraceIdInterceptor } from "./common/interceptors/trace-id.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

/**
 * Ideamory NestJS REST API 서버 부트스트랩
 */
async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  // 1. Vercel 프론트엔드 도메인 및 로컬 개발 환경 CORS 설정
  const configuredOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const defaultOrigins = ["http://localhost:3000", "http://localhost:3001"];
  const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultOrigins]));

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Postman, cURL, 모바일 앱 등 origin 헤더가 없는 서버 간 호출이거나 허용 목록에 포함된 경우
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS 요청 차단됨: ${origin}`);
        callback(new Error(`CORS 차단: 허용되지 않은 오리진(${origin})입니다.`));
      }
    },
    credentials: true,
    exposedHeaders: ["X-Trace-Id"],
  });

  // 2. 전역 인터셉터 & 필터 바인딩
  app.useGlobalInterceptors(new TraceIdInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // 3. Swagger OpenAPI 3.0 설정 (/api/docs)
  const config = new DocumentBuilder()
    .setTitle("Ideamory API Specification")
    .setDescription("0.1초 퀵 캡처 & Gemini 하이브리드 지식 서재 백엔드 REST API")
    .setVersion("1.0.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "Authorization",
        description: "Supabase Auth (ECC Curve P-256 / ES256) JWT Access Token",
        in: "header",
      },
      "Authorization"
    )
    .addApiKey(
      {
        type: "apiKey",
        name: "X-Guest-Token",
        description: "익명 게스트 세션 식별 토큰 (최대 64자)",
        in: "header",
      },
      "X-Guest-Token"
    )
    .addApiKey(
      {
        type: "apiKey",
        name: "X-Trace-Id",
        description: "W3C / Sentry 호환 32자리 Hex 분산 추적 식별자",
        in: "header",
      },
      "X-Trace-Id"
    )
    .addTag("auth", "게스트 세션 발급 및 소셜 계정 데이터 이관")
    .addTag("memo", "메모 0.1초 퀵 캡처, 타임라인 및 하이브리드 검색")
    .addTag("category", "카테고리 CRUD 및 AI 유사 카테고리 병합")
    .addTag("ogp", "URL Open Graph 메타데이터 파싱 및 캐싱")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Ideamory Backend is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
