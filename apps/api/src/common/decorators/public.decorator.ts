import { CustomDecorator, SetMetadata } from "@nestjs/common";

/**
 * 인증 검증을 건너뛰는 공개(Public) 엔드포인트용 메타데이터 키
 */
export const IS_PUBLIC_KEY = "isPublic";

/**
 * 특정 컨트롤러 또는 핸들러를 비인증 공개 엔드포인트로 설정하는 데코레이터
 * 예: 헬스체크, 온보딩 게스트 초기화 등
 */
export const Public = (): CustomDecorator<string> =>
  SetMetadata(IS_PUBLIC_KEY, true);

