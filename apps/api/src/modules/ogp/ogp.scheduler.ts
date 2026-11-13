import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { OgpService } from "./ogp.service";

/**
 * 만료된 OGP 메타데이터 캐시를 주기적으로 정리하는 스케줄러
 */
@Injectable()
export class OgpScheduler {
  private readonly logger = new Logger(OgpScheduler.name);

  constructor(private readonly ogpService: OgpService) {}

  /**
   * 매일 새벽 3시에 실행되어 14일 TTL이 만료된 OGP 캐시를 일괄 삭제합니다.
   * (100년 TTL이 설정된 온보딩 가이드 OGP 캐시는 만료되지 않으므로 자동 보존됩니다.)
   */
  @Cron("0 3 * * *")
  async handleExpiredOgpCleanup(): Promise<void> {
    try {
      const deletedCount = await this.ogpService.cleanupExpiredCaches();
      this.logger.log(
        `만료 OGP 캐시 일괄 정리 완료 (삭제 건수: ${deletedCount})`
      );
    } catch (error: any) {
      this.logger.error(
        `만료 OGP 캐시 정리 중 오류 발생: ${error?.message || error}`
      );
    }
  }
}

