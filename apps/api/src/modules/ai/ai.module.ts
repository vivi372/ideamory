import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";

/**
 * Gemini AI 기반 카테고리 분류 및 768차원 임베딩 생성 모듈
 */
@Module({
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

