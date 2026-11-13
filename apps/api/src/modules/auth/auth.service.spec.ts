import { describe, it, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { HttpStatus } from "@nestjs/common";
import { generateKeyPair, SignJWT } from "jose";
import { ERROR_CODES, GUEST_TOKEN_MAX_LENGTH } from "@ideamory/api-spec";
import { AuthService } from "./auth.service";
import { AuthRepository } from "./auth.repository";
import { BusinessException } from "../../common/exceptions/business.exception";

describe("AuthService (트랜잭션 경계, 비즈니스 오케스트레이션 및 jose 검증)", () => {
  let authService: AuthService;
  let opOrder: string[];
  let mockRepoCalls: Record<string, any[]>;
  let mockExistingOgp: { id: string } | null;
  let mockGuestCategories: Array<{ id: string; normalizedName: string }>;
  let mockUserCategories: Array<{ id: string; normalizedName: string }>;
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

    const mockTx: any = { isMockTx: true };

    const mockRepository: Partial<AuthRepository> = {
      withTransaction: async (callback) => {
        opOrder.push("withTransaction:start");
        const result = await callback(mockTx);
        opOrder.push("withTransaction:end");
        return result;
      },
      findOgpCacheByTargetUrl: async (targetUrl, tx) => {
        opOrder.push("findOgpCacheByTargetUrl");
        mockRepoCalls.findOgpCacheByTargetUrl.push({ targetUrl, tx });
        return mockExistingOgp;
      },
      insertOgpCache: async (params, tx) => {
        opOrder.push("insertOgpCache");
        mockRepoCalls.insertOgpCache.push({ params, tx });
      },
      insertCategory: async (params, tx) => {
        opOrder.push("insertCategory");
        mockRepoCalls.insertCategory.push({ params, tx });
      },
      insertMemo: async (params, tx) => {
        opOrder.push("insertMemo");
        mockRepoCalls.insertMemo.push({ params, tx });
      },
      deleteMemosByGuestToken: async (guestToken, tx) => {
        opOrder.push("deleteMemosByGuestToken");
        mockRepoCalls.deleteMemosByGuestToken.push({ guestToken, tx });
      },
      deleteCategoriesByGuestToken: async (guestToken, tx) => {
        opOrder.push("deleteCategoriesByGuestToken");
        mockRepoCalls.deleteCategoriesByGuestToken.push({ guestToken, tx });
      },
      findCategoriesByGuestToken: async (guestToken, tx) => {
        opOrder.push("findCategoriesByGuestToken");
        mockRepoCalls.findCategoriesByGuestToken.push({ guestToken, tx });
        return mockGuestCategories;
      },
      findCategoriesByUserId: async (userId, tx) => {
        opOrder.push("findCategoriesByUserId");
        mockRepoCalls.findCategoriesByUserId.push({ userId, tx });
        return mockUserCategories;
      },
      reassignMemosCategory: async (guestToken, fromId, toId, tx) => {
        opOrder.push("reassignMemosCategory");
        mockRepoCalls.reassignMemosCategory.push({
          guestToken,
          fromId,
          toId,
          tx,
        });
      },
      deleteCategoriesByIds: async (ids, tx) => {
        opOrder.push("deleteCategoriesByIds");
        mockRepoCalls.deleteCategoriesByIds.push({ ids, tx });
      },
      transferCategoriesToUser: async (guestToken, userId, tx) => {
        opOrder.push("transferCategoriesToUser");
        mockRepoCalls.transferCategoriesToUser.push({ guestToken, userId, tx });
      },
      transferMemosToUser: async (guestToken, userId, tx) => {
        opOrder.push("transferMemosToUser");
        mockRepoCalls.transferMemosToUser.push({ guestToken, userId, tx });
      },
      deleteMemosByUserId: async (userId, tx) => {
        opOrder.push("deleteMemosByUserId");
        mockRepoCalls.deleteMemosByUserId.push({ userId, tx });
      },
      deleteCategoriesByUserId: async (userId, tx) => {
        opOrder.push("deleteCategoriesByUserId");
        mockRepoCalls.deleteCategoriesByUserId.push({ userId, tx });
      },
      deleteAuthUserById: async (userId, tx) => {
        opOrder.push("deleteAuthUserById");
        mockRepoCalls.deleteAuthUserById.push({ userId, tx });
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

  beforeEach(() => {
    opOrder = [];
    mockExistingOgp = null;
    mockGuestCategories = [];
    mockUserCategories = [];
    mockRepoCalls = {
      findOgpCacheByTargetUrl: [],
      insertOgpCache: [],
      insertCategory: [],
      insertMemo: [],
      deleteMemosByGuestToken: [],
      deleteCategoriesByGuestToken: [],
      findCategoriesByGuestToken: [],
      findCategoriesByUserId: [],
      reassignMemosCategory: [],
      deleteCategoriesByIds: [],
      transferCategoriesToUser: [],
      transferMemosToUser: [],
      deleteMemosByUserId: [],
      deleteCategoriesByUserId: [],
      deleteAuthUserById: [],
    };
  });

  it("시나리오 1: initGuestSession은 52자 gst_ 토큰(상한 64자 준수)을 발급하고 단일 트랜잭션 내 OGP ➔ 카테고리 ➔ 시드 메모 순으로 생성해야 한다", async () => {
    const memoId = "018d0000-0000-7000-8000-000000000001";
    const categoryId = "018d0000-0000-7000-8000-000000000002";

    const result = await authService.initGuestSession({ memoId, categoryId });

    assert.match(result.guestToken, /^gst_[0-9a-f]{48}$/);
    assert.ok(result.guestToken.length <= GUEST_TOKEN_MAX_LENGTH);
    assert.equal(result.seedMemoId, memoId);

    assert.deepEqual(opOrder, [
      "withTransaction:start",
      "findOgpCacheByTargetUrl",
      "insertOgpCache",
      "insertCategory",
      "insertMemo",
      "withTransaction:end",
    ]);

    const ogpCall = mockRepoCalls.insertOgpCache[0];
    assert.equal(ogpCall.params.targetUrl, "https://ideamory.app/guide");
    const diffYears =
      ogpCall.params.expiresAt.getFullYear() - new Date().getFullYear();
    assert.ok(diffYears >= 99 && diffYears <= 101);
  });

  it("시나리오 2-A: resetGuestData는 외래키 RESTRICT 준수를 위해 단일 트랜잭션 내에서 memos ➔ categories 순으로 삭제해야 한다", async () => {
    const guestToken = "gst_reset_target_token";
    const result = await authService.resetGuestData(guestToken);

    assert.equal(result.success, true);
    assert.deepEqual(opOrder, [
      "withTransaction:start",
      "deleteMemosByGuestToken",
      "deleteCategoriesByGuestToken",
      "withTransaction:end",
    ]);
    assert.equal(
      mockRepoCalls.deleteMemosByGuestToken[0].guestToken,
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

  it("시나리오 3-A: linkSocialAccount는 ES256 idToken 검증 후 중복 normalizedName 카테고리를 병합하고 소유권을 이관해야 한다", async () => {
    const targetUserId = "999e4567-e89b-12d3-a456-426614174999";
    mockGuestCategories = [
      { id: "guest-cat-dup", normalizedName: "개발" },
      { id: "guest-cat-uniq", normalizedName: "일기" },
    ];
    mockUserCategories = [{ id: "user-cat-dup", normalizedName: "개발" }];

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

    const result = await authService.linkSocialAccount("gst_guest_123", {
      provider: "google",
      idToken: validIdToken,
    });

    assert.equal(result.success, true);
    assert.equal(result.userId, targetUserId);
    assert.deepEqual(opOrder, [
      "withTransaction:start",
      "findCategoriesByGuestToken",
      "findCategoriesByUserId",
      "reassignMemosCategory",
      "deleteCategoriesByIds",
      "transferCategoriesToUser",
      "transferMemosToUser",
      "withTransaction:end",
    ]);
    assert.deepEqual(mockRepoCalls.reassignMemosCategory[0], {
      guestToken: "gst_guest_123",
      fromId: "guest-cat-dup",
      toId: "user-cat-dup",
      tx: { isMockTx: true },
    });
    assert.deepEqual(mockRepoCalls.deleteCategoriesByIds[0].ids, [
      "guest-cat-dup",
    ]);
  });

  it("시나리오 3-B: linkSocialAccount 호출 시 위변조된 idToken이 전달되면 401 AUTH_ALERT_UNAUTHORIZED 예외로 차단해야 한다", async () => {
    const forgedToken = await new SignJWT({
      sub: "999e4567-e89b-12d3-a456-426614174999",
    })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(`${testSupabaseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(invalidPrivateKey);

    await assert.rejects(
      async () => {
        await authService.linkSocialAccount("gst_guest_123", {
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
  });

  it("시나리오 3-C: linkSocialAccount 호출 시 sub 클레임이 누락된 idToken은 401 AUTH_ALERT_INVALID_PAYLOAD 예외로 차단해야 한다", async () => {
    const noSubToken = await new SignJWT({ email: "nosub@ideamory.com" })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(`${testSupabaseUrl}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(validPrivateKey);

    await assert.rejects(
      async () => {
        await authService.linkSocialAccount("gst_guest_123", {
          provider: "google",
          idToken: noSubToken,
        });
      },
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.UNAUTHORIZED);
        assert.equal(err.errorCode, ERROR_CODES.AUTH_ALERT_INVALID_PAYLOAD);
        return true;
      }
    );
  });

  it("시나리오 4: deleteAccount는 단일 트랜잭션 내에서 memos ➔ categories ➔ authUsers 순으로 영구 삭제해야 한다", async () => {
    const userId = "888e4567-e89b-12d3-a456-426614174888";
    const result = await authService.deleteAccount(userId);

    assert.equal(result.success, true);
    assert.deepEqual(opOrder, [
      "withTransaction:start",
      "deleteMemosByUserId",
      "deleteCategoriesByUserId",
      "deleteAuthUserById",
      "withTransaction:end",
    ]);
    assert.equal(mockRepoCalls.deleteAuthUserById[0].userId, userId);
  });
});
