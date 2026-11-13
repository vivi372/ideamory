import { HttpStatus, Logger } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { ERROR_CODES } from "@ideamory/api-spec";
import { BusinessException } from "../exceptions/business.exception";

/**
 * 애플리케이션 전역에서 공유되는 Supabase Auth JWKS(ECC Curve P-256) 인메모리 캐시
 * AuthGuard와 AuthService가 각각 JWKS 인스턴스를 중복 생성하여 캐시가 분산되는 문제를 방지합니다.
 */
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedSupabaseUrl: string | null = null;
const logger = new Logger("SupabaseJwtUtil");

/**
 * Supabase Auth 공개키 셋(JWKS) 싱글톤 인스턴스를 반환합니다.
 * SUPABASE_URL 환경변수가 변경되거나 최초 호출 시에만 지연 초기화합니다.
 *
 * @returns jose RemoteJWKSet 리졸버 함수
 * @throws BusinessException SUPABASE_URL이 누락된 경우 500 INTERNAL_SERVER_ERROR 발생
 */
export function getSharedSupabaseJWKS(): ReturnType<typeof createRemoteJWKSet> {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    logger.error("SUPABASE_URL 환경변수가 설정되지 않았습니다.");
    throw new BusinessException(
      "인증 서버 설정이 유효하지 않습니다.",
      ERROR_CODES.AUTH_FATAL_CONFIG_ERROR,
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  if (!cachedJwks || cachedSupabaseUrl !== supabaseUrl) {
    const jwksUrl = new URL("/auth/v1/.well-known/jwks.json", supabaseUrl);
    cachedJwks = createRemoteJWKSet(jwksUrl);
    cachedSupabaseUrl = supabaseUrl;
  }

  return cachedJwks;
}

/**
 * Supabase Auth JWT(ES256 / ECC P-256)의 서명과 issuer/audience/sub 클레임을 로컬 검증합니다.
 *
 * @param token 검증할 JWT 문자열
 * @param jwksResolver 테스트 환경 모킹 등을 위해 선택적으로 주입하는 JWKS 리졸버 (기본값: 공유 싱글톤)
 * @returns sub가 보장된 검증 완료 JWT 페이로드
 * @throws BusinessException 페이로드에 sub가 누락된 경우 401 AUTH_ALERT_INVALID_PAYLOAD, 서명/클레임 검증 실패 시 jose 에러 전파
 */
export async function verifySupabaseJwt(
  token: string,
  jwksResolver: ReturnType<typeof createRemoteJWKSet> = getSharedSupabaseJWKS()
): Promise<JWTPayload & { sub: string }> {
  const supabaseUrl = process.env.SUPABASE_URL;

  // issuer 및 audience 클레임 정밀 검증 (타 프로젝트 및 비인증 토큰 차단)
  const verifyOptions: Record<string, any> = {
    algorithms: ["ES256"],
    audience: "authenticated",
  };
  if (supabaseUrl) {
    verifyOptions.issuer = `${supabaseUrl}/auth/v1`;
  }

  const { payload } = await jwtVerify(token, jwksResolver, verifyOptions);

  if (!payload.sub) {
    throw new BusinessException(
      "유효하지 않은 토큰 페이로드입니다.",
      ERROR_CODES.AUTH_ALERT_INVALID_PAYLOAD,
      HttpStatus.UNAUTHORIZED
    );
  }

  return payload as JWTPayload & { sub: string };
}

