"use client";

import type { CategoryResponseDto } from "@ideamory/api-spec";
import { Archive, Trash2, X } from "lucide-react";
import type { ViewMode } from "@/shared/model/view-store";
import { AccountSection } from "./account-section";

interface SidebarDrawerProps {
  /** 드로어 열림 여부 */
  open: boolean;
  /** 현재 뷰 모드 */
  viewMode: ViewMode;
  /** 현재 선택된 카테고리 UUID v7 */
  selectedCategoryId: string | null;
  /** 활성 카테고리 목록 */
  categories: CategoryResponseDto[];
  /** 전체 활성 메모 개수 */
  totalMemoCount: number;
  /** 병합 제안이 대기 중인 카테고리 ID 집합 (오렌지 닷 표시용) */
  suggestionCategoryIds: Set<string>;
  /** Zero-Profile 계정 상태 문구 */
  accountStatusLabel: string;
  /** 게스트 모드 여부 */
  isGuest: boolean;
  /** 초기화/탈퇴 진행 중 여부 */
  isMutating: boolean;
  onClose: () => void;
  onSelectAllMemos: () => void;
  onSelectCategory: (categoryId: string) => void;
  onSelectTrash: () => void;
  onOpenSocialSheet: () => void;
  onResetGuestData: () => void;
}

/**
 * 상단 햄버거 메뉴 터치 시 화면 좌측에서 슬라이딩 오픈되는 1-Depth 사이드바 드로어입니다.
 * `LIBRARY` (전체 메모, 활성 카테고리 + 병합 제안 오렌지 닷, 30일 휴지통) 및
 * 하단 `AccountSection`을 렌더링합니다.
 *
 * @param props 드로어 상태 및 뷰/계정 액션 콜백
 * @returns 사이드바 드로어 JSX
 */
export function SidebarDrawer({
  open,
  viewMode,
  selectedCategoryId,
  categories,
  totalMemoCount,
  suggestionCategoryIds,
  accountStatusLabel,
  isGuest,
  isMutating,
  onClose,
  onSelectAllMemos,
  onSelectCategory,
  onSelectTrash,
  onOpenSocialSheet,
  onResetGuestData,
}: SidebarDrawerProps) {
  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} />}
      <aside
        className={`drawer ${open ? "open" : ""}`}
        aria-label="사이드바 내비게이션"
        aria-hidden={!open}
      >
        <div className="drawer-header">
          <div className="drawer-brand">
            <img src="/ideamory-logo.png" alt="Ideamory 로고" />
            <strong>IDEAMORY</strong>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="메뉴 닫기"
          >
            <X size={18} />
          </button>
        </div>

        <div className="drawer-section drawer-section-first">
          <p className="drawer-caption">LIBRARY</p>
          <button
            type="button"
            className={`drawer-item ${viewMode === "ALL" ? "selected" : ""}`}
            onClick={onSelectAllMemos}
          >
            <Archive size={17} aria-hidden="true" />
            전체 메모
            <span>{totalMemoCount}</span>
          </button>

          {categories.map((category) => {
            const hasSuggestion = suggestionCategoryIds.has(category.id);
            return (
              <button
                key={category.id}
                type="button"
                className={`drawer-item ${
                  viewMode === "CATEGORY" && selectedCategoryId === category.id
                    ? "selected"
                    : ""
                }`}
                onClick={() => onSelectCategory(category.id)}
              >
                <span
                  className="dot"
                  style={
                    hasSuggestion
                      ? {
                          background: "#E9A14E",
                          boxShadow: "0 0 8px rgba(233, 161, 78, 0.55)",
                        }
                      : undefined
                  }
                />
                {category.name}
                <span>{category.memoCount ?? 0}</span>
              </button>
            );
          })}
        </div>

        <div className="drawer-bottom">
          <button
            type="button"
            className={`drawer-item ${viewMode === "TRASH" ? "selected" : ""}`}
            onClick={onSelectTrash}
          >
            <Trash2 size={17} aria-hidden="true" />
            휴지통
            <span>30일</span>
          </button>

          <AccountSection
            accountStatusLabel={accountStatusLabel}
            isGuest={isGuest}
            isMutating={isMutating}
            onOpenSocialSheet={onOpenSocialSheet}
            onResetGuestData={onResetGuestData}
          />
        </div>
      </aside>
    </>
  );
}
