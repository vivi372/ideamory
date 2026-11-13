import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { randomBytes } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  ERROR_CODES,
  type GuestInitDto,
  type GuestInitResponseDto,
  type LinkSocialAuthDto,
  type LinkSocialAuthResponseDto,
  type SimpleSuccessResponseDto,
} from "@ideamory/api-spec";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AuthRepository } from "./auth.repository";

/**
 * 인증 세션 및 유저 데이터 라이프사이클 비즈니스 서비스
 * 익명 게스트 세션 발급/초기화, 소셜 계정 승격(데이터 이관), 회원탈퇴(Hard Delete)를 총괄합니다.
 * 벤더 SDK(@supabase/supabase-js)를 배제하고 jose 오프라인 검증과 Drizzle 트랜잭션만을 사용합니다.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly authRepository: AuthRepository) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl) {
      const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
      this.jwks = createRemoteJWKSet(jwksUrl);
    }
  }

  /**
   * Supabase Auth 공개키 셋(JWKS) 인스턴스 획득 (지연 초기화 및 캐싱)
   */
  protected getJWKS(): ReturnType<typeof createRemoteJWKSet> {
    if (!this.jwks) {
      const supabaseUrl = process.env.SUPABASE_URL;
      if (!supabaseUrl) {
        this.logger.error("SUPABASE_URL 환경변수가 설정되지 않았습니다.");
        throw new BusinessException(
          "인증 서버 설정이 유효하지 않습니다.",
          ERROR_CODES.AUTH_FATAL_CONFIG_ERROR,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
      this.jwks = createRemoteJWKSet(jwksUrl);
    }
    return this.jwks;
  }

  /**
   * 소셜 연동용 Supabase JWT(idToken)의 ECC Curve P-256 (ES256) 비대칭키 서명을 로컬 검증하고
   * 정식 사용자 식별자(UUID)를 추출합니다.
   *
   * @param idToken 클라이언트가 전달한 Supabase Auth Access Token (JWT)
   * @returns 검증 완료된 사용자의 고유 UUID (payload.sub)
   * @throws BusinessException 토큰 서명 불일치, 만료 또는 클레임 누락 시 401 Unauthorized 발생
   */
  protected async verifySocialIdToken(idToken: string): Promise<string> {
    try {
      const JWKS = this.getJWKS();
      const supabaseUrl = process.env.SUPABASE_URL;

      const verifyOptions: Record<string, any> = {
        algorithms: ["ES256"],
        audience: "authenticated",
      };
      if (supabaseUrl) {
        verifyOptions.issuer = `${supabaseUrl}/auth/v1`;
      }

      const { payload } = await jwtVerify(idToken, JWKS, verifyOptions);

      if (!payload.sub) {
        throw new BusinessException(
          "유효하지 않은 소셜 인증 토큰 페이로드입니다.",
          ERROR_CODES.AUTH_ALERT_INVALID_PAYLOAD,
          HttpStatus.UNAUTHORIZED
        );
      }

      return payload.sub;
    } catch (error: any) {
      if (error instanceof BusinessException) {
        throw error;
      }
      this.logger.warn(`소셜 연동 JWT 검증 실패: ${error?.message || error}`);
      throw new BusinessException(
        "유효하지 않거나 만료된 소셜 인증 토큰입니다.",
        ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  /**
   * 가입 팝업 없이 0.1초 만에 익명 게스트 세션 토큰을 발급하고,
   * Pre-seeded OGP(100년 TTL)와 연동된 온보딩 가이드 시드 메모를 원자적으로 생성합니다.
   *
   * @param dto 클라이언트/컨트롤러에서 선발급된 memoId 및 categoryId (UUID v7)
   * @returns 발급된 게스트 토큰(52자) 및 생성된 시드 메모 ID
   */
  async initGuestSession(dto: GuestInitDto): Promise<GuestInitResponseDto> {
    // 1. 암호학적으로 안전한 52자 게스트 토큰 생성 ("gst_" + 48자 Hex = 52자, VARCHAR 64 규격 준수)
    const guestToken = `gst_${randomBytes(24).toString("hex")}`;

    // 2. 환경변수 기반 동적 가이드 URL 구성 (특정 배포 도메인 하드코딩 배제)
    const baseAppUrl = (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"
    ).replace(/\/+$/, "");
    const guideUrl = `${baseAppUrl}/guide`;

    // 3. 온보딩 가이드 시드 메모 본문 구성
    const guideContent = `Ideamory 사용 가이드 (${guideUrl}) 💡 이 메모를 직접 터치해 내용을 고쳐보거나, 상단 카테고리 배지를 눌러 분류를 바꿔보세요. 우측 상단 버리기 버튼을 눌러 이 가이드 메모를 직접 지우면 나만의 깨끗한 타임라인이 완성됩니다.`;

    // 4. 단일 트랜잭션으로 Pre-seeded OGP, [사용 가이드] 카테고리, 가이드 메모 생성
    const seedMemoId = await this.authRepository.createGuestSessionWithSeed({
      guestToken,
      memoId: dto.memoId,
      categoryId: dto.categoryId,
      guideUrl,
      guideContent,
    });

    this.logger.log(
      `익명 게스트 세션 발급 및 시드 메모 생성 완료 (seedMemoId: ${seedMemoId})`
    );

    return {
      guestToken,
      seedMemoId,
    };
  }

  /**
   * 익명 게스트 세션이 보유한 모든 메모와 카테고리를 단일 트랜잭션으로 완전 영구 삭제합니다.
   *
   * @param guestToken 초기화를 요청한 게스트 세션 식별자
   * @returns 초기화 성공 여부 및 안내 메시지
   * @throws BusinessException 게스트 토큰이 누락된 경우 401 Unauthorized 발생
   */
  async resetGuestData(guestToken?: string): Promise<SimpleSuccessResponseDto> {
    if (!guestToken) {
      throw new BusinessException(
        "유효한 게스트 세션 토큰이 필요합니다.",
        ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }

    await this.authRepository.resetGuestData(guestToken);
    this.logger.log("게스트 데이터 원자적 초기화(Hard Delete) 완료");

    return {
      success: true,
      message: "게스트 데이터가 초기화되었습니다.",
    };
  }

  /**
   * 소셜 로그인(카카오/구글/네이버) 연동 시 기존 게스트 데이터를 정식 소셜 계정으로
   * 중복 카테고리 병합을 포함하여 단일 트랜잭션으로 100% 이관합니다.
   *
   * @param guestToken 기존 익명 데이터를 식별하는 게스트 세션 토큰
   * @param dto 소셜 제공자 및 검증할 Supabase idToken(JWT)
   * @returns 이관 성공 여부 및 승격된 정회원 UUID
   * @throws BusinessException 게스트 토큰 누락 또는 소셜 JWT 검증 실패 시 401 Unauthorized 발생
   */
  async linkSocialAccount(
    guestToken: string | undefined,
    dto: LinkSocialAuthDto
  ): Promise<LinkSocialAuthResponseDto> {
    if (!guestToken) {
      throw new BusinessException(
        "이관할 게스트 세션 토큰이 누락되었습니다.",
        ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }

    // 1. jose를 활용한 소셜 JWT 비대칭키(ES256) 서명 및 클레임 오프라인 검증
    const targetUserId = await this.verifySocialIdToken(dto.idToken);

    // 2. 단일 트랜잭션으로 카테고리 병합 및 메모/카테고리 소유권 승격
    await this.authRepository.migrateGuestToSocialAccount({
      guestToken,
      targetUserId,
    });

    this.logger.log(
      `게스트 데이터 소셜 계정 이관 완료 (provider: ${dto.provider}, userId: ${targetUserId})`
    );

    return {
      success: true,
      userId: targetUserId,
    };
  }

  /**
   * 정식 소셜 계정의 회원탈퇴 요청을 처리하며, 회원의 모든 메모/카테고리/계정 데이터를
   * 단일 트랜잭션으로 완전 영구 파기(Hard Delete)합니다.
   *
   * @param userId 인증 가드를 통과한 정회원 UUID (payload.sub)
   * @returns 탈퇴 완료 여부 및 안내 메시지
   * @throws BusinessException 정회원 인증(userId)이 누락된 경우 401 Unauthorized 발생
   */
  async deleteAccount(userId?: string): Promise<SimpleSuccessResponseDto> {
    if (!userId) {
      throw new BusinessException(
        "소셜 로그인 정회원 인증이 필요합니다.",
        ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }

    await this.authRepository.deleteSocialAccountData(userId);
    this.logger.log(`소셜 회원탈퇴 및 데이터 완전 파기 완료 (userId: ${userId})`);

    return {
      success: true,
      message: "회원 탈퇴 및 모든 데이터 삭제가 완료되었습니다.",
    };
  }
}

