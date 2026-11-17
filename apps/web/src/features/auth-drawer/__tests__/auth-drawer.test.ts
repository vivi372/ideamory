import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { UuidV7Schema } from "@ideamory/api-spec";
import { apiClient } from "../../../shared/api/api-client";
import { generateUuidV7 } from "../../../shared/lib/uuid-v7";
import {
  deleteSocialAccountApi,
  fetchCategoriesApi,
  fetchMergeSuggestionsApi,
  initGuestSessionApi,
  linkSocialAccountApi,
  resetGuestDataApi,
} from "../api/auth.api";
import { getAccountStatusLabel, useAuthStore } from "../model/auth-store";

describe("3-3. 익명 게스트 부트스트랩 & 인증 드로어", () => {
  beforeEach(() => {
    useAuthStore.setState({
      drawerOpen: false,
      socialSheetOpen: false,
      legalModalType: null,
      isBootstrapped: false,
      socialProvider: null,
    });
  });

  it("generateUuidV7은 @ideamory/api-spec의 UuidV7Schema 정규식 규격을 만족하는 고유 식별자를 생성한다", () => {
    const id1 = generateUuidV7();
    const id2 = generateUuidV7();

    assert.equal(UuidV7Schema.safeParse(id1).success, true);
    assert.equal(UuidV7Schema.safeParse(id2).success, true);
    assert.notEqual(id1, id2);
  });

  it("useAuthStore는 드로어, 소셜 바텀시트, 인앱 약관 오버레이 및 Zero-Profile 상태 라벨을 관리한다", () => {
    assert.equal(getAccountStatusLabel(null), "게스트 모드 · 기기 보관 중");
    assert.equal(getAccountStatusLabel("kakao"), "카카오 연동됨");
    assert.equal(getAccountStatusLabel("google"), "구글 연동됨");
    assert.equal(getAccountStatusLabel("github"), "깃허브 연동됨");

    const store = useAuthStore.getState();
    store.setDrawerOpen(true);
    store.setSocialSheetOpen(true);
    store.openLegalModal("privacy");
    store.setSocialProvider("kakao");

    const updated = useAuthStore.getState();
    assert.equal(updated.drawerOpen, true);
    assert.equal(updated.socialSheetOpen, true);
    assert.equal(updated.legalModalType, "privacy");
    assert.equal(updated.socialProvider, "kakao");

    updated.closeLegalModal();
    assert.equal(useAuthStore.getState().legalModalType, null);
  });

  it("auth.api 함수들은 백엔드 /api/v1 컨트롤러 경로 규격에 맞춰 REST 요청을 전송한다", async () => {
    const calls: { method: string; url: string; payload?: unknown }[] = [];
    const originalPost = apiClient.post.bind(apiClient);
    const originalGet = apiClient.get.bind(apiClient);
    const originalDelete = apiClient.delete.bind(apiClient);

    (apiClient as { post: unknown }).post = async (url: string, data?: unknown) => {
      calls.push({ method: "POST", url, payload: data });
      return { data: { guestToken: "gst_test", seedMemoId: generateUuidV7(), success: true, userId: generateUuidV7() } };
    };
    (apiClient as { get: unknown }).get = async (url: string) => {
      calls.push({ method: "GET", url });
      return { data: [] };
    };
    (apiClient as { delete: unknown }).delete = async (url: string) => {
      calls.push({ method: "DELETE", url });
      return { data: { success: true } };
    };

    try {
      const memoId = generateUuidV7();
      const categoryId = generateUuidV7();

      await initGuestSessionApi({ memoId, categoryId });
      await resetGuestDataApi();
      await linkSocialAccountApi({ provider: "kakao", idToken: "jwt-123" });
      await deleteSocialAccountApi();
      await fetchCategoriesApi();
      await fetchMergeSuggestionsApi();

      assert.deepEqual(
        calls.map((c) => `${c.method} ${c.url}`),
        [
          "POST /auth/guest/init",
          "POST /auth/guest/reset",
          "POST /auth/social/link",
          "DELETE /auth/account",
          "GET /categories",
          "GET /categories/merge-suggestions",
        ]
      );
    } finally {
      apiClient.post = originalPost;
      apiClient.get = originalGet;
      apiClient.delete = originalDelete;
    }
  });
});
