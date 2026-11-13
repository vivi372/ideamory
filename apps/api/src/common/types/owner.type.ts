/**
 * 요청 주체(소셜 정회원 UUID 또는 익명 게스트 토큰)의 배타적 소유권 식별자
 * 인증(auth), 메모(memo), 카테고리(category) 등 전 도메인 계층에서 공통으로 사용됩니다.
 */
export interface OwnerIdentity {
  userId?: string;
  guestToken?: string;
}
