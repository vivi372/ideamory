import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { randomBytes, randomUUID } from "crypto";
import {
  ERROR_CODES,
  GUEST_TOKEN_PREFIX,
  GUEST_TOKEN_RANDOM_BYTES,
  type GuestInitDto,
  type GuestInitResponseDto,
  type LinkSocialAuthDto,
  type LinkSocialAuthResponseDto,
  type SimpleSuccessResponseDto,
} from "@ideamory/api-spec";
import { BusinessException } from "../../common/exceptions/business.exception";
import {
  getSharedSupabaseJWKS,
  verifySupabaseJwt,
} from "../../common/utils/supabase-jwt.util";
import { AuthRepository } from "./auth.repository";

/**
 * 인증 세션 및 유저 데이터 라이프사이클 비즈니스 서비스
 * 익명 게스트 세션 발급/초기화, 소셜 계정 승격(데이터 이관), 회원탈퇴(Hard Delete)의
 * 트랜잭션 경계와 도메인 유즈케이스 오케스트레이션을 총괄합니다.
 * 벤더 SDK(@supabase/supabase-js)를 배제하고 jose 오프라인 검증과 Drizzle 트랜잭션만을 사용합니다.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly authRepository: AuthRepository) {}

  /**
   * 전역 공유 Supabase Auth 공개키 셋(JWKS) 인스턴스 획득
   */
  protected getJWKS() {
    return getSharedSupabaseJWKS();
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
      const payload = await verifySupabaseJwt(idToken, this.getJWKS());
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
    // 1. 공통 규격 상수 기반 암호학적 게스트 토큰 생성 ("gst_" + 48자 Hex = 52자, VARCHAR 64 이내)
    const guestToken = `${GUEST_TOKEN_PREFIX}${randomBytes(GUEST_TOKEN_RANDOM_BYTES).toString("hex")}`;

    // 2. 환경변수 기반 동적 가이드 URL 구성 (특정 배포 도메인 하드코딩 배제)
    const baseAppUrl = (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000"
    ).replace(/\/+$/, "");
    const guideUrl = `${baseAppUrl}/guide`;

    // 3. 온보딩 가이드 시드 메모 본문 및 100년 TTL 계산
    const guideContent = `Ideamory 사용 가이드 (${guideUrl}) 💡 이 메모를 직접 터치해 내용을 고쳐보거나, 상단 카테고리 배지를 눌러 분류를 바꿔보세요. 우측 상단 버리기 버튼을 눌러 이 가이드 메모를 직접 지우면 나만의 깨끗한 타임라인이 완성됩니다.`;
    const hundredYearsLater = new Date(
      Date.now() + 100 * 365 * 24 * 60 * 60 * 1000
    );

    // 4. 단일 트랜잭션 내에서 Pre-seeded OGP ➔ [사용 가이드] 카테고리 ➔ 가이드 메모 순차 생성
    await this.authRepository.withTransaction(async (tx) => {
      const existingOgp = await this.authRepository.findOgpCacheByTargetUrl(
        guideUrl,
        tx
      );
      const ogpId = existingOgp ? existingOgp.id : randomUUID();

      if (!existingOgp) {
        await this.authRepository.insertOgpCache(
          {
            id: ogpId,
            targetUrl: guideUrl,
            title: "Ideamory 사용 가이드",
            description:
              "0.1초 만에 생각을 기록하고 AI로 자동 정리하는 나만의 지식 서재 시작하기",
            expiresAt: hundredYearsLater,
          },
          tx
        );
      }

      await this.authRepository.insertCategory(
        {
          id: dto.categoryId,
          guestToken,
          name: "사용 가이드",
          normalizedName: "사용가이드",
        },
        tx
      );

      await this.authRepository.insertMemo(
        {
          id: dto.memoId,
          guestToken,
          categoryId: dto.categoryId,
          ogpId,
          content: guideContent,
        },
        tx
      );
    });

    this.logger.log(
      `익명 게스트 세션 발급 및 시드 메모 생성 완료 (seedMemoId: ${dto.memoId})`
    );

    return {
      guestToken,
      seedMemoId: dto.memoId,
    };
  }

  /**
   * 익명 게스트 세션이 보유한 모든 메모와 카테고리를 단일 트랜잭션으로 완전 영구 삭제합니다.
   * (ON DELETE RESTRICT 외래키 제약 준수를 위해 memos ➔ categories 순서로 삭제)
   *
   * @param guestToken 현재 요청의 게스트 세션 토큰
   * @returns 초기화 완료 여부 및 안내 메시지
   * @throws BusinessException 게스트 토큰이 누락된 경우 401 Unauthorized 발생
   */
  async resetGuestData(guestToken?: string): Promise<SimpleSuccessResponseDto> {
    if (!guestToken) {
      throw new BusinessException(
        "익명 게스트 세션 토큰이 필요합니다.",
        ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }

    await this.authRepository.withTransaction(async (tx) => {
      // FK ON DELETE RESTRICT 위반 방지를 위해 자식(memos) ➔ 부모(categories) 순차 Hard Delete
      await this.authRepository.deleteMemosByGuestToken(guestToken, tx);
      await this.authRepository.deleteCategoriesByGuestToken(guestToken, tx);
    });

    this.logger.log("게스트 세션 데이터 원자적 초기화(Hard Delete) 완료");

    return {
      success: true,
      message: "게스트 세션의 모든 데이터가 초기화되었습니다.",
    };
  }

  /**
   * 익명 게스트 세션을 정식 소셜 계정(userId)으로 승격하고,
   * 중복 카테고리(normalized_name) 병합을 포함해 게스트의 모든 데이터를 100% 이관합니다.
   *
   * @param guestToken 이관할 기존 게스트 세션 토큰
   * @param dto Supabase Auth에서 발급받은 소셜 idToken을 포함한 요청 DTO
   * @returns 이관 완료 여부 및 검증된 소셜 사용자 UUID
   * @throws BusinessException 게스트 토큰 누락 또는 idToken 검증 실패 시 401 Unauthorized 발생
   */
  async linkSocialAccount(
    guestToken: string | undefined,
    dto: LinkSocialAuthDto
  ): Promise<LinkSocialAuthResponseDto> {
    if (!guestToken) {
      throw new BusinessException(
        "이관할 익명 게스트 세션 토큰이 필요합니다.",
        ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }

    // 1. jose 로컬 ES256 검증을 통해 타인 도용/위변조 방지 및 targetUserId 추출
    const targetUserId = await this.verifySocialIdToken(dto.idToken);

    // 2. 단일 트랜잭션 내에서 중복 카테고리 병합 및 배타적 소유권 전환 오케스트레이션
    await this.authRepository.withTransaction(async (tx) => {
      const guestCategories =
        await this.authRepository.findCategoriesByGuestToken(guestToken, tx);
      const userCategories =
        await this.authRepository.findCategoriesByUserId(targetUserId, tx);

      const userCategoryByNormalized = new Map<string, string>(
        userCategories.map((cat) => [cat.normalizedName, cat.id])
      );

      // 동일 normalized_name 충돌 시 게스트 메모를 기존 소셜 카테고리로 재매핑하고 중복 게스트 카테고리 정리
      const duplicateGuestCategoryIds: string[] = [];
      for (const guestCat of guestCategories) {
        const existingUserCatId = userCategoryByNormalized.get(
          guestCat.normalizedName
        );
        if (existingUserCatId) {
          await this.authRepository.reassignMemosCategory(
            guestToken,
            guestCat.id,
            existingUserCatId,
            tx
          );
          duplicateGuestCategoryIds.push(guestCat.id);
        }
      }

      if (duplicateGuestCategoryIds.length > 0) {
        await this.authRepository.deleteCategoriesByIds(
          duplicateGuestCategoryIds,
          tx
        );
      }

      // 남은 게스트 카테고리 및 메모 소유권을 소셜 유저로 일괄 전환 (guestToken = null)
      await this.authRepository.transferCategoriesToUser(
        guestToken,
        targetUserId,
        tx
      );
      await this.authRepository.transferMemosToUser(
        guestToken,
        targetUserId,
        tx
      );
    });

    this.logger.log(
      `게스트 데이터 소셜 계정 이관 완료 (userId: ${targetUserId})`
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

    await this.authRepository.withTransaction(async (tx) => {
      // FK ON DELETE RESTRICT 위반 방지를 위해 memos ➔ categories ➔ authUsers 순차 삭제
      await this.authRepository.deleteMemosByUserId(userId, tx);
      await this.authRepository.deleteCategoriesByUserId(userId, tx);
      await this.authRepository.deleteAuthUserById(userId, tx);
    });

    this.logger.log(`소셜 회원탈퇴 및 데이터 완전 파기 완료 (userId: ${userId})`);

    return {
      success: true,
      message: "회원 탈퇴 및 모든 데이터 삭제가 완료되었습니다.",
    };
  }
}
