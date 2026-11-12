import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ArgumentsHost, HttpStatus, BadRequestException } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";
import { BusinessException } from "../exceptions/business.exception";
import { runWithTraceId } from "../logging/trace-store";
import type { ErrorResponseDto } from "@ideamory/api-spec";

describe("HttpExceptionFilter (표준 ErrorResponseDto 및 UX 태그 자동 분류 검증)", () => {
  const filter = new HttpExceptionFilter();

  /**
   * Mock ArgumentsHost 생성 헬퍼 함수
   */
  function createMockHost(headers: Record<string, string | undefined> = {}): {
    host: ArgumentsHost;
    responseMock: { status: (code: number) => any; json: (body: any) => any; capturedStatus?: number; capturedBody?: ErrorResponseDto };
  } {
    const request = {
      headers,
      method: "POST",
      url: "/api/memos",
    };

    const responseMock = {
      capturedStatus: undefined as number | undefined,
      capturedBody: undefined as ErrorResponseDto | undefined,
      status(code: number) {
        this.capturedStatus = code;
        return this;
      },
      json(body: any) {
        this.capturedBody = body;
        return this;
      },
    };

    const host: ArgumentsHost = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => responseMock,
        getNext: () => ({}),
      }),
    } as any;

    return { host, responseMock };
  }

  it("시나리오 1: 커스텀 BusinessException 포착 시 ErrorResponseDto 규격 및 [도메인]_[UX태그]_[원인] 포맷을 충족해야 한다", () => {
    const testTraceId = "4bf92f3577b34da6a3ce929d0e0e4736";

    runWithTraceId(testTraceId, () => {
      const { host, responseMock } = createMockHost();
      const exception = new BusinessException(
        "메모를 찾을 수 없습니다.",
        "MEMO_WARN_NOT_FOUND",
        HttpStatus.NOT_FOUND
      );

      filter.catch(exception, host);

      assert.equal(responseMock.capturedStatus, 404);
      const body = responseMock.capturedBody!;
      assert.ok(body);
      assert.equal(body.statusCode, 404);
      assert.equal(body.errorCode, "MEMO_WARN_NOT_FOUND");
      assert.equal(body.message, "메모를 찾을 수 없습니다.");
      assert.equal(body.traceId, testTraceId);
      assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  it("시나리오 2: validation 에러 배열을 포함하는 HttpException 포착 시 메시지를 안전하게 병합하고 UX 태그를 도출해야 한다", () => {
    const { host, responseMock } = createMockHost();
    const exception = new BadRequestException({
      message: ["메모 내용은 필수입니다.", "최대 5000자 이내여야 합니다."],
      error: "Bad Request",
    });

    filter.catch(exception, host);

    assert.equal(responseMock.capturedStatus, 400);
    const body = responseMock.capturedBody!;
    assert.equal(body.statusCode, 400);
    assert.equal(body.errorCode, "SYSTEM_FIELD_BAD_REQUEST");
    assert.equal(body.message, "메모 내용은 필수입니다., 최대 5000자 이내여야 합니다.");
    assert.match(body.traceId, /^[0-9a-f]{32}$/);
  });

  it("시나리오 3: 미처리 시스템 장애(Error) 포착 시 500 SYSTEM_FATAL_INTERNAL로 마스킹되고 스택 트레이스가 클라이언트에 노출되지 않아야 한다", () => {
    const { host, responseMock } = createMockHost();
    const exception = new Error("PostgreSQL connection timeout failure at internal socket");

    filter.catch(exception, host);

    assert.equal(responseMock.capturedStatus, 500);
    const body = responseMock.capturedBody!;
    assert.equal(body.statusCode, 500);
    assert.equal(body.errorCode, "SYSTEM_FATAL_INTERNAL");
    assert.equal(body.message, "PostgreSQL connection timeout failure at internal socket");
    assert.equal((body as any).stack, undefined);
    assert.match(body.traceId, /^[0-9a-f]{32}$/);
  });

  it("시나리오 4: traceStore 비동기 컨텍스트가 없을 때 x-trace-id 요청 헤더를 읽어 동일한 32자리 Hex를 응답에 주입해야 한다", () => {
    const headerTraceId = "e2182d9061034f71a067675e4663b7d1";
    const { host, responseMock } = createMockHost({
      "x-trace-id": headerTraceId,
    });
    const exception = new BusinessException(
      "카테고리 글자수 초과",
      "CATEGORY_FIELD_EXCEEDED",
      HttpStatus.BAD_REQUEST
    );

    filter.catch(exception, host);

    const body = responseMock.capturedBody!;
    assert.equal(body.traceId, headerTraceId);
  });
});

