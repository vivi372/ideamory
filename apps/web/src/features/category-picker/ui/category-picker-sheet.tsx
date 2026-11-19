"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { Plus, Search, X } from "lucide-react";
import { useCategoryPicker } from "../model/use-category-picker";

/**
 * 메모 카드 상단의 카테고리 배지 터치 시 슬라이딩 오픈되는
 * `cmdk` + `match-sorter` 기반 0ms 카테고리 수동 변경 바텀시트입니다.
 *
 * 네트워크 호출 없이 클라이언트 메모리에서 즉시 필터링하며,
 * 검색어와 일치하는 카테고리가 없으면 1~10자·이모지 배제 규칙을 검증한 뒤 즉석 생성합니다.
 *
 * @returns 카테고리 피커 바텀시트 JSX
 */
export function CategoryPickerSheet() {
  const {
    isOpen,
    currentCategoryId,
    searchTerm,
    setSearchTerm,
    validationError,
    filteredCategories,
    canCreateNew,
    handleClose,
    handleSelectCategory,
    handleCreateAndAssign,
  } = useCategoryPicker();

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleClose();
        }
      }}
    >
      {isOpen && (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="sheet-backdrop" />
          <DialogPrimitive.Content
            className="category-sheet"
            aria-describedby={undefined}
          >
            <div className="sheet-handle" />
            <div className="sheet-header">
              <div>
                <p className="sheet-kicker">RECLASSIFY MEMORY</p>
                <DialogPrimitive.Title asChild>
                  <h2>카테고리 변경</h2>
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label="카테고리 시트 닫기"
                >
                  <X size={18} />
                </button>
              </DialogPrimitive.Close>
            </div>

            <Command shouldFilter={false}>
              <div className="category-search">
                <Search size={16} aria-hidden="true" className="shrink-0" />
                <Command.Input
                  value={searchTerm}
                  onValueChange={setSearchTerm}
                  placeholder="카테고리 검색 또는 새 이름 입력 (최대 10자)"
                  aria-label="카테고리 검색 및 생성"
                  autoFocus
                />
              </div>

              {validationError ? (
                <p className="field-error" role="alert">
                  {validationError}
                </p>
              ) : null}

              <Command.List className="category-grid">
                {canCreateNew ? (
                  <Command.Item
                    value={`__create__${searchTerm.trim()}`}
                    onSelect={handleCreateAndAssign}
                    className="new-category-chip cursor-pointer"
                  >
                    <Plus size={14} aria-hidden="true" />
                    <strong>&ldquo;{searchTerm.trim()}&rdquo;</strong>
                    <span>새 카테고리 생성 및 적용</span>
                  </Command.Item>
                ) : null}

                {filteredCategories.map((category) => {
                  const isSelected = category.id === currentCategoryId;
                  return (
                    <Command.Item
                      key={category.id}
                      value={category.name}
                      onSelect={() => handleSelectCategory(category)}
                      className={`category-option cursor-pointer${
                        isSelected ? " selected" : ""
                      }`}
                    >
                      <span>{category.name}</span>
                      {category.memoCount !== undefined ? (
                        <small className="opacity-70">
                          {category.memoCount}
                        </small>
                      ) : null}
                    </Command.Item>
                  );
                })}
              </Command.List>
            </Command>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
}
