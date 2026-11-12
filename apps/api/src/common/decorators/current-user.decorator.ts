import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedRequest } from "../guards/auth.guard";

/**
 * 요청 주체(정회원 또는 게스트) 식별 정보 페이로드
 */
export interface CurrentUserPayload {
  userId?: string;
  email?: string;
  guestToken?: string;
  isGuest: boolean;
  rawUser?: Record<string, any>;
}

/**
 * 컨트롤러 핸들러 파라미터에서 현재 인증된 유저 또는 게스트 정보를 추출하는 데코레이터
 *
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: CurrentUserPayload) {
 *   return user;
 * }
 *
 * @Get('id')
 * getUserId(@CurrentUser('userId') userId: string) {
 *   return userId;
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    const payload: CurrentUserPayload = {
      userId: request.user?.id,
      email: request.user?.email,
      guestToken: request.guestToken,
      isGuest: !request.user && !!request.guestToken,
      rawUser: request.user,
    };

    if (data) {
      return payload[data];
    }

    return payload;
  }
);

