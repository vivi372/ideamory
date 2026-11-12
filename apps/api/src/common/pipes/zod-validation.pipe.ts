import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  HttpStatus,
} from "@nestjs/common";
import { ZodSchema, ZodError } from "zod";
import { getErrorCodeFromZodIssue } from "@ideamory/api-spec";
import { BusinessException } from "../exceptions/business.exception";

/**
 * @ideamory/api-spec Zod 스키마를 단일 진실 공급원(SSOT)으로 사용하는 전역 유효성 검사 파이프
 * 요청 본문(Body), 쿼리(Query), 파라미터(Param)를 safeParse로 검증하고
 * 실패 시 [도메인]_FIELD_[원인] 규격의 UX 태그 에러를 담은 BusinessException을 발생시킵니다.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema<any>) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // 1. 파이프 생성자에 직접 주입된 스키마 또는 커스텀 스키마 확인
    const targetSchema = this.schema;

    // 적용할 스키마가 없는 경우 원본 값 그대로 반환
    if (!targetSchema) {
      return value;
    }

    // 2. 런타임 Zod 유효성 검사 수행
    const result = targetSchema.safeParse(value);

    if (!result.success) {
      const error: ZodError = result.error;
      const firstIssue = error.issues[0];
      const message = firstIssue.message || "입력값이 유효하지 않습니다.";

      // 3. @ideamory/api-spec 중앙 파서를 통해 표준 에러 코드 도출 (SSOT)
      const errorCode = getErrorCodeFromZodIssue(firstIssue);

      throw new BusinessException(message, errorCode, HttpStatus.BAD_REQUEST);
    }

    return result.data;
  }
}
