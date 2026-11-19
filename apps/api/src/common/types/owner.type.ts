import { HttpStatus } from "@nestjs/common";
import { ERROR_CODES } from "@ideamory/api-spec";
import { BusinessException } from "../exceptions/business.exception";

/**
 * 요청 주체(소셜 정회원 UUID 또는 익명 게스트 토큰)의 배타적 소유권 식별자
 * 인증(auth), 메모(memo), 카테고리(category) 등 전 도메인 계층에서 공통으로 사용됩니다.
 */
export interface OwnerIdentity {
  userId?: string;
  guestToken?: string;
}

/**
 * 요청 주체(소셜 정회원 userId 또는 익명 게스트 guestToken)의 배타적 식별자가 유효한지 검증합니다.
 *
 * [설계 배경]
 * Ideamory의 모든 메모·카테고리는 소셜 정회원(`userId`) 또는 게스트(`guestToken`) 중
 * 반드시 하나의 소유권을 가져야 하므로, 서비스 진입 시점에 두 식별자가 모두 누락된 경우
 * 401 Unauthorized(`AUTH_ALERT_UNAUTHORIZED`) 비즈니스 예외를 즉시 발생시킵니다.
 *
 * @param owner 컨트롤러에서 추출된 요청 주체 식별자
 * @throws BusinessException userId와 guestToken이 모두 누락된 경우 401 Unauthorized 발생
 */
export function assertOwnerIdentity(owner: OwnerIdentity): void {
  if (!owner.userId && !owner.guestToken) {
    throw new BusinessException(
      "인증 토큰 또는 게스트 토큰이 필요합니다.",
      ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
      HttpStatus.UNAUTHORIZED
    );
  }
}
