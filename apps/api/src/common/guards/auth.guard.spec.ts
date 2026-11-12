import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { ExecutionContext, HttpStatus } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { generateKeyPair, SignJWT } from "jose";
import { ERROR_CODES } from "@ideamory/api-spec";
import { AuthGuard, AuthenticatedRequest } from "./auth.guard";
import { BusinessException } from "../exceptions/business.exception";

describe("AuthGuard (jose ES256 오프라인 JWT & 게스트 세션 검증)", () => {
  let authGuard: AuthGuard;
  let reflector: Reflector;
  let validPrivateKey: any;
  let validPublicKey: any;
  let invalidPrivateKey: any;

  const testSupabaseUrl = "https://test.supabase.co";

  before(async () => {
    process.env.SUPABASE_URL = testSupabaseUrl;

    // 1. 테스트용 ES256 (ECC Curve P-256) 비대칭키 쌍 동적 생성
    const validKeyPair = await generateKeyPair("ES256");
    validPrivateKey = validKeyPair.privateKey;
    validPublicKey = validKeyPair.publicKey;

    const invalidKeyPair = await generateKeyPair("ES256");
    invalidPrivateKey = invalidKeyPair.privateKey;

    reflector = new Reflector();
    authGuard = new AuthGuard(reflector);

    // 2. 테스트 환경용 JWKS 리졸버 함수 모킹 (실제 ES256 공개키 검증)
    (authGuard as any).getJWKS = () => {
      return async (protectedHeader: any) => {
        if (protectedHeader.alg !== "ES256") {
          throw new Error("지원하지 않는 알고리즘입니다.");
        }
        return validPublicKey;
      };
    };
  });

  /**
   * Mock ExecutionContext 생성 헬퍼 함수
   */
  function createMockContext(
    headers: Record<string, string | undefined>,
    isPublic: boolean = false
  ): { context: ExecutionContext; request: AuthenticatedRequest } {
    const request: AuthenticatedRequest = {
      headers,
    } as any;

    const context: ExecutionContext = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;

    reflector.getAllAndOverride = () => isPublic;

    return { context, request };
  }

  it("시나리오 1: 정상 서명 및 올바른 iss/aud 클레임을 가진 Supabase Auth ES256 JWT 유입 시 payload.sub가 request.user.id에 바인딩되고 통과해야 한다", async () => {
    const token = await new SignJWT({
      sub: "123e4567-e89b-12d3-a456-426614174000",
      email: "user@ideamory.com",
      role: "authenticated",
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(`${testSupabaseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(validPrivateKey);

    const { context, request } = createMockContext({
      authorization: `Bearer ${token}`,
    });

    const result = await authGuard.canActivate(context);

    assert.equal(result, true);
    assert.ok(request.user);
    assert.equal(request.user.id, "123e4567-e89b-12d3-a456-426614174000");
    assert.equal(request.user.email, "user@ideamory.com");
    assert.equal(request.guestToken, undefined);
  });

  it("시나리오 2-A: 비대칭키 서명이 위변조되었거나 다른 키로 서명된 JWT는 401 AUTH_ALERT_UNAUTHORIZED로 즉시 차단해야 한다", async () => {
    const invalidToken = await new SignJWT({
      sub: "hacker-uuid",
      email: "attacker@fake.com",
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(`${testSupabaseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(invalidPrivateKey);

    const { context } = createMockContext({
      authorization: `Bearer ${invalidToken}`,
    });

    await assert.rejects(
      async () => {
        await authGuard.canActivate(context);
      },
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.UNAUTHORIZED);
        assert.equal(err.errorCode, ERROR_CODES.AUTH_ALERT_UNAUTHORIZED);
        return true;
      }
    );
  });

  it("시나리오 2-B: 유효기간이 만료된 JWT는 401 AUTH_ALERT_UNAUTHORIZED로 즉시 차단해야 한다", async () => {
    const expiredToken = await new SignJWT({
      sub: "expired-user",
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(`${testSupabaseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(validPrivateKey);

    const { context } = createMockContext({
      authorization: `Bearer ${expiredToken}`,
    });

    await assert.rejects(
      async () => {
        await authGuard.canActivate(context);
      },
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.UNAUTHORIZED);
        assert.equal(err.errorCode, ERROR_CODES.AUTH_ALERT_UNAUTHORIZED);
        return true;
      }
    );
  });

  it("시나리오 2-C: audience 클레임이 authenticated가 아닌 비인가 토큰(anon 등)은 401로 차단해야 한다", async () => {
    const anonToken = await new SignJWT({
      sub: "anon-user",
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(`${testSupabaseUrl}/auth/v1`)
      .setAudience("anon") // 👈 authenticated가 아님!
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(validPrivateKey);

    const { context } = createMockContext({
      authorization: `Bearer ${anonToken}`,
    });

    await assert.rejects(
      async () => {
        await authGuard.canActivate(context);
      },
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.UNAUTHORIZED);
        assert.equal(err.errorCode, ERROR_CODES.AUTH_ALERT_UNAUTHORIZED);
        return true;
      }
    );
  });

  it("시나리오 3-A: Authorization 헤더가 없고 유효한 X-Guest-Token(최대 64자)이 존재하면 request.guestToken에 바인딩되고 통과해야 한다", async () => {
    const guestToken = "gst_9f83b2a1c0d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8";
    const { context, request } = createMockContext({
      "x-guest-token": guestToken,
    });

    const result = await authGuard.canActivate(context);

    assert.equal(result, true);
    assert.equal(request.guestToken, guestToken);
    assert.equal(request.user, undefined);
  });

  it("시나리오 3-B: 64자를 초과하는 비정상 게스트 토큰 유입 시 401 AUTH_ALERT_INVALID_GUEST_TOKEN으로 차단해야 한다", async () => {
    const oversizedToken = "g".repeat(65);
    const { context } = createMockContext({
      "x-guest-token": oversizedToken,
    });

    await assert.rejects(
      async () => {
        await authGuard.canActivate(context);
      },
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.UNAUTHORIZED);
        assert.equal(err.errorCode, ERROR_CODES.AUTH_ALERT_INVALID_GUEST_TOKEN);
        return true;
      }
    );
  });

  it("시나리오 4: Authorization 및 X-Guest-Token 헤더가 모두 누락된 비공개 라우트는 401 AUTH_ALERT_UNAUTHORIZED로 차단해야 한다", async () => {
    const { context } = createMockContext({});

    await assert.rejects(
      async () => {
        await authGuard.canActivate(context);
      },
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.UNAUTHORIZED);
        assert.equal(err.errorCode, ERROR_CODES.AUTH_ALERT_UNAUTHORIZED);
        return true;
      }
    );
  });

  it("시나리오 5: @Public() 데코레이터가 적용된 라우트는 인증 헤더가 전혀 없어도 가드를 통과(Bypass)해야 한다", async () => {
    const { context, request } = createMockContext({}, true);

    const result = await authGuard.canActivate(context);

    assert.equal(result, true);
    assert.equal(request.user, undefined);
    assert.equal(request.guestToken, undefined);
  });

  it("시나리오 6: Authorization과 X-Guest-Token이 동시 유입된 경우 소셜 인증이 최우선되며 guestToken은 배제되어 DB 소유권 충돌을 방지해야 한다", async () => {
    const token = await new SignJWT({
      sub: "primary-user-id",
      email: "primary@ideamory.com",
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(`${testSupabaseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(validPrivateKey);

    const { context, request } = createMockContext({
      authorization: `Bearer ${token}`,
      "x-guest-token": "gst_simultaneous_guest_token",
    });

    const result = await authGuard.canActivate(context);

    assert.equal(result, true);
    assert.equal(request.user?.id, "primary-user-id");
    assert.equal(request.guestToken, undefined, "소셜 유저 인증 시 guestToken은 배타적으로 undefined여야 함");
  });

  it("시나리오 7: 만료된 Authorization과 유효한 X-Guest-Token이 동시 유입된 경우 게스트로 조용히 폴백하지 않고 401 에러로 명확히 차단해야 한다", async () => {
    const expiredToken = await new SignJWT({
      sub: "expired-user",
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(`${testSupabaseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(validPrivateKey);

    const { context } = createMockContext({
      authorization: `Bearer ${expiredToken}`,
      "x-guest-token": "gst_valid_guest_token",
    });

    await assert.rejects(
      async () => {
        await authGuard.canActivate(context);
      },
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.UNAUTHORIZED);
        assert.equal(err.errorCode, ERROR_CODES.AUTH_ALERT_UNAUTHORIZED);
        return true;
      }
    );
  });
});
