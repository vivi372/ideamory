import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { useAiModeStore } from "../../../shared/model/ai-mode-store";

describe("useAiModeStore (썸존 AI 질의 모드 & Single-Briefing Replace)", () => {
  beforeEach(() => {
    useAiModeStore.getState().resetAiSearch();
  });

  it("toggleAiMode는 AI 모드를 켜고 끌 때 브리핑 상태를 즉시 초기화해야 한다", () => {
    const store = useAiModeStore.getState();
    assert.equal(store.isAiMode, false);

    store.toggleAiMode();
    assert.equal(useAiModeStore.getState().isAiMode, true);

    useAiModeStore.getState().setBriefingResult("첫 번째 질문", {
      answer: "**요약 결론**\n* 근거 1",
      sources: [],
    });
    assert.equal(useAiModeStore.getState().activeQuery, "첫 번째 질문");

    useAiModeStore.getState().toggleAiMode();
    const afterOff = useAiModeStore.getState();
    assert.equal(afterOff.isAiMode, false);
    assert.equal(afterOff.briefingResult, null);
    assert.equal(afterOff.activeQuery, "");
  });

  it("setBriefingResult는 대화 히스토리를 누적하지 않고 항상 최신 1건만 덮어써야 한다", () => {
    const store = useAiModeStore.getState();

    store.setBriefingResult("리액트 상태관리 질문", {
      answer: "**Zustand 권장**\n* 가볍습니다",
      sources: [
        {
          id: "0195a000-0000-7000-8000-000000000001",
          content: "Zustand 메모",
          categoryId: "0195a000-0000-7000-8000-000000000010",
          categoryName: "개발",
          ogp: null,
          createdAt: "2026-11-26T00:00:00.000Z",
        },
      ],
    });

    store.setBriefingResult("후속 질문", {
      answer: "**새 브리핑 결론**\n* 교체됨",
      sources: [],
    });

    const latest = useAiModeStore.getState();
    assert.equal(latest.isAiMode, true);
    assert.equal(latest.isSearching, false);
    assert.equal(latest.activeQuery, "후속 질문");
    assert.equal(latest.briefingResult?.answer, "**새 브리핑 결론**\n* 교체됨");
    assert.equal(latest.briefingResult?.sources.length, 0);
  });

  it("updateSourceContent는 근거 메모 카드 본문을 낙관적으로 갱신해야 한다", () => {
    const memoId = "0195a000-0000-7000-8000-000000000002";
    useAiModeStore.getState().setBriefingResult("질문", {
      answer: "**결론**\n* 요약",
      sources: [
        {
          id: memoId,
          content: "이전 본문",
          categoryId: "0195a000-0000-7000-8000-000000000010",
          categoryName: "개발",
          ogp: null,
          createdAt: "2026-11-26T00:00:00.000Z",
        },
      ],
    });

    useAiModeStore.getState().updateSourceContent(memoId, "수정된 본문");
    assert.equal(
      useAiModeStore.getState().briefingResult?.sources[0]?.content,
      "수정된 본문"
    );
  });
});
