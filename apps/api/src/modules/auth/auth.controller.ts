import {
  Controller,
  Post,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiBody,
} from "@nestjs/swagger";
import {
  GuestInitSchema,
  LinkSocialAuthSchema,
  type GuestInitDto,
  type GuestInitResponseDto,
  type LinkSocialAuthDto,
  type LinkSocialAuthResponseDto,
  type SimpleSuccessResponseDto,
} from "@ideamory/api-spec";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";

/**
 * 인증 세션 및 유저 데이터 라이프사이클 컨트롤러
 * 익명 게스트 세션 발급/초기화, 소셜 계정 연동 승격, 소셜 회원탈퇴 엔드포인트를 제공합니다.
 */
@ApiTags("auth")
@Controller("api/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 0.1초 익명 게스트 세션 토큰을 발급하고 Pre-seeded OGP가 연동된 [사용 가이드] 시드 메모를 생성합니다.
   *
   * @param dto 클라이언트에서 선발급한 UUID v7 (memoId, categoryId)
   * @returns 발급된 게스트 토큰 및 생성된 시드 메모 ID
   */
  @Public()
  @Post("guest/init")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "0.1초 익명 게스트 세션 발급 & 온보딩 시드 메모 자동 생성",
    description:
      "가입 팝업 없이 즉시 익명 게스트 토큰을 발급하고, 100년 TTL OGP가 연동된 가이드 메모 1건을 생성합니다.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["memoId", "categoryId"],
      properties: {
        memoId: { type: "string", format: "uuid", description: "선발급된 메모 UUID v7" },
        categoryId: { type: "string", format: "uuid", description: "선발급된 카테고리 UUID v7" },
      },
    },
  })
  @ApiResponse({ status: 201, description: "게스트 세션 및 시드 메모 발급 성공" })
  @ApiResponse({ status: 400, description: "UUID v7 규격 위반 (COMMON_FIELD_FORMAT)" })
  async initGuestSession(
    @Body(new ZodValidationPipe(GuestInitSchema)) dto: GuestInitDto
  ): Promise<GuestInitResponseDto> {
    return this.authService.initGuestSession(dto);
  }

  /**
   * 익명 게스트 세션이 보유한 모든 메모 및 카테고리를 단일 트랜잭션으로 완전 영구 삭제합니다.
   *
   * @param guestToken 현재 요청 헤더(X-Guest-Token)에서 추출한 게스트 식별자
   * @returns 초기화 완료 여부 및 안내 메시지
   */
  @Post("guest/reset")
  @HttpCode(HttpStatus.OK)
  @ApiSecurity("X-Guest-Token")
  @ApiOperation({
    summary: "게스트 데이터 원자적 초기화 (Hard Delete)",
    description:
      "게스트가 작성한 모든 메모 및 카테고리를 DB 단일 트랜잭션으로 영구 파기합니다.",
  })
  @ApiResponse({ status: 200, description: "게스트 데이터 초기화 성공" })
  @ApiResponse({ status: 401, description: "게스트 토큰 누락 또는 무효 (AUTH_ALERT_UNAUTHORIZED)" })
  async resetGuestData(
    @CurrentUser("guestToken") guestToken?: string
  ): Promise<SimpleSuccessResponseDto> {
    return this.authService.resetGuestData(guestToken);
  }

  /**
   * 소셜 로그인(카카오/구글/네이버) 완료 시 기존 게스트 데이터를 정식 소셜 계정으로 100% 이관합니다.
   *
   * @param guestToken 이관 대상 익명 게스트 세션 식별자
   * @param dto 소셜 제공자(provider) 및 검증할 Supabase Access Token(idToken)
   * @returns 이관 완료 여부 및 승격된 정회원 UUID
   */
  @Post("social/link")
  @HttpCode(HttpStatus.OK)
  @ApiSecurity("X-Guest-Token")
  @ApiOperation({
    summary: "게스트 데이터 ➔ 소셜 계정 100% 무손실 이관",
    description:
      "소셜 로그인 연동 시 중복 카테고리를 병합하고 모든 게스트 메모/카테고리 소유권을 정식 계정으로 승격합니다.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["provider", "idToken"],
      properties: {
        provider: { type: "string", enum: ["kakao", "google", "naver"] },
        idToken: { type: "string", description: "Supabase Auth ES256 JWT" },
      },
    },
  })
  @ApiResponse({ status: 200, description: "소셜 계정 데이터 이관 성공" })
  @ApiResponse({ status: 401, description: "게스트 토큰 누락 또는 소셜 JWT 검증 실패" })
  async linkSocialAccount(
    @CurrentUser("guestToken") guestToken: string | undefined,
    @Body(new ZodValidationPipe(LinkSocialAuthSchema)) dto: LinkSocialAuthDto
  ): Promise<LinkSocialAuthResponseDto> {
    return this.authService.linkSocialAccount(guestToken, dto);
  }

  /**
   * 정식 소셜 회원의 탈퇴를 처리하며 모든 메모, 카테고리, 계정 데이터를 단일 트랜잭션으로 영구 삭제합니다.
   *
   * @param userId JWT 인증 가드에서 검증 및 추출된 정회원 UUID (payload.sub)
   * @returns 회원 탈퇴 완료 여부 및 안내 메시지
   */
  @Delete("account")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("Authorization")
  @ApiOperation({
    summary: "소셜 회원탈퇴 & 전체 데이터 영구 파기 (Hard Delete)",
    description:
      "소셜 회원이 보유한 모든 메모, 카테고리 및 계정 정보를 단일 트랜잭션으로 완전 삭제합니다.",
  })
  @ApiResponse({ status: 200, description: "회원 탈퇴 및 데이터 파기 완료" })
  @ApiResponse({ status: 401, description: "정회원 JWT 인증 누락 (AUTH_ALERT_UNAUTHORIZED)" })
  async deleteAccount(
    @CurrentUser("userId") userId?: string
  ): Promise<SimpleSuccessResponseDto> {
    return this.authService.deleteAccount(userId);
  }
}

