import { Module } from "@nestjs/common";
import { MemoModule } from "../memo/memo.module";
import { TrashCleanerScheduler } from "./trash-cleaner.scheduler";

/**
 * 전역 백그라운드 배치 스케줄러(휴지통 영구 청소 및 고아 카테고리 GC) 모듈
 */
@Module({
  imports: [MemoModule],
  providers: [TrashCleanerScheduler],
})
export class SchedulerModule {}

