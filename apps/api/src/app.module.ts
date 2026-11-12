import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthGuard } from "./common/guards/auth.guard";

/**
 * Ideamory API 최상위 루트 모듈
 * 전역 AuthGuard를 등록하여 모든 라우트에 대해 기본 인증 보안을 적용합니다.
 * 공개 라우트는 @Public() 데코레이터를 사용하여 예외 처리합니다.
 */
@Module({
  imports: [],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
