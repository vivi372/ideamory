import { describe, it, afterEach, mock } from "node:test";
import * as assert from "node:assert/strict";
import { Logger } from "@nestjs/common";
import { traceStore } from "./trace-store";
import { safeStringifyForLog } from "../utils/log-sanitizer.util";
import { LogTrace } from "../decorators/log-trace.decorator";
import { SentryNestLogger, type SentryLogSink } from "./sentry-nest.logger";
import { AppDrizzleLogger } from "../../database/drizzle.logger";

describe("Observability Logging AOP & Sanitizer", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  describe("safeStringifyForLog", () => {
    it("민감한 키를 대소문자 구분 없이 [MASKED]로 치환해야 한다", () => {
      const payload = {
        userId: "user-123",
        password: "secret-password",
        guestToken: "gst_abc",
        accessToken: "jwt-access",
        refreshToken: "jwt-refresh",
        idToken: "oidc-id",
        Authorization: "Bearer token",
        clientSecret: "top-secret",
      };

      const parsed = JSON.parse(safeStringifyForLog(payload)) as Record<
        string,
        unknown
      >;

      assert.equal(parsed.userId, "user-123");
      assert.equal(parsed.password, "[MASKED]");
      assert.equal(parsed.guestToken, "[MASKED]");
      assert.equal(parsed.accessToken, "[MASKED]");
      assert.equal(parsed.refreshToken, "[MASKED]");
      assert.equal(parsed.idToken, "[MASKED]");
      assert.equal(parsed.Authorization, "[MASKED]");
      assert.equal(parsed.clientSecret, "[MASKED]");
    });

    it("객체 키가 없는 위치의 게스트 토큰(gst_*), Bearer 토큰, JWT 문자열도 [MASKED]로 치환해야 한다", () => {
      const output = safeStringifyForLog([
        "gst_ed6ab08df60b7a0f1c123456",
        "Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig",
        "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature123",
        "일반 메모 본문",
      ]);

      assert.equal(
        output,
        '["[MASKED]","[MASKED]","[MASKED]","일반 메모 본문"]'
      );
    });

    it("768차원 임베딩 벡터 배열을 [vector(768)]로 축약해야 한다", () => {
      const embedding = Array.from({ length: 768 }, (_, i) => i * 0.001);
      const output = safeStringifyForLog({ embedding });
      assert.equal(output, '{"embedding":"[vector(768)]"}');
    });

    it("500자를 초과하는 긴 문자열은 500자 이후를 ...(truncated)로 절삭해야 한다", () => {
      const longText = "a".repeat(520);
      const parsed = JSON.parse(safeStringifyForLog({ text: longText })) as {
        text: string;
      };
      assert.equal(parsed.text, `${"a".repeat(500)}...(truncated)`);
    });

    it("순환 참조 객체를 안전하게 [Circular]로 직렬화해야 한다", () => {
      const circular: Record<string, unknown> = { name: "node" };
      circular.self = circular;

      const parsed = JSON.parse(safeStringifyForLog(circular)) as {
        name: string;
        self: string;
      };
      assert.equal(parsed.name, "node");
      assert.equal(parsed.self, "[Circular]");
    });

    it("직렬화 중 예외가 발생해도 [SerializationError]를 반환하고 예외를 던지지 않아야 한다", () => {
      const brokenObj = {};
      Object.defineProperty(brokenObj, "boom", {
        enumerable: true,
        get() {
          throw new Error("getter exploded");
        },
      });

      assert.equal(safeStringifyForLog(brokenObj), "[SerializationError]");
    });
  });

  describe("@LogTrace()", () => {
    class SampleService {
      @LogTrace()
      async greet(input: { name: string; guestToken: string }) {
        return { message: `Hello ${input.name}` };
      }

      @LogTrace({ logArgs: false, logResult: false })
      async silentMethod(secretArg: string) {
        return { secretResult: secretArg };
      }

      @LogTrace()
      async failMethod(id: string) {
        throw new Error(`boom-${id}`);
      }
    }

    it("AsyncLocalStorage Trace ID 앞 8자리와 함께 [ENTRY]/[EXIT] 로그를 남겨야 한다", async () => {
      const logMessages: string[] = [];
      mock.method(Logger.prototype, "log", (message: string) => {
        logMessages.push(message);
      });

      const service = new SampleService();
      const traceId = "abcdef1234567890abcdef1234567890";

      const result = await traceStore.run(traceId, () =>
        service.greet({ name: "Alice", guestToken: "gst_secret" })
      );

      assert.deepEqual(result, { message: "Hello Alice" });
      assert.equal(logMessages.length, 2);
      assert.match(
        logMessages[0] ?? "",
        /\[abcdef12\] \[SampleService\.greet\] \[ENTRY\] args: \[\{"name":"Alice","guestToken":"\[MASKED\]"\}\]/
      );
      assert.match(
        logMessages[1] ?? "",
        /\[abcdef12\] \[SampleService\.greet\] \[EXIT\] elapsed: .* result: \{"message":"Hello Alice"\}/
      );
    });

    it("logArgs/logResult 옵션이 false면 인자와 반환값을 [omitted]로 출력해야 한다", async () => {
      const logMessages: string[] = [];
      mock.method(Logger.prototype, "log", (message: string) => {
        logMessages.push(message);
      });

      const service = new SampleService();
      await service.silentMethod("hidden");

      assert.equal(logMessages.length, 2);
      assert.ok(logMessages[0]?.includes("[ENTRY] args: [omitted]"));
      assert.ok(logMessages[1]?.includes("result: [omitted]"));
    });

    it("메서드가 예외를 던지면 [ERROR] 로그를 남기고 원본 예외를 재전파해야 한다", async () => {
      const logMessages: string[] = [];
      const errorMessages: string[] = [];
      mock.method(Logger.prototype, "log", (message: string) => {
        logMessages.push(message);
      });
      mock.method(Logger.prototype, "error", (message: string) => {
        errorMessages.push(message);
      });

      const service = new SampleService();
      const traceId = "11223344556677889900aabbccddeeff";

      await assert.rejects(
        () => traceStore.run(traceId, () => service.failMethod("42")),
        /boom-42/
      );

      assert.equal(logMessages.length, 1);
      assert.equal(errorMessages.length, 1);
      assert.ok(
        errorMessages[0]?.includes(
          "[11223344] [SampleService.failMethod] [ERROR] elapsed:"
        )
      );
      assert.ok(errorMessages[0]?.includes('error: "Error: boom-42"'));
    });
  });

  describe("AppDrizzleLogger", () => {
    it("원시 SQL과 마스킹된 파라미터 및 8자리 Trace ID를 출력해야 한다", () => {
      const logMessages: string[] = [];
      mock.method(Logger.prototype, "log", (message: string) => {
        logMessages.push(message);
      });

      const drizzleLogger = new AppDrizzleLogger();
      const traceId = "deadbeef1234567890abcdef12345678";
      const vector768 = Array.from({ length: 768 }, () => 0.5);

      traceStore.run(traceId, () => {
        drizzleLogger.logQuery(
          "SELECT *  FROM memos\n WHERE guest_token = $1",
          ["gst_secret", vector768]
        );
      });

      assert.equal(logMessages.length, 1);
      assert.equal(
        logMessages[0],
        '[deadbeef] [Drizzle:Query] SQL: SELECT * FROM memos WHERE guest_token = $1 | PARAMS: ["[MASKED]","[vector(768)]"]'
      );
    });
  });

  describe("SentryNestLogger", () => {
    it("Sentry가 초기화된 경우 터미널 로그를 Sentry.logger 및 Breadcrumb으로 미러링해야 한다", () => {
      const capturedLogs: Array<{
        level: string;
        msg: string;
        attrs: Record<string, string>;
      }> = [];
      const capturedBreadcrumbs: unknown[] = [];

      mock.method(process.stdout, "write", () => true);
      const fakeSink: SentryLogSink = {
        isInitialized: () => true,
        log: (level, msg, attrs) => {
          capturedLogs.push({ level, msg, attrs });
        },
        addBreadcrumb: (crumb) => {
          capturedBreadcrumbs.push(crumb);
        },
      };

      const nestLogger = new SentryNestLogger(fakeSink);
      const traceId = "cafebabe1234567890abcdef12345678";

      traceStore.run(traceId, () => {
        nestLogger.log(
          "[cafebabe] [MemoService.createMemo] [ENTRY] args: []",
          "LogTrace"
        );
      });

      assert.equal(capturedLogs.length, 1);
      assert.equal(capturedLogs[0]?.level, "info");
      assert.equal(
        capturedLogs[0]?.msg,
        "[LogTrace] [cafebabe] [MemoService.createMemo] [ENTRY] args: []"
      );
      assert.deepEqual(capturedLogs[0]?.attrs, {
        context: "LogTrace",
        trace_id: traceId,
      });
      assert.equal(capturedBreadcrumbs.length, 1);
    });
  });
});
