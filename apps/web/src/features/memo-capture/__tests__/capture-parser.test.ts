import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractValidClipboardUrl,
  parseCaptureContent,
  splitLeadingCategoryHighlight,
} from "../lib/capture-parser";

describe("0.1초 퀵 캡처 파서 (capture-parser)", () => {
  describe("parseCaptureContent", () => {
    it("문두 @카테고리 지시어가 있으면 categoryHint와 정돈된 본문을 분리해야 한다", () => {
      const result = parseCaptureContent("  @아이디어 오늘 할 일 정리  ");
      assert.deepEqual(result, {
        categoryHint: "아이디어",
        displayContent: "오늘 할 일 정리",
      });
    });

    it("@카테고리 뒤에 본문이 없으면 지시어로 파싱하지 않고 원문을 유지해야 한다", () => {
      const result = parseCaptureContent("@아이디어");
      assert.deepEqual(result, {
        categoryHint: null,
        displayContent: "@아이디어",
      });
    });

    it("문두에 @가 없는 일반 메모는 categoryHint를 null로 반환해야 한다", () => {
      const result = parseCaptureContent("오늘 회의에서 @김대리 와 논의함");
      assert.deepEqual(result, {
        categoryHint: null,
        displayContent: "오늘 회의에서 @김대리 와 논의함",
      });
    });
  });

  describe("extractValidClipboardUrl", () => {
    it("유효한 http/https URL만 추출하고 공백을 제거해야 한다", () => {
      assert.equal(
        extractValidClipboardUrl("  https://ideamory.app/guide?tab=1  "),
        "https://ideamory.app/guide?tab=1"
      );
      assert.equal(
        extractValidClipboardUrl("http://localhost:3000"),
        "http://localhost:3000/"
      );
    });

    it("일반 텍스트나 javascript: 등 비HTTP 스킴은 null을 반환해야 한다", () => {
      assert.equal(extractValidClipboardUrl("그냥 복사한 메모"), null);
      assert.equal(extractValidClipboardUrl("javascript:alert(1)"), null);
      assert.equal(extractValidClipboardUrl("ftp://example.com/file"), null);
    });
  });

  describe("splitLeadingCategoryHighlight", () => {
    it("문두 @카테고리 입력 시 지시어 토큰만 정확히 분리해 강조 대상으로 반환해야 한다", () => {
      assert.deepEqual(splitLeadingCategoryHighlight("@아이디어"), {
        leadingWhitespace: "",
        directive: "@아이디어",
        rest: "",
      });
      assert.deepEqual(splitLeadingCategoryHighlight("  @개발 다음 주 회의"), {
        leadingWhitespace: "  ",
        directive: "@개발",
        rest: " 다음 주 회의",
      });
    });

    it("문두 이메일, 본문 중간 이메일, 도메인 형태(@gmail.com)는 강조하지 않아야 한다", () => {
      assert.deepEqual(splitLeadingCategoryHighlight("user@gmail.com 문의"), {
        leadingWhitespace: "",
        directive: null,
        rest: "user@gmail.com 문의",
      });
      assert.deepEqual(
        splitLeadingCategoryHighlight("연락처는 dev@ideamory.app 입니다"),
        {
          leadingWhitespace: "",
          directive: null,
          rest: "연락처는 dev@ideamory.app 입니다",
        }
      );
      assert.deepEqual(splitLeadingCategoryHighlight("@gmail.com 주소"), {
        leadingWhitespace: "",
        directive: null,
        rest: "@gmail.com 주소",
      });
      assert.deepEqual(splitLeadingCategoryHighlight("@user@gmail.com"), {
        leadingWhitespace: "",
        directive: null,
        rest: "@user@gmail.com",
      });
    });
  });
});
