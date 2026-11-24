"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Globe, Pencil, Trash2, X } from "lucide-react";
import type { MemoResponseDto } from "@ideamory/api-spec";
import {
  extractHostname,
  formatMemoTimestamp,
  isInternalGuideUrl,
  resolveGraphCategoryColor,
} from "@/entities/memo";
import { InlineEditor, useUpdateMemo } from "@/features/memo-edit";
import { useSoftDeleteMemo } from "@/features/memo-trash";

export interface GraphNodeSheetProps {
  memo: MemoResponseDto | null;
  relatedCount: number;
  onClose: () => void;
}

/**
 * 지식망에서 노드를 탭했을 때 하단 퀵 캡처 바 위로 150ms 슬라이딩되는 1-Depth 미니 카드 시트입니다.
 * 인라인 수정 및 0ms 즉시 삭제(Soft Delete)를 지원합니다.
 */
export function GraphNodeSheet({
  memo,
  relatedCount,
  onClose,
}: GraphNodeSheetProps) {
  const [isEditing, setIsEditing] = useState(false);
  const updateMemo = useUpdateMemo();
  const softDeleteMemo = useSoftDeleteMemo();

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

  const handleDelete = () => {
    softDeleteMemo.mutate({
      id: memo.id,
      categoryId: memo.categoryId,
    });
    onClose();
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
            <>
              <button
                type="button"
                className="graph-node-sheet-icon-btn"
                onClick={() => setIsEditing(true)}
                aria-label="메모 수정"
                title="메모 수정"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                className="graph-node-sheet-icon-btn is-danger"
                onClick={handleDelete}
                aria-label="메모 삭제"
                title="휴지통으로 이동"
              >
                <Trash2 size={14} />
              </button>
            </>
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
          <>
            <p
              className="graph-node-sheet-content"
              onClick={() => setIsEditing(true)}
              title="탭하여 바로 수정"
            >
              {memo.content}
            </p>
            {memo.ogp ? (
              isInternalGuideUrl(memo.ogp.targetUrl) ? (
                <Link href="/guide" className="ogp-card mt-2.5">
                  <Globe size={15} className="shrink-0 opacity-70" aria-hidden="true" />
                  <div>
                    <strong className="truncate">
                      {memo.ogp.title || "Ideamory 사용 가이드"}
                    </strong>
                    {memo.ogp.description ? (
                      <span>{memo.ogp.description}</span>
                    ) : null}
                    <small>앱 내 사용 가이드</small>
                  </div>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ) : (
                <a
                  href={memo.ogp.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ogp-card mt-2.5"
                >
                  <Globe size={15} className="shrink-0 opacity-70" aria-hidden="true" />
                  <div>
                    <strong className="truncate">
                      {memo.ogp.title || extractHostname(memo.ogp.targetUrl)}
                    </strong>
                    {memo.ogp.description ? (
                      <span>{memo.ogp.description}</span>
                    ) : null}
                    <small>{extractHostname(memo.ogp.targetUrl)}</small>
                  </div>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              )
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
