import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./common/guards/auth.guard";
import { AuthModule } from "./modules/auth/auth.module";

/**
 * Ideamory API 최상위 루트 모듈
 * 전역 AuthGuard를 등록하여 모든 라우트에 대해 기본 인증 보안을 적용하고,
 * 도메인 모듈(AuthModule 등)을 조립합니다.
 */
@Module({
  imports: [AuthModule],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
