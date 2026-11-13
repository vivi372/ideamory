import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { HttpStatus } from "@nestjs/common";
import { GuestInitSchema, LinkSocialAuthSchema, ERROR_CODES } from "@ideamory/api-spec";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { BusinessException } from "../../common/exceptions/business.exception";

describe("AuthController (엔드포인트 위임 및 DTO 유효성 검증)", () => {
  let controller: AuthController;
  let serviceCalls: Record<string, any[]>;

  beforeEach(() => {
    serviceCalls = {
      initGuestSession: [],
      resetGuestData: [],
      linkSocialAccount: [],
      deleteAccount: [],
    };

    const mockService: Partial<AuthService> = {
      initGuestSession: async (dto) => {
        serviceCalls.initGuestSession.push(dto);
        return {
          guestToken: "gst_mocked_token_1234",
          seedMemoId: dto.memoId,
        };
      },
      resetGuestData: async (guestToken) => {
        serviceCalls.resetGuestData.push(guestToken);
        return {
          success: true,
          message: "게스트 데이터가 초기화되었습니다.",
        };
      },
      linkSocialAccount: async (guestToken, dto) => {
        serviceCalls.linkSocialAccount.push({ guestToken, dto });
        return {
          success: true,
          userId: "user-uuid-1234",
        };
      },
      deleteAccount: async (userId) => {
        serviceCalls.deleteAccount.push(userId);
        return {
          success: true,
          message: "회원 탈퇴 및 모든 데이터 삭제가 완료되었습니다.",
        };
      },
    };

    controller = new AuthController(mockService as AuthService);
  });

  it("시나리오 1: POST /api/auth/guest/init는 유효한 UUID v7 DTO를 통과시키고 서비스에 위임해야 한다", async () => {
    const pipe = new ZodValidationPipe(GuestInitSchema);
    const rawDto = {
      memoId: "018d0000-0000-7000-8000-000000000001",
      categoryId: "018d0000-0000-7000-8000-000000000002",
    };

    const validatedDto = pipe.transform(rawDto, { type: "body" }) as any;
    const response = await controller.initGuestSession(validatedDto);

    assert.equal(response.guestToken, "gst_mocked_token_1234");
    assert.equal(response.seedMemoId, rawDto.memoId);
    assert.equal(serviceCalls.initGuestSession.length, 1);
  });

  it("시나리오 1-B: POST /api/auth/guest/init는 UUID v7 형식이 아닌 memoId 유입 시 400 COMMON_FIELD_FORMAT 에러를 발생시켜야 한다", () => {
    const pipe = new ZodValidationPipe(GuestInitSchema);
    const invalidDto = {
      memoId: "invalid-uuid-format",
      categoryId: "018d0000-0000-7000-8000-000000000002",
    };

    assert.throws(
      () => pipe.transform(invalidDto, { type: "body" }),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
        assert.equal(err.errorCode, ERROR_CODES.COMMON_FIELD_FORMAT);
        return true;
      }
    );
  });

  it("시나리오 2: POST /api/auth/guest/reset는 추출된 guestToken을 서비스에 전달해야 한다", async () => {
    const response = await controller.resetGuestData("gst_user_token");

    assert.equal(response.success, true);
    assert.equal(serviceCalls.resetGuestData[0], "gst_user_token");
  });

  it("시나리오 3: POST /api/auth/social/link는 provider/idToken DTO 검증 후 서비스에 위임해야 한다", async () => {
    const pipe = new ZodValidationPipe(LinkSocialAuthSchema);
    const rawDto = {
      provider: "kakao",
      idToken: "eyJhbGciOiJFUzI1NiJ9...",
    };

    const validatedDto = pipe.transform(rawDto, { type: "body" }) as any;
    const response = await controller.linkSocialAccount("gst_token", validatedDto);

    assert.equal(response.success, true);
    assert.equal(response.userId, "user-uuid-1234");
    assert.equal(serviceCalls.linkSocialAccount[0].guestToken, "gst_token");
  });

  it("시나리오 4: DELETE /api/auth/account는 추출된 userId를 서비스에 전달해야 한다", async () => {
    const response = await controller.deleteAccount("auth-user-uuid");

    assert.equal(response.success, true);
    assert.equal(serviceCalls.deleteAccount[0], "auth-user-uuid");
  });
});

