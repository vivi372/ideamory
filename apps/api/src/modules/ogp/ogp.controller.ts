import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiBody,
} from "@nestjs/swagger";
import {
  ParseOgpSchema,
  type ParseOgpDto,
  type OgpResponseDto,
} from "@ideamory/api-spec";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { OgpService } from "./ogp.service";

/**
 * URL Open Graph 메타데이터 수동 파싱 및 캐시 조회 컨트롤러
 */
@ApiTags("ogp")
@ApiBearerAuth("Authorization")
@ApiSecurity("X-Guest-Token")
@ApiSecurity("X-Trace-Id")
@Controller("api/v1/ogp")
export class OgpController {
  constructor(private readonly ogpService: OgpService) {}

  /**
   * 대상 URL의 Open Graph 메타데이터를 파싱하고 14일 TTL 공유 캐시에 저장한 결과를 반환합니다.
   *
   * @param dto 파싱할 대상 URL 요청 DTO
   * @returns 파싱 또는 캐시 적중된 OGP 메타데이터
   */
  @Post("parse")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(ParseOgpSchema))
  @ApiOperation({
    summary: "URL OGP 메타데이터 파싱",
    description:
      "단독 URL의 Open Graph 정보를 크롤링하고 14일 TTL 공유 캐시에 저장/반환합니다.",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["url"],
      properties: {
        url: {
          type: "string",
          format: "uri",
          example: "https://nextjs.org",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "OGP 메타데이터 파싱 또는 캐시 조회 성공",
  })
  async parseOgp(@Body() dto: ParseOgpDto): Promise<OgpResponseDto> {
    return this.ogpService.parseAndCacheOgp(dto.url);
  }
}

