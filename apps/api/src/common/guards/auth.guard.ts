import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  HttpStatus,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { ERROR_CODES, GUEST_TOKEN_MAX_LENGTH } from "@ideamory/api-spec";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { BusinessException } from "../exceptions/business.exception";
import {
  getSharedSupabaseJWKS,
  verifySupabaseJwt,
} from "../utils/supabase-jwt.util";

/**
 * 인증된 사용자 또는 게스트 정보를 포함하는 Express Request 인터페이스 확장
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    [key: string]: any;
  };
  guestToken?: string;
}

/**
 * jose 기반 최신 Supabase Auth (ECC Curve P-256 / ES256) JWT 로컬 검증 가드
 *
 * [보안 및 정합성 가드레일]
 * 1. 0ms 오프라인 검증: 캐싱된 JWKS 및 ES256 알고리즘 비대칭키 서명 검증
 * 2. 클레임 검증: issuer(`${SUPABASE_URL}/auth/v1`) 및 audience("authenticated") 필수 검증 (타 프로젝트 및 비인증 토큰 차단)
 * 3. 단일 신원 및 상호 배타성 보장:
 *    - Authorization 헤더(소셜 유저)를 최우선 신원으로 취급
 *    - 소셜 인증 성공 시 request.guestToken을 명시적으로 undefined로 비워 DB 배타적 소유권(chk_memos_exclusive_owner) 충돌 원천 방지
 *    - 만료/위변조된 소셜 토큰 유입 시 게스트로 임의 폴백(강등)하지 않고 401 에러로 즉시 차단
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly reflector: Reflector) {}

  /**
   * 전역 공유 Supabase Auth 공개키 셋(JWKS) 인스턴스 획득
   */
  private getJWKS() {
    return getSharedSupabaseJWKS();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. @Public() 데코레이터 확인 (공개 엔드포인트 여부)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    const guestHeader = request.headers["x-guest-token"];

    // 2. [우선순위 1] Authorization Bearer JWT 검증 (소셜 인증 최우선)
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token) {
        try {
          const payload = await verifySupabaseJwt(token, this.getJWKS());

          // 검증 성공 시 사용자 식별자 바인딩
          request.user = {
            id: payload.sub,
            email: typeof payload.email === "string" ? payload.email : undefined,
            ...payload,
          };
          // 상호 배타성: 소셜 유저로 인증된 경우 게스트 토큰을 명시적으로 제거하여 DB 소유권 충돌 방지
          request.guestToken = undefined;

          return true;
        } catch (error: any) {
          if (error instanceof BusinessException) {
            throw error;
          }
          this.logger.warn(`JWT 서명/클레임 검증 실패: ${error?.message || error}`);
          // 만료/위변조된 소셜 토큰은 게스트로 폴백하지 않고 즉시 401 차단
          if (!isPublic) {
            throw new BusinessException(
              "유효하지 않거나 만료된 인증 토큰입니다.",
              ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
              HttpStatus.UNAUTHORIZED
            );
          }
          // @Public()인 경우 미인증 상태로 통과
          request.user = undefined;
          request.guestToken = undefined;
          return true;
        }
      }
    }

    // 3. [우선순위 2] X-Guest-Token 게스트 세션 검증 (Authorization 부재 시에만 동작)
    if (typeof guestHeader === "string" && guestHeader.trim().length > 0) {
      const cleanGuestToken = guestHeader.trim();
      // 게스트 토큰 규격(최대 64자) 검증
      if (cleanGuestToken.length <= GUEST_TOKEN_MAX_LENGTH) {
        request.guestToken = cleanGuestToken;
        request.user = undefined; // 상호 배타성
        return true;
      } else if (!isPublic) {
        throw new BusinessException(
          "유효하지 않은 게스트 토큰 형식입니다.",
          ERROR_CODES.AUTH_ALERT_INVALID_GUEST_TOKEN,
          HttpStatus.UNAUTHORIZED
        );
      }
    }

    // 4. 공개 엔드포인트인 경우 토큰이 없어도 통과
    if (isPublic) {
      request.user = undefined;
      request.guestToken = undefined;
      return true;
    }

    // 5. 토큰이 누락된 비공개 엔드포인트 차단
    throw new BusinessException(
      "인증 토큰 또는 게스트 토큰이 필요합니다.",
      ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
      HttpStatus.UNAUTHORIZED
    );
  }
}
