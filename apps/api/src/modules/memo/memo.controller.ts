import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import {
  CreateMemoSchema,
  UpdateMemoSchema,
  GetMemosQuerySchema,
  UuidV7Schema,
  type CreateMemoDto,
  type UpdateMemoDto,
  type GetMemosQueryDto,
  type MemoResponseDto,
} from "@ideamory/api-spec";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { MemoService } from "./memo.service";

/**
 * 메모 코어(0.1초 퀵 캡처, 타임라인 조회, 인라인 수정, 소프트 삭제, 원클릭 복구) REST API 컨트롤러
 */
@ApiTags("memo")
@ApiBearerAuth("Authorization")
@ApiSecurity("X-Guest-Token")
@ApiSecurity("X-Trace-Id")
@Controller("api/v1/memos")
export class MemoController {
  constructor(private readonly memoService: MemoService) {}

  /**
   * 0.1초 퀵 캡처 API: 메모를 즉시 선저장하여 201 응답을 반환하고, AI 분류·임베딩·OGP 크롤링은 비동기 처리합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체(userId 또는 guestToken)
   * @param dto 선발급 UUID v7 및 메모 본문 DTO
   * @returns 생성된 메모 응답 DTO
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "메모 0.1초 퀵 캡처",
    description:
      "문두 @카테고리 지시어를 우선 파싱해 DB에 즉시 저장(201)하고, LLM 분류·768차원 임베딩·대표 URL OGP 크롤링을 비동기로 실행합니다.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["id", "content"],
      properties: {
        id: {
          type: "string",
          format: "uuid",
          example: "018d0000-0000-7000-8000-000000000001",
        },
        content: {
          type: "string",
          example: "@개발 NestJS Drizzle 파이프라인 https://nestjs.com",
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: "메모 퀵 캡처 선저장 성공" })
  async createMemo(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateMemoSchema)) dto: CreateMemoDto
  ): Promise<MemoResponseDto> {
    return this.memoService.createMemo(
      { userId: user.userId, guestToken: user.guestToken },
      dto
    );
  }

  /**
   * 메인 타임라인 또는 30일 휴지통 메모 목록을 최신순으로 조회합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체
   * @param query 카테고리 필터(categoryId) 및 휴지통 여부(deleted)
   * @returns OGP 메타데이터가 조인된 메모 목록
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "메모 타임라인 목록 조회",
    description:
      "활성 메모 또는 휴지통(deleted=true) 메모 목록을 OGP 메타데이터와 함께 최신순으로 조회합니다.",
  })
  @ApiQuery({ name: "categoryId", required: false, type: String })
  @ApiQuery({ name: "deleted", required: false, type: Boolean })
  @ApiResponse({ status: 200, description: "메모 목록 조회 성공" })
  async getMemos(
    @CurrentUser() user: CurrentUserPayload,
    @Query(new ZodValidationPipe(GetMemosQuerySchema)) query: GetMemosQueryDto
  ): Promise<MemoResponseDto[]> {
    return this.memoService.getMemos(
      { userId: user.userId, guestToken: user.guestToken },
      query
    );
  }

  /**
   * 메모의 본문 인라인 수정 또는 카테고리 수동 변경을 처리합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체
   * @param id 대상 메모 UUID v7
   * @param dto 수정할 content 및/또는 categoryId
   * @returns 수정된 최신 메모 응답 DTO
   */
  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "메모 본문 수정 및 카테고리 변경",
    description:
      "타임라인에서 메모 본문을 인라인으로 수정하거나 카테고리를 수동 변경합니다.",
  })
  @ApiParam({ name: "id", type: String, description: "메모 UUID v7" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        content: { type: "string", example: "수정된 메모 내용" },
        categoryId: { type: "string", format: "uuid" },
      },
    },
  })
  @ApiResponse({ status: 200, description: "메모 수정 성공" })
  async updateMemo(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id", new ZodValidationPipe(UuidV7Schema)) id: string,
    @Body(new ZodValidationPipe(UpdateMemoSchema)) dto: UpdateMemoDto
  ): Promise<MemoResponseDto> {
    return this.memoService.updateMemo(
      { userId: user.userId, guestToken: user.guestToken },
      id,
      dto
    );
  }

  /**
   * 실수 방지를 위해 메모를 30일 휴지통으로 이동(Soft Delete)하며 본문 없이 204를 반환합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체
   * @param id 삭제할 메모 UUID v7
   */
  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "메모 소프트 삭제 (30일 휴지통 이동)",
    description:
      "deleted_at 타임스탬프를 기록하여 30일 휴지통으로 이동합니다. 응답 본문은 없습니다(204).",
  })
  @ApiParam({ name: "id", type: String, description: "메모 UUID v7" })
  @ApiResponse({ status: 204, description: "소프트 삭제 완료 (응답 본문 없음)" })
  async softDeleteMemo(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id", new ZodValidationPipe(UuidV7Schema)) id: string
  ): Promise<void> {
    await this.memoService.softDeleteMemo(
      { userId: user.userId, guestToken: user.guestToken },
      id
    );
  }

  /**
   * 휴지통에 보관된 메모를 활성 타임라인으로 원클릭 복구합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체
   * @param id 복구할 메모 UUID v7
   * @returns 복구된 메모 응답 DTO
   */
  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "휴지통 메모 원클릭 복구",
    description:
      "deleted_at을 NULL로 되돌려 활성 타임라인 및 카테고리 칩으로 복구합니다.",
  })
  @ApiParam({ name: "id", type: String, description: "메모 UUID v7" })
  @ApiResponse({ status: 200, description: "메모 복구 성공" })
  async restoreMemo(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id", new ZodValidationPipe(UuidV7Schema)) id: string
  ): Promise<MemoResponseDto> {
    return this.memoService.restoreMemo(
      { userId: user.userId, guestToken: user.guestToken },
      id
    );
  }
}

