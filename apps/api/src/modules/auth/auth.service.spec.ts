import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { HttpStatus } from "@nestjs/common";
import { generateKeyPair, SignJWT } from "jose";
import { ERROR_CODES } from "@ideamory/api-spec";
import { AuthService } from "./auth.service";
import { AuthRepository } from "./auth.repository";
import { BusinessException } from "../../common/exceptions/business.exception";

describe("AuthService (세션 & 유저 데이터 라이프사이클 비즈니스 로직 검증)", () => {
  let authService: AuthService;
  let mockRepoCalls: Record<string, any[]>;
  let validPrivateKey: any;
  let validPublicKey: any;
  let invalidPrivateKey: any;

  const testSupabaseUrl = "https://test.supabase.co";

  before(async () => {
    process.env.SUPABASE_URL = testSupabaseUrl;
    process.env.APP_URL = "https://ideamory.app";

    const validKeyPair = await generateKeyPair("ES256");
    validPrivateKey = validKeyPair.privateKey;
    validPublicKey = validKeyPair.publicKey;

    const invalidKeyPair = await generateKeyPair("ES256");
    invalidPrivateKey = invalidKeyPair.privateKey;

    mockRepoCalls = {
      createGuestSessionWithSeed: [],
      resetGuestData: [],
      migrateGuestToSocialAccount: [],
      deleteSocialAccountData: [],
    };

    const mockRepository: Partial<AuthRepository> = {
      createGuestSessionWithSeed: async (params) => {
        mockRepoCalls.createGuestSessionWithSeed.push(params);
        return params.memoId;
      },
      resetGuestData: async (guestToken) => {
        mockRepoCalls.resetGuestData.push(guestToken);
      },
      migrateGuestToSocialAccount: async (params) => {
        mockRepoCalls.migrateGuestToSocialAccount.push(params);
      },
      deleteSocialAccountData: async (userId) => {
        mockRepoCalls.deleteSocialAccountData.push(userId);
      },
    };

    authService = new AuthService(mockRepository as AuthRepository);

    // 테스트 환경용 ES256 공개키 JWKS 리졸버 모킹
    (authService as any).getJWKS = () => {
      return async (protectedHeader: any) => {
        if (protectedHeader.alg !== "ES256") {
          throw new Error("지원하지 않는 알고리즘입니다.");
        }
        return validPublicKey;
      };
    };
  });

  it("시나리오 1: initGuestSession 호출 시 gst_ 프리픽스(64자 이내) 토큰과 동적 guideUrl 기반 시드 메모를 생성해야 한다", async () => {
    const memoId = "018d0000-0000-7000-8000-000000000001";
    const categoryId = "018d0000-0000-7000-8000-000000000002";

    const result = await authService.initGuestSession({ memoId, categoryId });

    assert.match(result.guestToken, /^gst_[0-9a-f]{48}$/);
    assert.ok(result.guestToken.length <= 64);
    assert.equal(result.seedMemoId, memoId);

    const lastCall =
      mockRepoCalls.createGuestSessionWithSeed[
        mockRepoCalls.createGuestSessionWithSeed.length - 1
      ];
    assert.equal(lastCall.guideUrl, "https://ideamory.app/guide");
    assert.ok(lastCall.guideContent.includes("https://ideamory.app/guide"));
    assert.equal(lastCall.categoryId, categoryId);
  });

  it("시나리오 2-A: resetGuestData 호출 시 유효한 guestToken이 전달되면 초기화 트랜잭션을 호출하고 성공 응답을 반환해야 한다", async () => {
    const guestToken = "gst_reset_target_token";
    const result = await authService.resetGuestData(guestToken);

    assert.equal(result.success, true);
    assert.equal(result.message, "게스트 데이터가 초기화되었습니다.");
    assert.equal(
      mockRepoCalls.resetGuestData[mockRepoCalls.resetGuestData.length - 1],
      guestToken
    );
  });

  it("시나리오 2-B: resetGuestData 호출 시 guestToken이 누락되면 401 AUTH_ALERT_UNAUTHORIZED 예외를 발생시켜야 한다", async () => {
    await assert.rejects(
      async () => {
        await authService.resetGuestData(undefined);
      },
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.UNAUTHORIZED);
        assert.equal(err.errorCode, ERROR_CODES.AUTH_ALERT_UNAUTHORIZED);
        return true;
      }
    );
  });

  it("시나리오 3-A: linkSocialAccount 호출 시 유효한 ES256 idToken을 검증해 userId를 추출하고 게스트 데이터 이관을 수행해야 한다", async () => {
    const targetUserId = "999e4567-e89b-12d3-a456-426614174999";
    const validIdToken = await new SignJWT({
      sub: targetUserId,
      email: "social@ideamory.com",
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(`${testSupabaseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(validPrivateKey);

    const guestToken = "gst_to_be_migrated";
    const result = await authService.linkSocialAccount(guestToken, {
      provider: "kakao",
      idToken: validIdToken,
    });

    assert.equal(result.success, true);
    assert.equal(result.userId, targetUserId);

    const lastCall =
      mockRepoCalls.migrateGuestToSocialAccount[
        mockRepoCalls.migrateGuestToSocialAccount.length - 1
      ];
    assert.equal(lastCall.guestToken, guestToken);
    assert.equal(lastCall.targetUserId, targetUserId);
  });

  it("시나리오 3-B: linkSocialAccount 호출 시 위변조된 idToken이 전달되면 401 예외로 차단하고 이관 트랜잭션을 실행하지 않아야 한다", async () => {
    const prevCount = mockRepoCalls.migrateGuestToSocialAccount.length;

    const forgedToken = await new SignJWT({
      sub: "hacker-id",
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(`${testSupabaseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(invalidPrivateKey);

    await assert.rejects(
      async () => {
        await authService.linkSocialAccount("gst_valid", {
          provider: "google",
          idToken: forgedToken,
        });
      },
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.UNAUTHORIZED);
        assert.equal(err.errorCode, ERROR_CODES.AUTH_ALERT_UNAUTHORIZED);
        return true;
      }
    );

    assert.equal(mockRepoCalls.migrateGuestToSocialAccount.length, prevCount);
  });

  it("시나리오 4-A: deleteAccount 호출 시 유효한 userId가 전달되면 Hard Delete 트랜잭션을 실행하고 완료 메시지를 반환해야 한다", async () => {
    const userId = "user-to-delete-uuid";
    const result = await authService.deleteAccount(userId);

    assert.equal(result.success, true);
    assert.equal(result.message, "회원 탈퇴 및 모든 데이터 삭제가 완료되었습니다.");
    assert.equal(
      mockRepoCalls.deleteSocialAccountData[
        mockRepoCalls.deleteSocialAccountData.length - 1
      ],
      userId
    );
  });

  it("시나리오 4-B: deleteAccount 호출 시 userId가 누락되면(게스트 등) 401 AUTH_ALERT_UNAUTHORIZED로 차단해야 한다", async () => {
    await assert.rejects(
      async () => {
        await authService.deleteAccount(undefined);
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

