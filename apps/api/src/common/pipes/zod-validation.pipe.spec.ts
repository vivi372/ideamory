import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HttpStatus } from "@nestjs/common";
import { CreateMemoSchema } from "@ideamory/api-spec";
import { ZodValidationPipe } from "./zod-validation.pipe";
import { BusinessException } from "../exceptions/business.exception";

describe("ZodValidationPipe (단일 진실 공급원 DTO 런타임 유효성 검증)", () => {
  const pipe = new ZodValidationPipe(CreateMemoSchema);
  const metadata = { type: "body" as const };

  it("시나리오 1: 올바른 UUID v7 및 규격 내 content가 유입되면 검증을 통과하고 변환된 데이터를 반환해야 한다", () => {
    const validPayload = {
      id: "018d0000-0000-7000-8000-000000000001",
      content: "0.1초 퀵 캡처 아이디어 메모",
    };

    const result = pipe.transform(validPayload, metadata);

    assert.deepEqual(result, validPayload);
  });

  it("시나리오 2-A: 필수 필드 content가 빈 문자열이면 400 Bad Request 및 MEMO_FIELD_REQUIRED 에러를 발생시켜야 한다", () => {
    const emptyPayload = {
      id: "018d0000-0000-7000-8000-000000000001",
      content: "", // min(1) 위반
    };

    assert.throws(
      () => {
        pipe.transform(emptyPayload, metadata);
      },
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
        assert.equal(err.errorCode, "MEMO_FIELD_REQUIRED");
        assert.equal(err.message, "메모 내용을 입력해 주세요.");
        return true;
      }
    );
  });

  it("시나리오 2-B: content가 5000자를 초과하면 400 Bad Request 및 MEMO_FIELD_EXCEEDED 에러를 발생시켜야 한다", () => {
    const oversizedPayload = {
      id: "018d0000-0000-7000-8000-000000000001",
      content: "a".repeat(5001), // max(5000) 위반
    };

    assert.throws(
      () => {
        pipe.transform(oversizedPayload, metadata);
      },
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
        assert.equal(err.errorCode, "MEMO_FIELD_EXCEEDED");
        assert.equal(err.message, "메모는 최대 5000자까지 작성할 수 있습니다.");
        return true;
      }
    );
  });

  it("시나리오 2-C: id가 UUID v7 형식이 아니면 400 Bad Request 및 COMMON_FIELD_FORMAT 에러를 발생시켜야 한다", () => {
    const invalidIdPayload = {
      id: "not-a-uuid-v7",
      content: "정상 메모 본문",
    };

    assert.throws(
      () => {
        pipe.transform(invalidIdPayload, metadata);
      },
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
        assert.equal(err.errorCode, "COMMON_FIELD_FORMAT");
        assert.equal(err.message, "올바른 UUID v7 형식이어야 합니다.");
        return true;
      }
    );
  });

  it("시나리오 3: 스키마가 주입되지 않은 파이프의 경우 원본 값을 그대로 통과시켜야 한다", () => {
    const rawPipe = new ZodValidationPipe();
    const rawData = { any: "data" };

    const result = rawPipe.transform(rawData, metadata);

    assert.deepEqual(result, rawData);
  });
});

