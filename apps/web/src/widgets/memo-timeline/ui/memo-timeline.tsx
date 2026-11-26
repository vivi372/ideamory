"use client";

import { useMemo, useState } from "react";
import { Archive, Search, Sparkles, Trash2, X } from "lucide-react";
import type { MemoResponseDto } from "@ideamory/api-spec";
import { MemoCard } from "@/entities/memo";
import { MergeSuggestionBanner } from "@/features/category-merge";
import { InlineEditor, useUpdateMemo } from "@/features/memo-edit";
import {
  SearchResultBanner,
  useHybridSearch,
} from "@/features/memo-search";
import {
  TrashButton,
  useRestoreMemo,
  useSoftDeleteMemo,
} from "@/features/memo-trash";
import {
  RelatedFilterBanner,
  RelatedMemosChip,
  useRelatedMemos,
} from "@/features/related-memos";
import { useViewStore } from "@/shared/model/view-store";
import { useTimelineMemos } from "../model/use-timeline-memos";

export interface MemoTimelineProps {
  /** 게스트/소셜 세션 부트스트랩 완료 여부 */
  isBootstrapped: boolean;
  /** 선택된 카테고리 또는 휴지통 필터 라벨 */
  activeFilterLabel?: string | null;
  /** 카테고리/휴지통 필터 해제 콜백 */
  onClearFilter?: () => void;
}

/**
 * 메모 타임라인 피드, 하이브리드 검색 결과, 1-Depth 연관 메모 필터,
 * AI 유사 카테고리 병합 제안 배너, 인라인 편집 및 30일 휴지통을 조합하는 메인 위젯입니다.
 *
 * `entities/memo`의 순수 표현 카드(`MemoCard`)에 각 피처 슬라이스의 인터랙션을
 * 슬롯으로 주입하여 FSD 단방향 레이어링 원칙을 유지합니다.
 *
 * @param props 세션 부트스트랩 완료 상태 및 활성 필터 정보
 * @returns 타임라인 피드 및 상단 컨텍스트 배너 JSX
 */
export function MemoTimeline({
  isBootstrapped,
  activeFilterLabel,
  onClearFilter,
}: MemoTimelineProps) {
  const viewMode = useViewStore((state) => state.viewMode);
  const openCategoryPicker = useViewStore((state) => state.openCategoryPicker);
  const isTrash = viewMode === "TRASH";

  const { data: timelineMemos = [], isLoading: isTimelineLoading } =
    useTimelineMemos({
      enabled: isBootstrapped,
    });

  const {
    data: searchResults = [],
    isLoading: isSearchLoading,
    searchQuery,
    isSearchActive,
    clearSearch,
  } = useHybridSearch({ enabled: isBootstrapped });

  const {
    data: relatedResults = [],
    isLoading: isRelatedLoading,
    relatedFilterMemoId,
    isRelatedActive,
    openRelatedFilter,
    clearRelatedFilter,
  } = useRelatedMemos({ enabled: isBootstrapped });

  const { mutate: updateMemo } = useUpdateMemo();
  const { mutate: softDeleteMemo } = useSoftDeleteMemo();
  const { mutate: restoreMemo } = useRestoreMemo();

  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);

  const sourceMemo = useMemo(
    () =>
      relatedFilterMemoId
        ? timelineMemos.find((item) => item.id === relatedFilterMemoId) ?? null
        : null,
    [relatedFilterMemoId, timelineMemos]
  );

  const visibleMemos = useMemo<MemoResponseDto[]>(() => {
    if (isSearchActive) {
      return searchResults.map((item) => ({
        id: item.id,
        content: item.content,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        aiStatus: "COMPLETED" as const,
        ogpId: null,
        ogp: item.ogp ?? null,
        deletedAt: null,
        createdAt: item.createdAt,
      }));
    }

    if (isRelatedActive) {
      const mappedRelated: MemoResponseDto[] = relatedResults.map((item) => ({
        id: item.id,
        content: item.content,
        categoryId: item.categoryId,
        categoryName: item.categoryName,
        aiStatus: "COMPLETED" as const,
        ogpId: null,
        ogp: item.ogp ?? null,
        deletedAt: null,
        createdAt: item.createdAt,
      }));

      if (!sourceMemo) {
        return mappedRelated;
      }

      return [
        sourceMemo,
        ...mappedRelated.filter((item) => item.id !== sourceMemo.id),
      ];
    }

    return timelineMemos;
  }, [
    isRelatedActive,
    isSearchActive,
    relatedResults,
    searchResults,
    sourceMemo,
    timelineMemos,
  ]);

  const isLoading =
    !isBootstrapped ||
    (isSearchActive
      ? isSearchLoading
      : isRelatedActive
        ? isRelatedLoading
        : isTimelineLoading);

  if (isLoading) {
    return (
      <div className="timeline" aria-busy="true" aria-label="메모 불러오는 중">
        {[0, 1, 2].map((idx) => (
          <div key={idx} className="note-card animate-pulse">
            <span className="note-marker marker-cyan" aria-hidden="true" />
            <div className="mb-3 h-4 w-24 rounded bg-slate-800/80" />
            <div className="space-y-2">
              <div className="h-3.5 w-full rounded bg-slate-800/60" />
              <div className="h-3.5 w-3/4 rounded bg-slate-800/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {isSearchActive ? (
        <SearchResultBanner
          query={searchQuery}
          resultCount={visibleMemos.length}
          onClear={clearSearch}
        />
      ) : null}

      {!isSearchActive && isRelatedActive ? (
        <RelatedFilterBanner
          sourceContent={sourceMemo?.content ?? "선택한 메모"}
          relatedCount={relatedResults.length}
          onClear={clearRelatedFilter}
        />
      ) : null}

      {!isSearchActive && !isRelatedActive && activeFilterLabel && onClearFilter ? (
        <div className="related-filter-banner" role="status">
          <span className="search-banner-content">
            {isTrash ? (
              <Trash2 size={14} aria-hidden="true" className="search-banner-icon" />
            ) : (
              <span className="related-dot" aria-hidden="true" />
            )}
            <span className="search-banner-text">{activeFilterLabel}</span>
          </span>
          <button
            type="button"
            onClick={onClearFilter}
            aria-label={`${activeFilterLabel} 필터 해제하고 이전 화면 보기`}
            title={
              isTrash ? "이전 화면으로 돌아가기" : "전체 메모로 돌아가기"
            }
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {!isSearchActive && !isRelatedActive ? <MergeSuggestionBanner /> : null}

      {visibleMemos.length === 0 ? (
        <div className="timeline">
          <div className="empty-state">
            {isSearchActive ? (
              <>
                <Search size={24} aria-hidden="true" />
                <p>
                  &ldquo;{searchQuery}&rdquo;와 일치하는 기억을 찾지
                  못했습니다.
                </p>
              </>
            ) : isRelatedActive ? (
              <>
                <Sparkles size={24} aria-hidden="true" />
                <p>연결된 유사 메모가 아직 없습니다.</p>
              </>
            ) : isTrash ? (
              <>
                <Trash2 size={24} aria-hidden="true" />
                <p>휴지통이 비어 있습니다. 삭제된 메모는 30일간 보관됩니다.</p>
              </>
            ) : viewMode === "CATEGORY" ? (
              <>
                <Sparkles size={24} aria-hidden="true" />
                <p>이 카테고리에 표시할 활성 메모가 없습니다.</p>
              </>
            ) : (
              <>
                <Archive size={24} aria-hidden="true" />
                <p>
                  아직 저장된 메모가 없습니다. 아래 입력창에 떠오른 생각을
                  적어보세요.
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="timeline">
          {visibleMemos.map((memo) => {
            const isEditing = !isTrash && editingMemoId === memo.id;
            const isCategorizing =
              memo.aiStatus === "PENDING" ||
              memo.categoryName === "AI 분류중" ||
              memo.categoryName === "AI 분류 중..." ||
              memo.categoryName === "ai 분류 중...";

            return (
              <MemoCard
                key={memo.id}
                memo={memo}
                isEditing={isEditing}
                isTrash={isTrash}
                isCategorizing={isCategorizing}
                onStartEdit={(target) => setEditingMemoId(target.id)}
                onCategoryClick={(target) =>
                  openCategoryPicker({
                    memoId: target.id,
                    currentCategoryId: target.categoryId,
                  })
                }
                editorSlot={
                  isEditing ? (
                    <InlineEditor
                      initialContent={memo.content}
                      onSave={(nextContent) => {
                        setEditingMemoId(null);
                        updateMemo({ id: memo.id, content: nextContent });
                      }}
                      onCancel={() => setEditingMemoId(null)}
                    />
                  ) : undefined
                }
                actionSlot={
                  <TrashButton
                    isTrash={isTrash}
                    onAction={() => {
                      if (isTrash) {
                        restoreMemo(memo.id);
                      } else {
                        if (editingMemoId === memo.id) {
                          setEditingMemoId(null);
                        }
                        softDeleteMemo({
                          id: memo.id,
                          categoryId: memo.categoryId,
                        });
                      }
                    }}
                  />
                }
                footerSlot={
                  !isTrash && (memo.relatedCount ?? 0) > 0 ? (
                    <RelatedMemosChip
                      count={memo.relatedCount ?? 0}
                      isActive={relatedFilterMemoId === memo.id}
                      onSelect={() => openRelatedFilter(memo.id)}
                    />
                  ) : undefined
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
