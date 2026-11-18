"use client";

import { useState } from "react";
import { Archive, Sparkles, Trash2 } from "lucide-react";
import { MemoCard } from "../../../entities/memo";
import { InlineEditor, useUpdateMemo } from "../../../features/memo-edit";
import {
  TrashButton,
  useRestoreMemo,
  useSoftDeleteMemo,
} from "../../../features/memo-trash";
import { useViewStore } from "../../../shared/model/view-store";
import { useTimelineMemos } from "../model/use-timeline-memos";

export interface MemoTimelineProps {
  /** 게스트/소셜 세션 부트스트랩 완료 여부 */
  isBootstrapped: boolean;
}

/**
 * 메모 타임라인 피드, 1-Depth 인라인 편집, 0ms Soft Delete 및 30일 휴지통 복구를 조합하는 위젯입니다.
 *
 * `entities/memo`의 순수 표현 카드(`MemoCard`)에 `features/memo-edit`과 `features/memo-trash`의
 * 인터랙션을 슬롯으로 주입하여 FSD 단방향 레이어링 원칙을 유지합니다.
 *
 * @param props 세션 부트스트랩 완료 상태
 * @returns 타임라인 피드 JSX
 */
export function MemoTimeline({ isBootstrapped }: MemoTimelineProps) {
  const viewMode = useViewStore((state) => state.viewMode);
  const isTrash = viewMode === "TRASH";

  const { data: memos = [], isLoading } = useTimelineMemos({
    enabled: isBootstrapped,
  });
  const { mutate: updateMemo } = useUpdateMemo();
  const { mutate: softDeleteMemo } = useSoftDeleteMemo();
  const { mutate: restoreMemo } = useRestoreMemo();

  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);

  if (!isBootstrapped || isLoading) {
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

  if (memos.length === 0) {
    return (
      <div className="timeline">
        <div className="empty-state">
          {isTrash ? (
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
    );
  }

  return (
    <div className="timeline">
      {memos.map((memo) => {
        const isEditing = !isTrash && editingMemoId === memo.id;
        const isCategorizing = memo.categoryName === "AI 분류중";

        return (
          <MemoCard
            key={memo.id}
            memo={memo}
            isEditing={isEditing}
            isTrash={isTrash}
            isCategorizing={isCategorizing}
            onStartEdit={(target) => setEditingMemoId(target.id)}
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
          />
        );
      })}
    </div>
  );
}
