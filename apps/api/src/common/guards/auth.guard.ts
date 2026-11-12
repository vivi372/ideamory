import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  HttpStatus,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { BusinessException } from "../exceptions/business.exception";

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
 * 외부 API 왕복 레이턴시 없이 JWKS 캐싱을 통해 0ms에 준하는 속도로 토큰 서명을 검증하며,
 * 익명 게스트 세션(X-Guest-Token) 및 @Public() 데코레이터를 완벽 지원합니다.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly reflector: Reflector) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl) {
      const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
      this.jwks = createRemoteJWKSet(jwksUrl);
    }
  }

  /**
   * Supabase Auth 공개키 셋(JWKS) 인스턴스 획득 (지연 초기화 및 캐싱)
   */
  private getJWKS(): ReturnType<typeof createRemoteJWKSet> {
    if (!this.jwks) {
      const supabaseUrl = process.env.SUPABASE_URL;
      if (!supabaseUrl) {
        this.logger.error("SUPABASE_URL 환경변수가 설정되지 않았습니다.");
        throw new BusinessException(
          "인증 서버 설정이 유효하지 않습니다.",
          "AUTH_FATAL_CONFIG_ERROR",
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
      const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
      this.jwks = createRemoteJWKSet(jwksUrl);
    }
    return this.jwks;
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

    // 2. Authorization Bearer JWT 검증 시도
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token) {
        try {
          const JWKS = this.getJWKS();
          // Supabase Auth ECC P-256 (ES256) 비대칭키 서명 로컬 검증
          const { payload } = await jwtVerify(token, JWKS, {
            algorithms: ["ES256"],
          });

          if (!payload.sub) {
            throw new BusinessException(
              "유효하지 않은 토큰 페이로드입니다.",
              "AUTH_ALERT_INVALID_PAYLOAD",
              HttpStatus.UNAUTHORIZED
            );
          }

          // 검증 성공 시 사용자 식별자를 요청 객체에 바인딩
          request.user = {
            id: payload.sub,
            email: typeof payload.email === "string" ? payload.email : undefined,
            ...payload,
          };

          return true;
        } catch (error: any) {
          if (error instanceof BusinessException) {
            throw error;
          }
          this.logger.warn(`JWT 서명 검증 실패: ${error?.message || error}`);
          if (!isPublic) {
            throw new BusinessException(
              "유효하지 않거나 만료된 인증 토큰입니다.",
              "AUTH_ALERT_UNAUTHORIZED",
              HttpStatus.UNAUTHORIZED
            );
          }
        }
      }
    }

    // 3. X-Guest-Token 게스트 세션 검증 시도
    if (typeof guestHeader === "string" && guestHeader.trim().length > 0) {
      const cleanGuestToken = guestHeader.trim();
      // 게스트 토큰 규격(최대 64자) 검증
      if (cleanGuestToken.length <= 64) {
        request.guestToken = cleanGuestToken;
        return true;
      } else if (!isPublic) {
        throw new BusinessException(
          "유효하지 않은 게스트 토큰 형식입니다.",
          "AUTH_ALERT_INVALID_GUEST_TOKEN",
          HttpStatus.UNAUTHORIZED
        );
      }
    }

    // 4. 공개 엔드포인트인 경우 토큰이 없어도 통과
    if (isPublic) {
      return true;
    }

    // 5. 토큰이 누락된 비공개 엔드포인트 차단
    throw new BusinessException(
      "인증 토큰 또는 게스트 토큰이 필요합니다.",
      "AUTH_ALERT_UNAUTHORIZED",
      HttpStatus.UNAUTHORIZED
    );
  }
}
