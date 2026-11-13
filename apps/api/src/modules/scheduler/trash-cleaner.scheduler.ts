import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { MemoService } from "../memo/memo.service";

/**
 * 30일 경과 휴지통 메모 및 참조 카운트 0건 고아 카테고리를 매일 자정 일괄 영구 삭제하는 스케줄러
 */
@Injectable()
export class TrashCleanerScheduler {
  private readonly logger = new Logger(TrashCleanerScheduler.name);

  constructor(private readonly memoService: MemoService) {}

  /**
   * 매일 자정(00:00)에 실행되어 30일 보관 기한이 지난 휴지통 메모를 영구 삭제하고,
   * 더 이상 어떤 메모도 참조하지 않는 고아 카테고리를 가비지 컬렉션(GC)합니다.
   */
  @Cron("0 0 * * *")
  async handleDailyTrashCleanup(): Promise<void> {
    try {
      const { deletedMemoCount, deletedCategoryCount } =
        await this.memoService.cleanupExpiredTrashAndOrphans();

      this.logger.log(
        `휴지통 및 고아 카테고리 일괄 정리 완료 (영구 삭제 메모: ${deletedMemoCount}건, 정리된 고아 카테고리: ${deletedCategoryCount}건)`
      );
    } catch (error: any) {
      this.logger.error(
        `휴지통 및 고아 카테고리 일괄 정리 중 오류 발생: ${error?.message || error}`
      );
    }
  }
}

