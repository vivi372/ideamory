import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * 인증된 사용자 정보를 포함하는 Express Request 인터페이스 확장
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    [key: string]: any;
  };
}

/**
 * jose 기반 최신 Supabase Auth (ECC Curve P-256 / ES256) JWT 로컬 검증 가드
 * 외부 HTTP 왕복 통신 없이 캐싱된 JWKS를 통해 0ms에 준하는 속도로 토큰 서명을 검증합니다.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (supabaseUrl) {
      const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
      this.jwks = createRemoteJWKSet(jwksUrl);
    }
  }

  private getJWKS(): ReturnType<typeof createRemoteJWKSet> {
    if (!this.jwks) {
      const supabaseUrl = process.env.SUPABASE_URL;
      if (!supabaseUrl) {
        this.logger.error("SUPABASE_URL 환경변수가 설정되지 않았습니다.");
        throw new UnauthorizedException("인증 서버 설정이 유효하지 않습니다.");
      }
      const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
      this.jwks = createRemoteJWKSet(jwksUrl);
    }
    return this.jwks;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException(
        "인증 토큰이 누락되었거나 Bearer 형식이 아닙니다."
      );
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new UnauthorizedException("인증 토큰이 비어 있습니다.");
    }

    try {
      const JWKS = this.getJWKS();
      // 최신 Supabase Auth ECC Curve P-256 (ES256) 비대칭키 서명 로컬 검증
      const { payload } = await jwtVerify(token, JWKS, {
        algorithms: ["ES256"],
      });

      if (!payload.sub) {
        throw new UnauthorizedException("유효하지 않은 토큰 페이로드입니다.");
      }

      // 검증 성공 시 사용자 식별자(UUID)를 요청 객체에 바인딩
      request.user = {
        id: payload.sub,
        ...payload,
      };

      return true;
    } catch (error: any) {
      this.logger.warn(`JWT 서명 검증 실패: ${error?.message || error}`);
      throw new UnauthorizedException("유효하지 않거나 만료된 인증 토큰입니다.");
    }
  }
}

