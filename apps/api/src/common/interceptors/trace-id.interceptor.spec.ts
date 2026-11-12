import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of } from "rxjs";
import { TraceIdInterceptor } from "./trace-id.interceptor";
import { getTraceId } from "../logging/trace-store";

/**
 * W3C 32자리 분산 트레이싱 및 CORS 노출 인터셉터 단위 테스트
 * 검증 대상: Trace ID 상속, All-Zero 방어, 신규 자동 발급, CORS Expose 토큰 정규화,
 * AsyncLocalStorage 스코프 전파, 민감정보 마스킹(순환 참조, 특수 객체, Max Depth 방어)
 */
describe("TraceIdInterceptor 단위 검증", () => {
  const interceptor = new TraceIdInterceptor();

  /**
   * Mock ExecutionContext 및 CallHandler 생성 헬퍼
   */
  function createMockContext(
    rawTraceId?: string,
    initialExposeHeader?: string | string[]
  ) {
    const reqHeaders: Record<string, string | undefined> = {};
    if (rawTraceId !== undefined) {
      reqHeaders["x-trace-id"] = rawTraceId;
    }

    const resHeaders: Record<string, any> = {};
    if (initialExposeHeader !== undefined) {
      resHeaders["Access-Control-Expose-Headers"] = initialExposeHeader;
    }

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
        assert.equal(mockReq.headers["x-trace-id"], validTraceId);
        assert.equal(resHeaders["X-Trace-Id"], validTraceId);
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
        assert.match(issuedTraceId, /^[0-9a-fA-F]{32}$/);
        assert.equal(mockReq.headers["x-trace-id"], issuedTraceId);
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

  // 시나리오 4: CORS 노출 헤더 검증 (소문자/배열/부분일치 엣지 케이스 포함)
  it("시나리오 4-A: 최초 등록 시 Access-Control-Expose-Headers에 X-Trace-Id를 설정해야 한다", (t, done) => {
    const { mockContext, mockNext, resHeaders } = createMockContext();

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: () => {
        assert.equal(resHeaders["Access-Control-Expose-Headers"], "X-Trace-Id");
        done();
      },
      error: done,
    });
  });

  it("시나리오 4-B: 이미 소문자 x-trace-id가 등록되어 있는 경우 중복 추가되지 않아야 한다", (t, done) => {
    const { mockContext, mockNext, resHeaders } = createMockContext(
      undefined,
      "Content-Range, x-trace-id"
    );

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: () => {
        const exposeHeader = resHeaders["Access-Control-Expose-Headers"];
        assert.equal(exposeHeader, "Content-Range, x-trace-id");
        // 중복 추가(x-trace-id, X-Trace-Id)가 없음을 검증
        const matches = exposeHeader.match(/x-trace-id/gi);
        assert.equal(matches?.length, 1);
        done();
      },
      error: done,
    });
  });

  it("시나리오 4-C: X-Trace-Id-Context 같은 부분 일치 헤더가 있어도 실제 X-Trace-Id가 누락되지 않고 추가되어야 한다", (t, done) => {
    const { mockContext, mockNext, resHeaders } = createMockContext(
      undefined,
      "X-Trace-Id-Context"
    );

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: () => {
        const exposeHeader = resHeaders["Access-Control-Expose-Headers"];
        assert.equal(exposeHeader, "X-Trace-Id-Context, X-Trace-Id");
        done();
      },
      error: done,
    });
  });

  it("시나리오 4-D: 기존 헤더가 배열(string[]) 형태로 등록되어 있어도 정상 병합되어야 한다", (t, done) => {
    const { mockContext, mockNext, resHeaders } = createMockContext(
      undefined,
      ["Content-Length", "Accept-Ranges"]
    );

    interceptor.intercept(mockContext, mockNext).subscribe({
      next: () => {
        const exposeHeader = resHeaders["Access-Control-Expose-Headers"];
        assert.equal(
          exposeHeader,
          "Content-Length, Accept-Ranges, X-Trace-Id"
        );
        done();
      },
      error: done,
    });
  });

  // 시나리오 5: 민감 정보 마스킹 및 엣지 케이스(순환 참조, 특수 객체, Max Depth) 검증
  it("시나리오 5-A: 다중 중첩 객체 및 배열 내부의 password, token, guestToken은 [MASKED]로 치환되어야 한다", () => {
    const complexPayload = {
      user: {
        name: "홍길동",
        authList: [
          { token: "sub-token-1", secret: "sub-secret-1" },
          { token: "sub-token-2", normal: "valid-info" },
        ],
        credentials: {
          password: "myPassword123!",
          guestToken: "guest-uuid-1234",
        },
      },
      publicData: "open",
    };

    const masked = interceptor.maskSensitiveData(complexPayload);

    assert.equal(masked.user.authList[0].token, "[MASKED]");
    assert.equal(masked.user.authList[0].secret, "[MASKED]");
    assert.equal(masked.user.authList[1].normal, "valid-info");
    assert.equal(masked.user.credentials.password, "[MASKED]");
    assert.equal(masked.user.credentials.guestToken, "[MASKED]");
    assert.equal(masked.publicData, "open");
  });

  it("시나리오 5-B: 순환 참조(Circular Reference) 객체 유입 시 스택 오버플로 없이 [CIRCULAR]로 안전하게 방어해야 한다", () => {
    const circularObj: any = {
      name: "node-a",
      token: "secret-token",
    };
    circularObj.self = circularObj; // 자기 참조 순환 구조 생성

    const masked = interceptor.maskSensitiveData(circularObj);

    assert.equal(masked.name, "node-a");
    assert.equal(masked.token, "[MASKED]");
    assert.equal(masked.self, "[CIRCULAR]"); // 순환 참조 끊김 검증
  });

  it("시나리오 5-C: Date 및 RegExp 등 특수 객체는 분해되지 않고 원형을 보존해야 한다", () => {
    const testDate = new Date("2026-11-12T18:00:00Z");
    const testRegex = /^[a-z]+$/i;
    const payload = {
      createdAt: testDate,
      pattern: testRegex,
      password: "secretPassword",
    };

    const masked = interceptor.maskSensitiveData(payload);

    assert.equal(masked.createdAt, testDate);
    assert.equal(masked.pattern, testRegex);
    assert.equal(masked.password, "[MASKED]");
  });

  it("시나리오 5-D: 10-Depth를 초과하는 과도한 중첩 객체 유입 시 [MAX_DEPTH_EXCEEDED]로 DoS를 방어해야 한다", () => {
    // 15-Depth 중첩 객체 생성
    let deepObj: any = { value: "deepest" };
    for (let i = 0; i < 15; i++) {
      deepObj = { next: deepObj };
    }

    const masked = interceptor.maskSensitiveData(deepObj);

    let current = masked;
    for (let i = 0; i < 11; i++) {
      current = current.next;
    }
    assert.equal(current, "[MAX_DEPTH_EXCEEDED]");
  });
});
