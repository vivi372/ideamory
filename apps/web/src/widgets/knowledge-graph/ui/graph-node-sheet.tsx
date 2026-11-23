"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import type { MemoResponseDto } from "@ideamory/api-spec";
import {
  formatMemoTimestamp,
  resolveGraphCategoryColor,
} from "@/entities/memo";
import { InlineEditor, useUpdateMemo } from "@/features/memo-edit";

export interface GraphNodeSheetProps {
  memo: MemoResponseDto | null;
  relatedCount: number;
  onClose: () => void;
}

/**
 * 지식망에서 노드를 탭했을 때 하단 퀵 캡처 바 위로 150ms 슬라이딩되는 1-Depth 미니 카드 시트입니다.
 */
export function GraphNodeSheet({
  memo,
  relatedCount,
  onClose,
}: GraphNodeSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateMemo = useUpdateMemo();

  useEffect(() => {
    setIsEditing(false);
  }, [memo?.id]);

  if (!memo) {
    return null;
  }

  const categoryLabel = memo.categoryName ?? "미분류";
  const categoryColor = resolveGraphCategoryColor(memo.categoryName);

  const handleSave = (nextContent: string) => {
    setIsEditing(false);
    const trimmed = nextContent.trim();
    if (!trimmed || trimmed === memo.content) {
      return;
    }
    updateMemo.mutate({ id: memo.id, content: trimmed });
  };

  return (
    <section
      className="graph-node-sheet"
      aria-label="선택한 메모 상세"
    >
      <div className="graph-node-sheet-header">
        <div className="graph-node-sheet-meta">
          <span
            className="graph-node-sheet-category"
            style={{ borderColor: categoryColor, color: categoryColor }}
          >
            {categoryLabel}
          </span>
          <span className="graph-node-sheet-time">
            {formatMemoTimestamp(memo.createdAt)}
          </span>
          <span className="graph-node-sheet-links">
            연결 {relatedCount}개
          </span>
        </div>

        <div className="graph-node-sheet-actions">
          {!isEditing && (
            <button
              type="button"
              className="graph-node-sheet-icon-btn"
              onClick={() => setIsEditing(true)}
              aria-label="메모 수정"
              title="메모 수정"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            type="button"
            className="graph-node-sheet-icon-btn"
            onClick={onClose}
            aria-label="미니 카드 닫기"
            title="닫기"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="graph-node-sheet-body">
        {isEditing ? (
          <InlineEditor
            initialContent={memo.content}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <p
            className="graph-node-sheet-content"
            onClick={() => setIsEditing(true)}
            title="탭하여 바로 수정"
          >
            {memo.content}
          </p>
        )}
      </div>
    </section>
  );
}
