import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { queryKeys } from "../../../api/query-keys";
import { useViewStore } from "../../../model/view-store";
import { useFeedbackStore } from "../use-feedback";

describe("3-2. Query Key 팩토리 & 전역 피드백 스토어", () => {
  beforeEach(() => {
    useFeedbackStore.setState({ toasts: [], modal: null });
  });

  it("queryKeys는 memos와 categories 도메인별로 일관된 계층형 튜플을 반환한다", () => {
    assert.deepEqual(queryKeys.memos.all, ["memos"]);
    assert.deepEqual(queryKeys.memos.timeline(), [
      "memos",
      "timeline",
      { categoryId: null },
    ]);
    assert.deepEqual(queryKeys.memos.timeline("cat-1"), [
      "memos",
      "timeline",
      { categoryId: "cat-1" },
    ]);
    assert.deepEqual(queryKeys.memos.search("아이디어"), [
      "memos",
      "search",
      { query: "아이디어" },
    ]);
    assert.deepEqual(queryKeys.memos.related("memo-1"), [
      "memos",
      "related",
      "memo-1",
    ]);
    assert.deepEqual(queryKeys.memos.trash(), ["memos", "trash"]);
    assert.deepEqual(queryKeys.categories.list(), ["categories", "list"]);
    assert.deepEqual(queryKeys.categories.mergeSuggestions(), [
      "categories",
      "merge-suggestions",
    ]);
  });

  it("showToast는 최대 3개의 최근 토스트만 유지하고 dismissToast로 개별 닫기할 수 있다", () => {
    const store = useFeedbackStore.getState();
    const id1 = store.showToast("info", "첫 번째 안내");
    store.showToast("warn", "두 번째 경고");
    store.showToast("error", "세 번째 오류");
    const id4 = store.showToast("info", "네 번째 안내");

    const { toasts } = useFeedbackStore.getState();
    assert.equal(toasts.length, 3);
    assert.equal(toasts.some((item) => item.id === id1), false);
    assert.equal(toasts.some((item) => item.id === id4), true);

    useFeedbackStore.getState().dismissToast(id4);
    assert.equal(useFeedbackStore.getState().toasts.length, 2);
  });

  it("openConfirm은 사용자 확인 시 true, 취소 시 false로 Promise를 resolve하고 모달을 닫는다", async () => {
    const confirmPromise = useFeedbackStore.getState().openConfirm({
      title: "게스트 데이터 초기화",
      description: "작성한 모든 메모 데이터가 영구히 삭제됩니다.",
    });

    const openedModal = useFeedbackStore.getState().modal;
    assert.equal(openedModal?.kind, "confirm");
    openedModal?.onConfirm?.();

    assert.equal(await confirmPromise, true);
    assert.equal(useFeedbackStore.getState().modal, null);

    const cancelPromise = useFeedbackStore.getState().openConfirm({
      title: "회원탈퇴",
      description: "모든 데이터가 삭제됩니다.",
    });

    useFeedbackStore.getState().modal?.onCancel?.();
    assert.equal(await cancelPromise, false);
    assert.equal(useFeedbackStore.getState().modal, null);
  });

  it("openAlert와 openFatal은 각각 1-Button / 2-Button 모달 상태를 올바르게 구성한다", () => {
    let alertConfirmed = false;
    useFeedbackStore.getState().openAlert({
      description: "세션이 만료되었습니다.",
      onConfirm: () => {
        alertConfirmed = true;
      },
    });

    const alertModal = useFeedbackStore.getState().modal;
    assert.equal(alertModal?.kind, "alert");
    alertModal?.onConfirm?.();
    assert.equal(alertConfirmed, true);
    assert.equal(useFeedbackStore.getState().modal, null);

    let retried = false;
    useFeedbackStore.getState().openFatal({
      description: "DB 연결 장애",
      traceId: "abcdef1234567890abcdef1234567890",
      onRetry: () => {
        retried = true;
      },
    });

    const fatalModal = useFeedbackStore.getState().modal;
    assert.equal(fatalModal?.kind, "fatal");
    assert.equal(fatalModal?.traceId, "abcdef1234567890abcdef1234567890");
    fatalModal?.onConfirm?.();
    assert.equal(retried, true);
    assert.equal(useFeedbackStore.getState().modal, null);
  });

  it("useViewStore는 ALL/CATEGORY/TRASH 뷰 모드와 1-Depth 관련 메모 필터 상태를 올바르게 전환한다", () => {
    useViewStore.getState().resetView();
    assert.equal(useViewStore.getState().viewMode, "ALL");
    assert.equal(useViewStore.getState().selectedCategoryId, null);
    assert.equal(useViewStore.getState().relatedFilterMemoId, null);

    useViewStore.getState().setSelectedCategory("cat-uuid-1");
    assert.equal(useViewStore.getState().viewMode, "CATEGORY");
    assert.equal(useViewStore.getState().selectedCategoryId, "cat-uuid-1");

    useViewStore.getState().setRelatedFilterMemo("memo-uuid-1");
    assert.equal(useViewStore.getState().relatedFilterMemoId, "memo-uuid-1");

    useViewStore.getState().setViewMode("TRASH");
    assert.equal(useViewStore.getState().viewMode, "TRASH");
    assert.equal(useViewStore.getState().selectedCategoryId, null);
    assert.equal(useViewStore.getState().relatedFilterMemoId, null);
  });
});
