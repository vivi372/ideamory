"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  Archive,
  Check,
  Clipboard,
  Clock3,
  ExternalLink,
  Globe,
  Layers3,
  Menu,
  Network,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { GUIDE_FEATURES, type GuideFeatureMeta } from "./guide-data";

/**
 * 기능 데모 섹션의 공통 프레임(번호, 라벨, 제목, 설명, 비주얼 슬롯)을 렌더링합니다.
 *
 * @param props 섹션 메타데이터 및 데모 비주얼 children
 * @returns 섹션 카드 JSX
 */
function GuideSectionFrame({
  feature,
  children,
}: {
  feature: GuideFeatureMeta;
  children: ReactNode;
}) {
  return (
    <section className="guide-feature" id={feature.id}>
      <div className="feature-heading">
        <span className="feature-index">{feature.number}</span>
        <div className="min-w-0">
          <p className="feature-eyebrow">{feature.eyebrow}</p>
          <h2>{feature.title}</h2>
          <p>{feature.text}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * 문두 `@카테고리` 지시어를 파싱해 카테고리와 본문을 분리하는 데모용 헬퍼입니다.
 */
function parseDirectiveDemo(raw: string): { category: string; body: string } {
  const match = raw.trim().match(/^@([^\s]+)\s+([\s\S]+)$/);
  if (!match) {
    return { category: "생각", body: raw.trim() || "다음 주 회의 안건" };
  }
  return {
    category: match[1].slice(0, 10),
    body: match[2].trim(),
  };
}

/**
 * `/guide` 페이지의 5대 핵심 기능 인터랙티브 데모 섹션 목록입니다.
 * 실제 Ideamory UI 컴포넌트(인라인 편집 카드, 캡처 바, 클립보드 칩, 관련 메모 필터 배너,
 * 사이드바 드로어 + AI 병합 배너)와 동일한 구조와 동작을 제공합니다.
 *
 * @returns 5개 기능 데모 섹션 컨테이너 JSX
 */
export function GuideFeatureSections() {
  // 01단계: 카드 본문 클릭 인라인 편집 데모 상태 (현행 InlineEditor와 동일하게 Blur/Enter 저장 + RotateCcw 복원)
  const [quickMemoBody, setQuickMemoBody] = useState("회의 전에 떠오른 질문 하나");
  const [isEditingQuick, setIsEditingQuick] = useState(false);
  const [quickDraft, setQuickDraft] = useState(quickMemoBody);
  const quickCommittedRef = useRef(false);

  // 02단계: 문두 @카테고리 캡처 바 데모 상태
  const [directiveInput, setDirectiveInput] = useState("@아이디어 다음 주 회의 안건");
  const [directiveResult, setDirectiveResult] = useState(() =>
    parseDirectiveDemo("@아이디어 다음 주 회의 안건")
  );

  // 03단계: 클립보드 링크 칩 데모 상태
  const [showClipboardChip, setShowClipboardChip] = useState(true);

  // 04단계: 하이브리드 검색 & 관련 메모 1-Depth 필터 배너 상태
  const [search, setSearch] = useState("");
  const [relatedFilterActive, setRelatedFilterActive] = useState(false);

  // 05단계: 사이드바 드로어 카테고리 선택 & AI 병합 제안 상태
  const [activeDrawerItem, setActiveDrawerItem] = useState<"ALL" | "IDEA" | "PROJECT">(
    "IDEA"
  );
  const [mergeState, setMergeState] = useState<"suggestion" | "merged" | "kept">(
    "suggestion"
  );

  // 06단계: 제텔카스텐 지식망 유사도 슬라이더 & 노드 선택 데모 상태
  const [graphThreshold, setGraphThreshold] = useState<number>(72);
  const [selectedGraphNode, setSelectedGraphNode] = useState<
    "rag" | "vector" | "cache"
  >("rag");

  const handleCommitQuickEdit = () => {
    if (quickCommittedRef.current) {
      return;
    }
    quickCommittedRef.current = true;

    const trimmed = quickDraft.trim();
    if (!trimmed || trimmed === quickMemoBody.trim()) {
      setQuickDraft(quickMemoBody);
      setIsEditingQuick(false);
      return;
    }
    setQuickMemoBody(trimmed);
    setIsEditingQuick(false);
  };

  const handleCancelQuickEdit = () => {
    quickCommittedRef.current = true;
    setQuickDraft(quickMemoBody);
    setIsEditingQuick(false);
  };

  const handleApplyDirective = () => {
    setDirectiveResult(parseDirectiveDemo(directiveInput));
  };

  return (
    <div className="guide-section-list" id="guide-features">
      {/* 01. 빠른 기록 & 카드 본문 인라인 수정 */}
      <GuideSectionFrame feature={GUIDE_FEATURES[0]}>
        <div className="feature-visual quick-visual">
          <article className={`note-card guide-demo-card${isEditingQuick ? " is-editing" : ""}`}>
            <div className="note-meta">
              <time>방금 전</time>
              <div className="note-meta-actions">
                <span className="category-label">생각</span>
                <span className="guide-trash-icon" aria-hidden="true">
                  <Trash2 size={13} />
                </span>
              </div>
            </div>

            {isEditingQuick ? (
              <div style={{ position: "relative" }}>
                <textarea
                  value={quickDraft}
                  rows={2}
                  onChange={(event) => setQuickDraft(event.target.value)}
                  onBlur={handleCommitQuickEdit}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      handleCancelQuickEdit();
                      return;
                    }
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      handleCommitQuickEdit();
                    }
                  }}
                  aria-label="가이드 카드 인라인 편집"
                  autoFocus
                />
                <div
                  className="note-actions inline-actions inline-editor-actions"
                  style={{ position: "absolute", right: 0, bottom: 2, zIndex: 2, margin: 0 }}
                >
                  <button
                    type="button"
                    aria-label="수정 취소 및 복원"
                    title="수정 취소 및 복원"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      handleCancelQuickEdit();
                    }}
                  >
                    <RotateCcw size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="note-copy"
                onClick={() => {
                  quickCommittedRef.current = false;
                  setQuickDraft(quickMemoBody);
                  setIsEditingQuick(true);
                }}
                aria-label="카드 본문 눌러서 수정 체험"
              >
                {quickMemoBody}
              </button>
            )}
          </article>

          <span className="visual-footnote">
            <Clock3 size={13} className="shrink-0" />
            <span>
              본문을 눌러 수정 후 바깥이나 Enter로 저장 (빈 값은 자동 복원)
            </span>
          </span>
        </div>
      </GuideSectionFrame>

      {/* 02. 문두 @로 빠르게 분류 (실제 캡처 바 + 결과 카드) */}
      <GuideSectionFrame feature={GUIDE_FEATURES[1]}>
        <div className="feature-visual directive-visual">
          <span className="compare-label">1. 하단 캡처 바에 입력</span>
          <div className="capture-box guide-capture-mock">
            <input
              type="text"
              value={directiveInput}
              onChange={(event) => setDirectiveInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  handleApplyDirective();
                }
              }}
              placeholder="@카테고리 내용..."
              aria-label="문두 카테고리 입력 체험"
            />
            <button
              type="button"
              className="save-button shrink-0"
              onClick={handleApplyDirective}
              aria-label="문두 카테고리 분리 체험"
            >
              {directiveInput.trim() ? <Check size={17} /> : <Plus size={18} />}
            </button>
          </div>

          <span className="compare-label directive-step-label">2. 저장된 메모 카드</span>
          <article className="note-card guide-demo-card mb-0">
            <div className="note-meta">
              <time>방금 전</time>
              <div className="note-meta-actions">
                <span className="category-label">{directiveResult.category}</span>
              </div>
            </div>
            <div className="note-copy">{directiveResult.body}</div>
          </article>

          <span className="visual-footnote">
            <span>
              문두 <b>@카테고리</b>는 본문에서 빠지고 상단 배지로 분리돼요
            </span>
          </span>
        </div>
      </GuideSectionFrame>

      {/* 03. 링크는 미리보기로 저장 (실제 클립보드 칩 + OGP 카드) */}
      <GuideSectionFrame feature={GUIDE_FEATURES[2]}>
        <div className="feature-visual link-visual">
          {showClipboardChip ? (
            <div className="guide-clipboard-chip">
              <button
                type="button"
                onClick={() => setShowClipboardChip(true)}
                aria-label="링크 붙여넣기 예시"
              >
                <Clipboard size={14} aria-hidden="true" />
                <span>링크 붙여넣기</span>
              </button>
              <button
                type="button"
                onClick={() => setShowClipboardChip(false)}
                aria-label="클립보드 칩 닫기 예시"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="guide-clipboard-restore"
              onClick={() => setShowClipboardChip(true)}
            >
              클립보드 링크 칩 다시 보기
            </button>
          )}

          <div className="ogp-card guide-ogp-demo">
            <div className="ogp-icon" aria-hidden="true">
              <Globe size={15} />
            </div>
            <div>
              <strong>아이디어를 키우는 작은 기록의 힘</strong>
              <span>좋은 생각을 놓치지 않고 다시 만나는 방법</span>
              <small>ideamory.app</small>
            </div>
            <ExternalLink size={14} aria-hidden="true" />
          </div>
          <span className="visual-footnote">
            안드로이드 공유하기(Share)로도 앱 입력창에 바로 담겨요
          </span>
        </div>
      </GuideSectionFrame>

      {/* 04. 문맥으로 찾고 연결하기 (Enter 검색 + 실제 관련 메모 필터 배너) */}
      <GuideSectionFrame feature={GUIDE_FEATURES[3]}>
        <div className="feature-visual search-visual">
          <label className="header-search guide-search-bar">
            <Search size={15} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="아이디어 찾기"
              aria-label="문맥 검색 체험"
              enterKeyHint="search"
            />
          </label>

          {relatedFilterActive ? (
            <div className="related-filter-banner guide-related-banner">
              <div className="min-w-0 flex items-center gap-2">
                <Layers3 size={14} className="shrink-0" aria-hidden="true" />
                <span className="truncate">관련 메모 2건 필터 중</span>
              </div>
              <button
                type="button"
                onClick={() => setRelatedFilterActive(false)}
                aria-label="관련 메모 필터 해제"
              >
                <X size={13} />
              </button>
            </div>
          ) : null}

          <div className="search-match-label">
            {relatedFilterActive
              ? "선택한 메모와 연결된 기록"
              : search
                ? "의미가 가까운 메모"
                : "문맥으로 찾은 메모"}{" "}
            <span>2건</span>
          </div>

          <div className="search-result">
            <span>업무 리듬</span>
            <strong>오전엔 알림을 끄고 글을 쓰면 흐름이 이어진다</strong>
            <small>“집중” 대신 “흐름”으로 찾아도 의미로 발견돼요</small>
          </div>

          {relatedFilterActive ? (
            <div className="search-result">
              <span>아이디어</span>
              <strong>산책하고 돌아오면 새로운 생각이 잘 떠오른다</strong>
              <small>유사도 높은 관련 메모</small>
            </div>
          ) : (
            <div className="related-row">
              <button
                type="button"
                className="related-chip related-count-chip"
                onClick={() => setRelatedFilterActive(true)}
              >
                <span className="related-dot" aria-hidden="true" />
                <span>관련 메모 2건</span>
              </button>
            </div>
          )}

          <span className="visual-footnote">
            {relatedFilterActive
              ? "상단 필터 배너의 ✕를 누르면 전체 목록으로 돌아가요"
              : "관련 메모 칩을 누르면 상단 필터 배너와 함께 모아볼 수 있어요"}
          </span>
        </div>
      </GuideSectionFrame>

      {/* 05. 사이드바 메뉴 카테고리 탐색 & AI 병합 제안 */}
      <GuideSectionFrame feature={GUIDE_FEATURES[4]}>
        <div className="feature-visual category-visual">
          <div className="category-demo-head">
            <span className="inline-flex items-center gap-1.5">
              <Menu size={13} /> 사이드바 메뉴 (좌측 스와이프)
            </span>
            <span className="inline-flex items-center gap-1 text-[#E9A14E]">
              <span className="guide-orange-dot" aria-hidden="true" /> 병합 알림
            </span>
          </div>

          <div className="guide-drawer-preview">
            <button
              type="button"
              className={`drawer-item ${activeDrawerItem === "ALL" ? "selected" : ""}`}
              onClick={() => setActiveDrawerItem("ALL")}
            >
              <Archive size={15} aria-hidden="true" />
              전체 메모
              <span>6</span>
            </button>
            <button
              type="button"
              className={`drawer-item ${activeDrawerItem === "IDEA" ? "selected" : ""}`}
              onClick={() => setActiveDrawerItem("IDEA")}
            >
              <span
                className="dot"
                style={{
                  background: "#E9A14E",
                  boxShadow: "0 0 8px rgba(233, 161, 78, 0.55)",
                }}
              />
              아이디어
              <span>4</span>
            </button>
            <button
              type="button"
              className={`drawer-item ${activeDrawerItem === "PROJECT" ? "selected" : ""}`}
              onClick={() => setActiveDrawerItem("PROJECT")}
            >
              <span className="dot" />
              프로젝트
              <span>2</span>
            </button>
          </div>

          <div className="guide-merge-banner">
            <span className="guide-orange-dot shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <strong>
                {mergeState === "merged"
                  ? "‘프로젝트’로 하나로 합쳤어요"
                  : mergeState === "kept"
                    ? "두 카테고리를 그대로 유지해요"
                    : "‘프로젝트’ 카테고리와 비슷해요. 하나로 합칠까요?"}
              </strong>
              <small>
                {mergeState === "suggestion"
                  ? "유사도 88% · 메모는 손실 없이 모두 유지됩니다"
                  : "메뉴나 카드 상단 배지에서 언제든 바꿀 수 있어요."}
              </small>
            </div>
            {mergeState === "suggestion" ? (
              <div className="merge-actions">
                <button type="button" onClick={() => setMergeState("merged")}>
                  합치기
                </button>
                <button
                  type="button"
                  className="merge-dismiss"
                  onClick={() => setMergeState("kept")}
                >
                  합치지 않기
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="merge-reset"
                onClick={() => setMergeState("suggestion")}
              >
                되돌리기
              </button>
            )}
          </div>

          <span className="visual-footnote">정리는 조용하게, 결정은 내가 직접</span>
        </div>
      </GuideSectionFrame>

      <GuideSectionFrame feature={GUIDE_FEATURES[5]}>
        <div className="guide-visual">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1B1917] px-3.5 py-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-[#E5DFD7]">
              <Network size={14} className="text-[#E9A14E]" />
              유사도 기준 {(graphThreshold / 100).toFixed(2)}
            </span>
            <input
              type="range"
              min={60}
              max={90}
              step={2}
              value={graphThreshold}
              onChange={(event) => setGraphThreshold(Number(event.target.value))}
              aria-label="지식망 유사도 기준 조절"
              className="h-1.5 w-28 accent-[#E9A14E]"
            />
          </div>

          <div className="relative mt-2.5 h-44 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#141210]">
            <svg
              viewBox="0 0 320 176"
              className="h-full w-full"
              aria-label="제텔카스텐 지식망 미리보기"
            >
              {/* RAG <-> Vector (유사도 0.86) */}
              {graphThreshold <= 86 && (
                <line
                  x1="96"
                  y1="66"
                  x2="220"
                  y2="58"
                  stroke="#E9A14E"
                  strokeOpacity={0.75}
                  strokeWidth={2.2}
                />
              )}
              {/* RAG <-> Cache (유사도 0.72) */}
              {graphThreshold <= 72 && (
                <line
                  x1="96"
                  y1="66"
                  x2="164"
                  y2="132"
                  stroke="#8A8279"
                  strokeOpacity={0.6}
                  strokeWidth={1.6}
                  strokeDasharray="3 3"
                />
              )}
              {/* Vector <-> Cache (유사도 0.64) */}
              {graphThreshold <= 64 && (
                <line
                  x1="220"
                  y1="58"
                  x2="164"
                  y2="132"
                  stroke="#8A8279"
                  strokeOpacity={0.45}
                  strokeWidth={1.3}
                />
              )}
            </svg>

            <button
              type="button"
              onClick={() => setSelectedGraphNode("rag")}
              className={`absolute left-[18%] top-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selectedGraphNode === "rag"
                  ? "border-[#E9A14E] bg-[#2D241C] text-[#F5EFE6] shadow-[0_0_16px_rgba(233,161,78,0.32)]"
                  : "border-white/15 bg-[#221F1C] text-[#D1C9BE]"
              }`}
            >
              RAG 검색 설계
            </button>

            <button
              type="button"
              onClick={() => setSelectedGraphNode("vector")}
              className={`absolute left-[72%] top-[24%] -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selectedGraphNode === "vector"
                  ? "border-[#E9A14E] bg-[#2D241C] text-[#F5EFE6] shadow-[0_0_16px_rgba(233,161,78,0.32)]"
                  : "border-white/15 bg-[#221F1C] text-[#D1C9BE]"
              }`}
            >
              pgvector 인덱스
            </button>

            <button
              type="button"
              onClick={() => setSelectedGraphNode("cache")}
              className={`absolute left-[50%] top-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                selectedGraphNode === "cache"
                  ? "border-[#E9A14E] bg-[#2D241C] text-[#F5EFE6] shadow-[0_0_16px_rgba(233,161,78,0.32)]"
                  : "border-white/15 bg-[#221F1C] text-[#D1C9BE]"
              }`}
            >
              임베딩 캐시 전략
            </button>
          </div>

          <div className="mt-2.5 rounded-xl border border-white/10 bg-[#1B1917] px-3.5 py-2.5 text-xs text-[#CFC7BC]">
            {selectedGraphNode === "rag" && (
              <span>
                <strong className="text-[#F3ECE2]">RAG 검색 설계</strong> · 연관
                노드{" "}
                {graphThreshold <= 72
                  ? "2건 (pgvector, 캐시)"
                  : graphThreshold <= 86
                    ? "1건 (pgvector)"
                    : "0건"}
              </span>
            )}
            {selectedGraphNode === "vector" && (
              <span>
                <strong className="text-[#F3ECE2]">pgvector 인덱스</strong> ·
                유사도 0.86 연결
              </span>
            )}
            {selectedGraphNode === "cache" && (
              <span>
                <strong className="text-[#F3ECE2]">임베딩 캐시 전략</strong> ·
                슬라이더를 낮추면 약한 연결도 함께 탐색합니다
              </span>
            )}
          </div>

          <span className="visual-footnote">
            노드를 탭하면 하단 시트에서 바로 읽고 수정할 수 있어요
          </span>
        </div>
      </GuideSectionFrame>
    </div>
  );
}
