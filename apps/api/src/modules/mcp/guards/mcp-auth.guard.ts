import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { ERROR_CODES } from "@ideamory/api-spec";
import { BusinessException } from "../../../common/exceptions/business.exception";
import { McpKeyService, type VerifiedMcpContext } from "../mcp-key.service";

export interface McpAuthenticatedRequest extends Request {
  mcpContext?: VerifiedMcpContext;
}

/**
 * Remote MCP 엔드포인트(`/api/v1/mcp`) 전용 Bearer API 키 인증 가드입니다.
 * `Authorization: Bearer idm_live_...` 헤더를 추출해 SHA-256 해시 대조 후 요청 컨텍스트에 바인딩합니다.
 */
@Injectable()
export class McpAuthGuard implements CanActivate {
  constructor(private readonly mcpKeyService: McpKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<McpAuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new BusinessException(
        "MCP Authorization Bearer 토큰이 필요합니다.",
        ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const rawToken = authHeader.slice("Bearer ".length).trim();
    request.mcpContext = await this.mcpKeyService.verifyBearerToken(rawToken);
    return true;
  }
}
