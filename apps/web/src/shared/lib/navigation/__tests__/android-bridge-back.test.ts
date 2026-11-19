import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatShareDraftText,
  parseShareTargetFromQuery,
} from "../../native-bridge/android-bridge";
import {
  resolveNextBackAction,
  type BackStackSnapshot,
} from "../back-button-handler";

describe("안드로이드 브릿지 Share Target & 물리 뒤로가기 스택", () => {
  describe("Share Target 파서 & 포매터", () => {
    it("share_text, share_url, share_title 쿼리를 파싱하고 본문 내 중복 URL을 제거해 조합해야 한다", () => {
      const parsed = parseShareTargetFromQuery(
        "?share_title=%EC%95%84%EC%9D%B4%EB%94%94%EB%AA%A8%EB%A6%AC&share_text=%EC%B0%B8%EA%B3%A0+%EB%A7%81%ED%81%AC&share_url=https%3A%2F%2Fideamory.app"
      );
      assert.deepEqual(parsed, {
        title: "아이디모리",
        text: "참고 링크",
        url: "https://ideamory.app",
      });

      assert.equal(
        formatShareDraftText(parsed!),
        "아이디모리\n참고 링크\nhttps://ideamory.app"
      );

      // text에 URL이 이미 포함된 경우 URL을 한 번 더 붙이지 않음
      assert.equal(
        formatShareDraftText({
          text: "기사 공유 https://news.example.com/1",
          url: "https://news.example.com/1",
        }),
        "기사 공유 https://news.example.com/1"
      );
    });

    it("공유 파라미터가 없으면 null을 반환해야 한다", () => {
      assert.equal(parseShareTargetFromQuery("?foo=bar"), null);
      assert.equal(parseShareTargetFromQuery(""), null);
    });
  });

  describe("resolveNextBackAction (계층적 뒤로가기 스택)", () => {
    const baseState: BackStackSnapshot = {
      drawerOpen: false,
      categoryPickerOpen: false,
      socialSheetOpen: false,
      legalModalOpen: false,
      feedbackModalOpen: false,
      searchActive: false,
      relatedFilterActive: false,
      viewMode: "ALL",
    };

    it("오버레이 스택이 겹쳐 있을 때 최상위 모달 → 시트 → 드로어 순으로 역순 닫힘을 반환해야 한다", () => {
      assert.equal(
        resolveNextBackAction(
          {
            ...baseState,
            drawerOpen: true,
            socialSheetOpen: true,
            legalModalOpen: true,
            feedbackModalOpen: true,
          },
          1000,
          null
        ),
        "CLOSE_FEEDBACK_MODAL"
      );

      assert.equal(
        resolveNextBackAction(
          { ...baseState, drawerOpen: true, categoryPickerOpen: true },
          1000,
          null
        ),
        "CLOSE_CATEGORY_PICKER"
      );

      assert.equal(
        resolveNextBackAction({ ...baseState, drawerOpen: true }, 1000, null),
        "CLOSE_DRAWER"
      );
    });

    it("검색 결과 뷰·연관 메모 필터·카테고리 뷰에서는 먼저 메인 타임라인으로 복귀해야 한다", () => {
      assert.equal(
        resolveNextBackAction({ ...baseState, searchActive: true }, 1000, null),
        "CLEAR_SEARCH"
      );
      assert.equal(
        resolveNextBackAction(
          { ...baseState, relatedFilterActive: true },
          1000,
          null
        ),
        "CLEAR_RELATED_FILTER"
      );
      assert.equal(
        resolveNextBackAction(
          { ...baseState, viewMode: "CATEGORY" },
          1000,
          null
        ),
        "RESET_VIEW_TO_ALL"
      );
    });

    it("홈 타임라인에서 1회 입력 시 종료 안내 토스트, 2초 이내 재입력 시 앱 종료를 반환해야 한다", () => {
      assert.equal(
        resolveNextBackAction(baseState, 1000, null),
        "SHOW_EXIT_PROMPT"
      );
      assert.equal(resolveNextBackAction(baseState, 2500, 1000), "EXIT_APP");
      assert.equal(
        resolveNextBackAction(baseState, 3500, 1000),
        "SHOW_EXIT_PROMPT"
      );
    });
  });
});
