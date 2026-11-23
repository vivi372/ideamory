import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import {
  McpAuthGuard,
  type McpAuthenticatedRequest,
} from "./guards/mcp-auth.guard";
import { McpServerService, type JsonRpcRequest } from "./mcp-server.service";

/**
 * Ideamory Remote MCP Streamable HTTP 엔드포인트 컨트롤러입니다.
 * 전역 Supabase JWT 가드를 `@Public()`으로 우회하고 `McpAuthGuard`(PAT 해시 검증)로 인증합니다.
 */
@ApiTags("MCP Server")
@Public()
@UseGuards(McpAuthGuard)
@Controller("api/v1/mcp")
export class McpServerController {
  constructor(private readonly mcpServerService: McpServerService) {}

  /**
   * Claude Desktop, Cursor 등 외부 AI 클라이언트의 MCP JSON-RPC 2.0 요청을 처리합니다.
   *
   * @param req `McpAuthGuard`가 검증한 컨텍스트가 주입된 요청 객체
   * @param body JSON-RPC 2.0 요청 페이로드
   * @param res Express 응답 객체 (알림 메시지 시 202 Accepted 반환)
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Remote MCP Streamable HTTP 엔드포인트",
    description:
      "Authorization: Bearer idm_live_... 헤더로 인증된 MCP 클라이언트의 JSON-RPC 2.0 요청을 처리합니다.",
  })
  async handleRpc(
    @Req() req: McpAuthenticatedRequest,
    @Body() body: JsonRpcRequest,
    @Res() res: Response,
  ): Promise<void> {
    const response = await this.mcpServerService.handleJsonRpc(
      req.mcpContext!,
      body,
    );

    if (!response) {
      res.status(HttpStatus.ACCEPTED).send();
      return;
    }

    res.status(HttpStatus.OK).json(response);
  }
}
