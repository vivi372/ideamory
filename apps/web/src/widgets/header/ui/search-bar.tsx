"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useViewStore } from "../../../shared/model/view-store";

/**
 * 상단 통합 헤더에 상시 노출되는 글로벌 하이브리드 검색바 위젯입니다.
 *
 * [핵심 인터랙션]
 * 1. **명시적 검색 실행**: 입력 도중에는 API를 호출하지 않고, `[Enter]` 키 또는
 *    우측 `[검색]` 버튼 터치 시에만 `setSearchQuery`를 갱신하여 FTS+Vector 검색을 실행합니다.
 * 2. **한글 IME 조합 방어**: 한글 자모 조합 중(`e.nativeEvent.isComposing === true`) 엔터 입력으로
 *    검색이 중복/조기 트리거되는 현상을 방지합니다.
 * 3. **글로벌 단축키**: `Cmd + K` (macOS) 또는 `Ctrl + K` 입력 시 검색 인풋으로 즉시 포커스를 이동합니다.
 * 4. **0ms 복귀**: `[✕]` 버튼 클릭 또는 빈 문자열 제출 시 기본 타임라인 캐시로 즉시 복귀합니다.
 *
 * @returns 상단 헤더 검색바 JSX
 */
export function SearchBar() {
  const searchQuery = useViewStore((state) => state.searchQuery);
  const setSearchQuery = useViewStore((state) => state.setSearchQuery);
  const clearSearch = useViewStore((state) => state.clearSearch);

  const [draft, setDraft] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handleGlobalShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, []);

  const executeSearch = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      clearSearch();
      return;
    }
    setSearchQuery(trimmed);
  };

  const handleClear = () => {
    setDraft("");
    clearSearch();
    inputRef.current?.focus();
  };

  return (
    <div className="header-search">
      <Search size={17} aria-hidden="true" className="shrink-0" />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        value={draft}
        placeholder="기억 속에서 찾기"
        aria-label="메모 하이브리드 검색"
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (next === "" && searchQuery !== "") {
            clearSearch();
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            handleClear();
            inputRef.current?.blur();
            return;
          }
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault();
            executeSearch();
          }
        }}
      />
      {draft ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label="검색어 지우기"
          title="검색어 지우기"
        >
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
