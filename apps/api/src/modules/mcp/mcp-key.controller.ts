import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  CreateMcpKeySchema,
  type CreateMcpKeyDto,
  type McpKeyCreatedResponseDto,
  type McpKeyStatusResponseDto,
} from "@ideamory/api-spec";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { McpKeyService } from "./mcp-key.service";

/**
 * 사용자의 MCP API 키 발급, 상태 조회 및 폐기를 담당하는 REST 컨트롤러입니다.
 * 전역 `AuthGuard`(소셜 JWT 또는 게스트 토큰)를 통해 소유자를 식별합니다.
 */
@ApiTags("MCP Keys")
@Controller("api/v1/mcp-keys")
export class McpKeyController {
  constructor(private readonly mcpKeyService: McpKeyService) {}

  /**
   * 현재 사용자의 MCP API 키 보유 상태 및 메타데이터를 조회합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체
   * @returns 키 보유 여부, 접두어, 허용 권한, 고정 카테고리, 생성/최근 사용 시각
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "MCP API 키 상태 조회",
    description:
      "현재 계정의 활성 MCP API 키 메타데이터(접두어, 권한, 고정 카테고리)를 조회합니다.",
  })
  @ApiResponse({ status: 200, description: "MCP 키 상태 조회 성공" })
  async getKeyStatus(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<McpKeyStatusResponseDto> {
    return this.mcpKeyService.getKeyStatus({
      userId: user.userId,
      guestToken: user.guestToken,
    });
  }

  /**
   * 신규 MCP API 키를 발급하거나 기존 활성 키를 원자적으로 재발급합니다.
   * 원문 `apiKey`는 본 응답 시점에만 1회 반환되며 이후 재조회할 수 없습니다.
   *
   * @param user 인증 가드가 주입한 요청 주체
   * @param body 허용 권한(`READ`, `WRITE`) 및 선택적 고정 카테고리명
   * @returns 원문 `apiKey`가 포함된 생성 응답 DTO
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "MCP API 키 발급 또는 재발급",
    description:
      "소유자당 단일 활성 키 원칙에 따라 신규 MCP API 키를 발급(또는 기존 키 교체)합니다.",
  })
  @ApiResponse({ status: 201, description: "MCP 키 발급 성공" })
  async issueKey(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateMcpKeySchema)) body: CreateMcpKeyDto,
  ): Promise<McpKeyCreatedResponseDto> {
    return this.mcpKeyService.issueKey(
      {
        userId: user.userId,
        guestToken: user.guestToken,
      },
      body,
    );
  }

  /**
   * 현재 사용자의 활성 MCP API 키를 즉시 폐기(삭제)합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "MCP API 키 폐기",
    description: "현재 활성화된 MCP API 키를 즉시 삭제하여 외부 연동을 차단합니다.",
  })
  @ApiResponse({ status: 204, description: "MCP 키 폐기 성공" })
  async revokeKey(@CurrentUser() user: CurrentUserPayload): Promise<void> {
    await this.mcpKeyService.revokeKey({
      userId: user.userId,
      guestToken: user.guestToken,
    });
  }
}
