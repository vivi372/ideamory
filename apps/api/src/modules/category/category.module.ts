import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { CategoryController } from "./category.controller";
import { CategoryService } from "./category.service";
import { CategoryRepository } from "./category.repository";

/**
 * 카테고리 CRUD, AI 유사 카테고리 탐지 제안 큐 및 원클릭 병합 도메인 모듈
 */
@Module({
  imports: [AiModule],
  controllers: [CategoryController],
  providers: [CategoryService, CategoryRepository],
  exports: [CategoryService, CategoryRepository],
})
export class CategoryModule {}
