import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
  ApiBody,
} from "@nestjs/swagger";
import {
  CreateCategorySchema,
  UpdateCategorySchema,
  MergeCategorySchema,
  UuidV7Schema,
  type CreateCategoryDto,
  type UpdateCategoryDto,
  type MergeCategoryDto,
  type CategoryResponseDto,
  type MergeCategoryResponseDto,
  type MergeSuggestionResponseDto,
} from "@ideamory/api-spec";
import {
  CurrentUser,
  type CurrentUserPayload,
} from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CategoryService } from "./category.service";

/**
 * 카테고리 CRUD 및 유사 카테고리 원클릭 병합 REST API 컨트롤러
 */
@ApiTags("category")
@ApiBearerAuth("Authorization")
@ApiSecurity("X-Guest-Token")
@ApiSecurity("X-Trace-Id")
@Controller("api/v1/categories")
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * 활성 메모(deleted_at IS NULL)가 1건 이상 존재하는 카테고리 목록을 조회합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체(userId 또는 guestToken)
   * @returns 활성 메모 수가 집계된 카테고리 목록
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "활성 카테고리 목록 조회",
    description:
      "활성 메모(deleted_at IS NULL)가 1건 이상 존재하는 카테고리만 메모 개수(memoCount)와 함께 반환합니다.",
  })
  @ApiResponse({ status: 200, description: "활성 카테고리 목록 반환 성공" })
  async getCategories(
    @CurrentUser() user: CurrentUserPayload
  ): Promise<CategoryResponseDto[]> {
    return this.categoryService.getCategories({
      userId: user.userId,
      guestToken: user.guestToken,
    });
  }

  /**
   * 대기 중인 AI 유사 카테고리 병합 제안 큐를 조회합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체(userId 또는 guestToken)
   * @returns 사이드바 뱃지 및 상단 1줄 배너용 병합 제안 목록
   */
  @Get("merge-suggestions")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "유사 카테고리 병합 제안 큐 조회",
    description:
      "pgvector 코사인 유사도 0.85 이상으로 탐지되어 대기 중인 유사 카테고리 병합 제안 목록을 반환합니다.",
  })
  @ApiResponse({ status: 200, description: "병합 제안 목록 반환 성공" })
  async getMergeSuggestions(
    @CurrentUser() user: CurrentUserPayload
  ): Promise<MergeSuggestionResponseDto[]> {
    return this.categoryService.getMergeSuggestions({
      userId: user.userId,
      guestToken: user.guestToken,
    });
  }

  /**
   * 유사 카테고리 병합 제안을 거절하고 DB에서 즉시 영구 삭제합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체
   * @param id 거절할 병합 제안 UUID v7
   */
  @Delete("merge-suggestions/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "유사 카테고리 병합 제안 거절 및 영구 삭제",
    description:
      "사용자가 [합치지 않기]를 선택한 제안 레코드를 즉시 영구 삭제(204 No Content)하여 재알림을 방지합니다.",
  })
  @ApiParam({
    name: "id",
    description: "거절할 병합 제안 UUID v7",
    example: "018d0000-0000-7000-8000-000000000099",
  })
  @ApiResponse({ status: 204, description: "병합 제안 영구 삭제 성공 (Empty Body)" })
  @ApiResponse({ status: 404, description: "대상 제안 없음 또는 소유권 불일치" })
  async dismissMergeSuggestion(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id", new ZodValidationPipe(UuidV7Schema)) id: string
  ): Promise<void> {
    await this.categoryService.dismissMergeSuggestion(
      { userId: user.userId, guestToken: user.guestToken },
      id
    );
  }

  /**
   * 텍스트 전용 신규 카테고리를 수동 생성합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체
   * @param dto 선발급 UUID v7 및 1~10자 카테고리명 DTO
   * @returns 생성된 카테고리 응답 DTO
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "카테고리 수동 생성",
    description:
      "이모지가 배제된 1~10자 텍스트 전용 카테고리를 생성합니다. 공백 정규화 키가 중복되면 409 Conflict를 반환합니다.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["id", "name"],
      properties: {
        id: {
          type: "string",
          format: "uuid",
          example: "018d0000-0000-7000-8000-000000000010",
        },
        name: {
          type: "string",
          example: "아이디어",
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: "카테고리 생성 성공" })
  @ApiResponse({ status: 400, description: "글자수 초과 또는 이모지 포함 오류" })
  @ApiResponse({ status: 409, description: "공백 정규화 기준 중복 카테고리" })
  async createCategory(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateCategorySchema)) dto: CreateCategoryDto
  ): Promise<CategoryResponseDto> {
    return this.categoryService.createCategory(
      { userId: user.userId, guestToken: user.guestToken },
      dto
    );
  }

  /**
   * 기존 카테고리의 명칭을 수정합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체
   * @param id 수정할 카테고리 UUID v7
   * @param dto 새 카테고리명 DTO
   * @returns 수정된 카테고리 응답 DTO
   */
  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "카테고리 명칭 수정",
    description:
      "카테고리 이름을 변경합니다(1~10자, 이모지 배제). 자기 자신을 제외한 동일 정규화 키가 있으면 409 Conflict를 반환합니다.",
  })
  @ApiParam({
    name: "id",
    description: "수정할 카테고리 UUID v7",
    example: "018d0000-0000-7000-8000-000000000010",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["name"],
      properties: {
        name: {
          type: "string",
          example: "개발메모",
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: "카테고리 수정 성공" })
  @ApiResponse({ status: 404, description: "대상 카테고리 없음 또는 소유권 불일치" })
  @ApiResponse({ status: 409, description: "공백 정규화 기준 중복 카테고리" })
  async updateCategory(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id", new ZodValidationPipe(UuidV7Schema)) id: string,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) dto: UpdateCategoryDto
  ): Promise<CategoryResponseDto> {
    return this.categoryService.updateCategory(
      { userId: user.userId, guestToken: user.guestToken },
      id,
      dto
    );
  }

  /**
   * 의미론적 유사 카테고리를 단일 트랜잭션 내에서 원클릭으로 통합합니다.
   *
   * @param user 인증 가드가 주입한 요청 주체
   * @param dto 삭제될 원본 카테고리 ID 및 병합 대상 카테고리 ID
   * @returns 병합 성공 여부 및 이전된 메모 건수
   */
  @Post("merge")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "유사 카테고리 원클릭 병합",
    description:
      "원본 카테고리(sourceCategoryId)의 모든 메모를 대상 카테고리(targetCategoryId)로 일괄 이전하고 빈 원본 카테고리를 삭제합니다.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["sourceCategoryId", "targetCategoryId"],
      properties: {
        sourceCategoryId: {
          type: "string",
          format: "uuid",
          example: "018d0000-0000-7000-8000-000000000011",
        },
        targetCategoryId: {
          type: "string",
          format: "uuid",
          example: "018d0000-0000-7000-8000-000000000010",
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: "카테고리 병합 성공" })
  @ApiResponse({ status: 400, description: "동일한 카테고리 간 병합 시도" })
  @ApiResponse({ status: 404, description: "원본 또는 대상 카테고리 없음" })
  async mergeCategories(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(MergeCategorySchema)) dto: MergeCategoryDto
  ): Promise<MergeCategoryResponseDto> {
    return this.categoryService.mergeCategories(
      { userId: user.userId, guestToken: user.guestToken },
      dto
    );
  }
}
