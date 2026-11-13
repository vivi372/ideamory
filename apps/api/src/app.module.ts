import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { AuthGuard } from "./common/guards/auth.guard";
import { AuthModule } from "./modules/auth/auth.module";
import { AiModule } from "./modules/ai/ai.module";
import { OgpModule } from "./modules/ogp/ogp.module";
import { MemoModule } from "./modules/memo/memo.module";
import { SchedulerModule } from "./modules/scheduler/scheduler.module";

/**
 * Ideamory API 최상위 루트 모듈
 * 전역 AuthGuard를 등록하여 모든 라우트에 대해 기본 인증 보안을 적용하고,
 * 도메인 모듈(AuthModule, MemoModule, OgpModule, AiModule, SchedulerModule) 및 크론 스케줄러를 조립합니다.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    AiModule,
    OgpModule,
    MemoModule,
    SchedulerModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
