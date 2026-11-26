"use client";

import { useState } from "react";
import type { AiSearchSourceDto, MemoResponseDto } from "@ideamory/api-spec";
import { MemoCard } from "@/entities/memo";
import { useAiModeStore } from "@/features/memo-capture";
import { InlineEditor, useUpdateMemo } from "@/features/memo-edit";
import { useViewStore } from "@/shared/model/view-store";

export interface AiSourceCardListProps {
  /** 백엔드가 반환한 근거 메모 목록 (3~5개) */
  sources: AiSearchSourceDto[];
}

/**
 * `AiSearchSourceDto`를 기존 `MemoCard`가 기대하는 `MemoResponseDto` 형태로 변환합니다.
 *
 * @param source AI 검색 근거 메모 DTO
 * @returns 타임라인 카드 렌더링용 메모 DTO
 */
function toMemoCardDto(source: AiSearchSourceDto): MemoResponseDto {
  return {
    id: source.id,
    content: source.content,
    categoryId: source.categoryId,
    categoryName: source.categoryName,
    ogp: source.ogp,
    aiStatus: "COMPLETED",
    deletedAt: null,
    createdAt: source.createdAt,
    updatedAt: source.createdAt,
  };
}

/**
 * AI 브리핑 하단에 근거 메모 카드(3~5개)를 렌더링하며,
 * 기존 `MemoCard`, `InlineEditor`, `CategoryPickerSheet` 인터랙션을 그대로 재사용하는 리스트입니다.
 *
 * @param props AI 검색 출처 메모 목록
 * @returns 근거 메모 카드 목록 JSX
 */
export function AiSourceCardList({ sources }: AiSourceCardListProps) {
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const openCategoryPicker = useViewStore((state) => state.openCategoryPicker);
  const updateSourceContent = useAiModeStore(
    (state) => state.updateSourceContent
  );
  const updateMemoMutation = useUpdateMemo();

  if (sources.length === 0) {
    return (
      <section className="ai-sources-section" aria-label="근거 메모 목록">
        <div className="ai-sources-header">
          <span className="ai-sources-title">근거 메모</span>
          <span className="ai-sources-count">0개</span>
        </div>
        <div className="empty-state">
          <p className="empty-title">일치하는 근거 메모를 찾지 못했습니다.</p>
          <p className="empty-sub">
            다른 키워드나 표현으로 다시 질문해 보세요.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="ai-sources-section" aria-label="근거 메모 목록">
      <div className="ai-sources-header">
        <span className="ai-sources-title">근거 메모</span>
        <span className="ai-sources-count">{sources.length}개</span>
      </div>
      <div className="timeline-list">
        {sources.map((source) => {
          const memo = toMemoCardDto(source);
          const isEditing = editingMemoId === memo.id;

          return (
            <MemoCard
              key={memo.id}
              memo={memo}
              isEditing={isEditing}
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
                    onCancel={() => setEditingMemoId(null)}
                    onSave={(nextContent) => {
                      const trimmed = nextContent.trim();
                      setEditingMemoId(null);
                      if (!trimmed || trimmed === memo.content) {
                        return;
                      }
                      updateSourceContent(memo.id, trimmed);
                      updateMemoMutation.mutate({
                        id: memo.id,
                        content: trimmed,
                      });
                    }}
                  />
                ) : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}
