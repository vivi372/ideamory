import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthRepository } from "./auth.repository";

/**
 * 인증 세션 및 유저 데이터 라이프사이클 도메인 모듈
 * 게스트 온보딩, 게스트 초기화, 소셜 이관 및 회원탈퇴 기능을 제공합니다.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
  exports: [AuthService],
})
export class AuthModule {}

