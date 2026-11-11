import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { TraceIdInterceptor } from "./common/interceptors/trace-id.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule);

  // 1. CORS 및 X-Trace-Id 노출 설정
  const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
  app.enableCors({
    origin: corsOrigin.split(",").map((o) => o.trim()),
    credentials: true,
    exposedHeaders: ["X-Trace-Id"]
  });

  // 2. 전역 인터셉터 & 필터 바인딩
  app.useGlobalInterceptors(new TraceIdInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // 3. Swagger UI 설정 (/api/docs)
  const config = new DocumentBuilder()
    .setTitle("Ideamory REST API")
    .setDescription("Ideamory 백엔드 Always-On REST API 명세서")
    .setVersion("1.0")
    .addTag("memo", "메모 0.1초 퀵 캡처 및 타임라인")
    .addTag("category", "카테고리 관리 및 AI 분류")
    .addTag("auth", "게스트 세션 및 인증")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Ideamory Backend is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();

