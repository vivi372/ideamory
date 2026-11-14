import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { CategoryModule } from "../category/category.module";
import { OgpModule } from "../ogp/ogp.module";
import { MemoRepository } from "./memo.repository";
import { MemoService } from "./memo.service";
import { MemoController } from "./memo.controller";

/**
 * 메모 코어 파이프라인(퀵 캡처, 타임라인, 인라인 수정, 소프트 삭제/복구) 모듈
 */
@Module({
  imports: [AiModule, CategoryModule, OgpModule],
  controllers: [MemoController],
  providers: [MemoRepository, MemoService],
  exports: [MemoService, MemoRepository],
})
export class MemoModule {}

