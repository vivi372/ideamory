import { Module } from "@nestjs/common";
import { OgpRepository } from "./ogp.repository";
import { OgpService } from "./ogp.service";
import { OgpController } from "./ogp.controller";
import { OgpScheduler } from "./ogp.scheduler";

/**
 * OGP 크롤링, 14일 TTL 공유 캐시 및 만료 정리 크론 모듈
 */
@Module({
  controllers: [OgpController],
  providers: [OgpRepository, OgpService, OgpScheduler],
  exports: [OgpService, OgpRepository],
})
export class OgpModule {}

