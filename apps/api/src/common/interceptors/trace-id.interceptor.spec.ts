import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of } from "rxjs";
import { TraceIdInterceptor } from "./trace-id.interceptor";
import { getTraceId } from "../logging/trace-store";

/**
 * W3C 32자리 분산 트레이싱 및 CORS 노출 인터셉터 단위 테스트
 * 검증 대상: Trace ID 상속, All-Zero 방어, 신규 자동 발급, CORS Expose 등록,
 * AsyncLocalStorage 스코프 전파, 민감정보 마스킹
 */
describe("TraceIdInterceptor 단위 검증", () => {
  const interceptor = new TraceIdInterceptor();

  /**
   * Mock ExecutionContext 및 CallHandler 생성 헬퍼
   */
  function createMockContext(rawTraceId?: string) {
    const reqHeaders: Record<string, string | undefined> = {};
    if (rawTraceId !== undefined) {
      reqHeaders["x-trace-id"] = rawTraceId;
    }

    const resHeaders: Record<string, string> = {};
    const mockReq = {
      headers: reqHeaders,
      method: "GET",
      originalUrl: "/api/test",
    };

    const mockRes = {
      setHeader(key: string, value: string) {
        resHeaders[key] = value;
      },
      getHeader(key: string) {
        return resHeaders[key];
      },
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockReq,
        getResponse: () => mockRes,
      }),
    } as unknown as ExecutionContext;

    let capturedTraceInHandler = "";
    const mockNext: CallHandler = {
      handle: () => {
        // 핸들러 실행 시점의 AsyncLocalStorage 컨텍스트 값 캡처
        capturedTraceInHandler = getTraceId();
        return of({ success: true });
      },
    };

    return {
      mockContext,
      mockNext,
      mockReq,
      resHeaders,
      getCapturedTrace: () => capturedTraceInHandler,
    };
  }

  // 시나리오 1: 정상적인 32자리 Hex 헤더 수신 시 (기존 값 보존 검증)
  it("시나리오 1: 유효한 32자리 Hex가 유입되면 기존 값을 보존하고 응답 헤더 및 컨텍스트에 전파해야 한다", (t, done) => {
    const validTraceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const { mockContext, mockNext, mockReq, resHeaders, getCapturedTrace } =
      createMockContext(validTraceId);

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: () => {
        // 1. 요청 헤더 값 보존 확인
        assert.equal(mockReq.headers["x-trace-id"], validTraceId);
        // 2. 응답 헤더 주입 확인
        assert.equal(resHeaders["X-Trace-Id"], validTraceId);
        // 3. AsyncLocalStorage 컨텍스트 일치 확인
        assert.equal(getCapturedTrace(), validTraceId);
        done();
      },
      error: done,
    });
  });

  // 시나리오 2: 헤더 누락 시 (신규 32자리 Hex 자동 발급 검증)
  it("시나리오 2: x-trace-id 헤더가 누락되면 서버에서 신규 32자리 Hex ID를 자동 발급해야 한다", (t, done) => {
    const { mockContext, mockNext, mockReq, resHeaders, getCapturedTrace } =
      createMockContext(undefined);

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: () => {
        const issuedTraceId = resHeaders["X-Trace-Id"];
        // 1. 32자리 Hex 정규식 검증
        assert.match(issuedTraceId, /^[0-9a-fA-F]{32}$/);
        // 2. 요청 헤더 및 응답 헤더 동기화 확인
        assert.equal(mockReq.headers["x-trace-id"], issuedTraceId);
        // 3. AsyncLocalStorage 컨텍스트 전파 확인
        assert.equal(getCapturedTrace(), issuedTraceId);
        done();
      },
      error: done,
    });
  });

  // 시나리오 3: 유효하지 않은 식별자 및 All-Zero 방어 검증 (무효화 및 재발급)
  it("시나리오 3-A: 길이가 짧거나 비Hex 문자가 포함된 무효 ID는 폐기하고 신규 32자리 Hex를 발급해야 한다", (t, done) => {
    const invalidShortId = "invalid-short-id";
    const { mockContext, mockNext, resHeaders, getCapturedTrace } =
      createMockContext(invalidShortId);

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: () => {
        const issuedTraceId = resHeaders["X-Trace-Id"];
        assert.notEqual(issuedTraceId, invalidShortId);
        assert.match(issuedTraceId, /^[0-9a-fA-F]{32}$/);
        assert.equal(getCapturedTrace(), issuedTraceId);
        done();
      },
      error: done,
    });
  });

  it("시나리오 3-B: All-Zero(32자리 0) 유입 시 무효 식별자로 간주하여 안전한 신규 ID를 재발급해야 한다", (t, done) => {
    const allZeroId = "00000000000000000000000000000000";
    const { mockContext, mockNext, resHeaders, getCapturedTrace } =
      createMockContext(allZeroId);

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: () => {
        const issuedTraceId = resHeaders["X-Trace-Id"];
        assert.notEqual(issuedTraceId, allZeroId);
        assert.match(issuedTraceId, /^[0-9a-fA-F]{32}$/);
        assert.equal(getCapturedTrace(), issuedTraceId);
        done();
      },
      error: done,
    });
  });

  // 시나리오 4: CORS 노출 헤더 검증
  it("시나리오 4: 브라우저가 X-Trace-Id를 읽을 수 있도록 Access-Control-Expose-Headers에 포함해야 한다", (t, done) => {
    const { mockContext, mockNext, resHeaders } = createMockContext();

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: () => {
        assert.ok(resHeaders["Access-Control-Expose-Headers"]);
        assert.ok(
          resHeaders["Access-Control-Expose-Headers"].includes("X-Trace-Id")
        );
        done();
      },
      error: done,
    });
  });

  // 시나리오 5: 민감 정보 마스킹 유틸리티 검증
  it("시나리오 5: password, token, guestToken 등 민감 필드는 [MASKED]로 안전하게 치환되어야 한다", () => {
    const sensitivePayload = {
      user: {
        name: "홍길동",
        password: "secretPassword123!",
        guestToken: "guest-uuid-token-value",
      },
      auth: {
        accessToken: "jwt-access-token",
        secret: "super-secret-key",
      },
      normalField: "public-content",
    };

    const masked = interceptor.maskSensitiveData(sensitivePayload);

    assert.equal(masked.user.name, "홍길동");
    assert.equal(masked.user.password, "[MASKED]");
    assert.equal(masked.user.guestToken, "[MASKED]");
    assert.equal(masked.auth.accessToken, "[MASKED]");
    assert.equal(masked.auth.secret, "[MASKED]");
    assert.equal(masked.normalField, "public-content");
  });
});

