import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { attachRequestContext } from "../interceptors/request.interceptor";
import {
  ApiClientError,
  extractUxTagFromErrorCode,
  handleErrorResponse,
  handleSuccessResponse,
} from "../interceptors/response.interceptor";
import {
  subscribeApiError,
  type ApiErrorEvent,
} from "../../lib/error-dispatcher";
import {
  clearAllAuthTokens,
  setAccessToken,
  setGuestToken,
} from "../../lib/token-storage";
import {
  ALL_ZERO_TRACE_ID,
  generateTraceId,
  isValidTraceId,
} from "../../lib/trace-id";

/**
 * Node.js 단위 테스트 환경에서 `window.localStorage`를 모의(Mock)하기 위한 인메모리 스토리지
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe("3-1. 공통 REST API 클라이언트 & 에러 인터셉터", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;

  beforeEach(() => {
    const memoryStorage = createMemoryStorage();
    (globalThis as { window?: { localStorage: Storage } }).window = {
      localStorage: memoryStorage,
    };
    clearAllAuthTokens();
  });

  afterEach(() => {
    clearAllAuthTokens();
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });

  it("generateTraceId는 All-Zero가 아닌 유효한 32자리 Hex 식별자를 생성한다", () => {
    const traceId = generateTraceId();
    assert.equal(isValidTraceId(traceId), true);
    assert.notEqual(traceId, ALL_ZERO_TRACE_ID);
    assert.equal(isValidTraceId(ALL_ZERO_TRACE_ID), false);
    assert.equal(isValidTraceId("invalid-trace-id"), false);
  });

  it("요청 인터셉터는 X-Trace-Id를 주입하고 소셜 JWT가 있으면 X-Guest-Token을 배타적으로 제거한다", () => {
    setGuestToken("gst_dummy_token");
    setAccessToken("jwt_social_token");

    const config: InternalAxiosRequestConfig = {
      headers: new AxiosHeaders({
        "X-Guest-Token": "stale_guest_token",
      }),
    };

    const updated = attachRequestContext(config);
    const traceId = updated.headers.get("X-Trace-Id");

    assert.equal(typeof traceId, "string");
    assert.equal(isValidTraceId(String(traceId)), true);
    assert.equal(updated.headers.get("Authorization"), "Bearer jwt_social_token");
    assert.equal(updated.headers.get("X-Guest-Token"), undefined);
  });

  it("요청 인터셉터는 소셜 JWT가 없을 때만 X-Guest-Token을 주입한다", () => {
    setGuestToken("gst_only_token");

    const config: InternalAxiosRequestConfig = {
      headers: new AxiosHeaders({
        Authorization: "Bearer stale_jwt",
      }),
    };

    const updated = attachRequestContext(config);

    assert.equal(updated.headers.get("X-Guest-Token"), "gst_only_token");
    assert.equal(updated.headers.get("Authorization"), undefined);
  });

  it("응답 성공 인터셉터는 204 No Content의 빈 본문을 빈 객체({})로 정규화한다", () => {
    const response = {
      status: 204,
      statusText: "No Content",
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: "",
    } as AxiosResponse;

    const normalized = handleSuccessResponse(response);
    assert.deepEqual(normalized.data, {});
  });

  it("FIELD UX 태그 에러는 전역 디스패처로 발행하지 않고 호출부로 reject 전파한다", async () => {
    const dispatched: ApiErrorEvent[] = [];
    const unsubscribe = subscribeApiError((event) => {
      dispatched.push(event);
    });

    const traceId = generateTraceId();
    const axiosError = new AxiosError(
      "Request failed with status code 400",
      "ERR_BAD_REQUEST",
      { headers: new AxiosHeaders({ "X-Trace-Id": traceId }) },
      undefined,
      {
        status: 400,
        statusText: "Bad Request",
        headers: { "x-trace-id": traceId },
        config: { headers: new AxiosHeaders() },
        data: {
          statusCode: 400,
          errorCode: "MEMO_FIELD_REQUIRED",
          message: "메모 본문을 입력해 주세요.",
          traceId,
          timestamp: "2026-11-15T12:00:00.000Z",
        },
      }
    );

    try {
      await assert.rejects(
        () => handleErrorResponse(axiosError),
        (err: unknown) => {
          assert.ok(err instanceof ApiClientError);
          assert.equal(err.uxTag, "FIELD");
          assert.equal(err.errorCode, "MEMO_FIELD_REQUIRED");
          assert.equal(err.traceId, traceId);
          return true;
        }
      );
      assert.equal(dispatched.length, 0);
    } finally {
      unsubscribe();
    }
  });

  it("ALERT/WARN/FATAL UX 태그 에러는 전역 디스패처로 이벤트를 발행한다", async () => {
    const dispatched: ApiErrorEvent[] = [];
    const unsubscribe = subscribeApiError((event) => {
      dispatched.push(event);
    });

    const traceId = generateTraceId();
    const axiosError = new AxiosError(
      "Unauthorized",
      "ERR_BAD_REQUEST",
      { headers: new AxiosHeaders({ "X-Trace-Id": traceId }) },
      undefined,
      {
        status: 401,
        statusText: "Unauthorized",
        headers: { "x-trace-id": traceId },
        config: { headers: new AxiosHeaders() },
        data: {
          statusCode: 401,
          errorCode: "AUTH_ALERT_UNAUTHORIZED",
          message: "인증이 필요합니다.",
          traceId,
          timestamp: "2026-11-15T12:00:00.000Z",
        },
      }
    );

    try {
      await assert.rejects(() => handleErrorResponse(axiosError));
      assert.equal(dispatched.length, 1);
      assert.equal(dispatched[0]?.uxTag, "ALERT");
      assert.equal(dispatched[0]?.errorCode, "AUTH_ALERT_UNAUTHORIZED");
      assert.equal(dispatched[0]?.traceId, traceId);
      assert.equal(extractUxTagFromErrorCode("SYSTEM_FATAL_DB_ERROR"), "FATAL");
      assert.equal(extractUxTagFromErrorCode("UNKNOWN_FORMAT"), "ERROR");
    } finally {
      unsubscribe();
    }
  });
});
