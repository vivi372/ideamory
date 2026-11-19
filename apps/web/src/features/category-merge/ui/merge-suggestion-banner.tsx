"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/api";
import { useViewStore } from "../../../shared/model/view-store";
import { fetchMergeSuggestionsListApi } from "../api/merge.api";
import { useMergeCategory } from "../model/use-merge-category";

/**
 * 병합 제안이 대기 중인 카테고리 뷰 진입 시 상단에 1줄로 노출되는
 * AI 유사 카테고리 병합 제안 인라인 배너입니다.
 *
 * `💡 '{targetCategoryName}' 카테고리와 비슷해요. 하나로 합칠까요?` 문구와
 * `[합치기]` / `[합치지 않기]` 양방향 액션을 제공합니다.
 *
 * @returns 유사 카테고리 병합 제안 배너 JSX (제안 미존재 시 null)
 */
export function MergeSuggestionBanner() {
  const viewMode = useViewStore((state) => state.viewMode);
  const selectedCategoryId = useViewStore((state) => state.selectedCategoryId);
  const { mergeCategories, dismissSuggestion, isMerging, isDismissing } =
    useMergeCategory();

  const { data: suggestions = [] } = useQuery({
    queryKey: queryKeys.categories.mergeSuggestions(),
    queryFn: fetchMergeSuggestionsListApi,
    enabled: viewMode === "CATEGORY" && Boolean(selectedCategoryId),
  });

  if (viewMode !== "CATEGORY" || !selectedCategoryId) {
    return null;
  }

  // source/target 양방향으로 매칭해 사이드바에서 두 카테고리 중 어느 쪽으로 진입해도 제안을 노출
  const matched = suggestions.find(
    (item) =>
      item.sourceCategoryId === selectedCategoryId ||
      item.targetCategoryId === selectedCategoryId
  );

  if (!matched) {
    return null;
  }

  const peerName =
    matched.sourceCategoryId === selectedCategoryId
      ? matched.targetCategoryName
      : matched.sourceCategoryName;

  return (
    <div
      className="merge-card mt-3.5 mb-1"
      role="region"
      aria-label="유사 카테고리 병합 제안"
    >
      <span className="merge-dot" aria-hidden="true" />
      <div>
        <strong>
          &lsquo;{peerName}&rsquo; 카테고리와 비슷해요. 하나로 합칠까요?
        </strong>
        <small>
          유사도 {Math.round(matched.similarity * 100)}% · 메모는 손실 없이 모두
          유지됩니다
        </small>
      </div>
      <div className="merge-actions">
        <button
          type="button"
          disabled={isMerging || isDismissing}
          onClick={() =>
            mergeCategories({
              suggestionId: matched.id,
              sourceCategoryId: matched.sourceCategoryId,
              targetCategoryId: matched.targetCategoryId,
              targetCategoryName: matched.targetCategoryName,
            })
          }
        >
          합치기
        </button>
        <button
          type="button"
          disabled={isMerging || isDismissing}
          onClick={() => dismissSuggestion(matched.id)}
        >
          합치지 않기
        </button>
      </div>
    </div>
  );
}
