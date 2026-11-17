"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Layers3,
  Link2,
  Search,
  X,
} from "lucide-react";
import { GUIDE_FEATURES, type GuideFeatureMeta } from "./guide-data";

/**
 * 기능 데모 섹션의 공통 프레임(번호, 영문 eyebrow, 제목, 설명, 비주얼 슬롯)을 렌더링합니다.
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
        <div>
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
 * `/guide` 페이지의 5대 핵심 기능 인터랙티브 데모 섹션 목록입니다.
 * 하이브리드 검색, 관련 메모 토글, 카테고리 정리/병합 체험 상태를 독립 관리합니다.
 *
 * @returns 5개 기능 데모 섹션 컨테이너 JSX
 */
export function GuideFeatureSections() {
  const [showRelated, setShowRelated] = useState(false);
  const [search, setSearch] = useState("");
  const [showCategory, setShowCategory] = useState(true);
  const [mergeState, setMergeState] = useState<"suggestion" | "merged" | "kept">(
    "suggestion"
  );

  return (
    <div className="guide-section-list" id="guide-features">
      <GuideSectionFrame feature={GUIDE_FEATURES[0]}>
        <div className="feature-visual quick-visual">
          <div className="quick-line">
            <span className="quick-time">방금 전</span>
            <span className="quick-tag">생각</span>
          </div>
          <strong>회의 전에 떠오른 질문 하나</strong>
          <div className="quick-wave">
            {Array.from({ length: 15 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
          <span className="visual-footnote">
            <Clock3 size={13} /> 기록에 걸린 시간 <b>0.1초</b>
          </span>
        </div>
      </GuideSectionFrame>

      <GuideSectionFrame feature={GUIDE_FEATURES[1]}>
        <div className="feature-visual directive-visual">
          <div className="before-after">
            <div className="before-card">
              <span className="compare-label">BEFORE · 입력</span>
              <p>
                <b>@아이디어</b> 다음 주 회의 안건
              </p>
            </div>
            <ArrowRight className="compare-arrow" size={18} />
            <div className="after-card">
              <span className="compare-label">AFTER · 저장</span>
              <span className="mini-category">아이디어</span>
              <p>다음 주 회의 안건</p>
              <Check size={15} />
            </div>
          </div>
          <span className="visual-footnote">
            분류 명령은 메모에서 자동으로 분리돼요
          </span>
        </div>
      </GuideSectionFrame>

      <GuideSectionFrame feature={GUIDE_FEATURES[2]}>
        <div className="feature-visual link-visual">
          <div className="clipboard-chip">
            <Link2 size={14} /> 복사한 링크 붙여넣기 <X size={13} />
          </div>
          <div className="ogp-mock">
            <div className="ogp-art">
              <span>
                FIELD
                <br />
                NOTES
              </span>
              <div className="ogp-art-orbit" />
            </div>
            <div className="ogp-copy">
              <span>DESIGN · 6 MIN READ</span>
              <strong>아이디어를 키우는 작은 기록의 힘</strong>
              <p>좋은 생각을 놓치지 않고 다시 만나는 방법</p>
              <small>ideamory.guide</small>
            </div>
          </div>
          <span className="visual-footnote">링크 하나도 다시 읽기 좋은 메모로</span>
        </div>
      </GuideSectionFrame>

      <GuideSectionFrame feature={GUIDE_FEATURES[3]}>
        <div className="feature-visual search-visual">
          <label className="guide-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="예: 집중이 잘됐던 순간"
              aria-label="문맥 검색 체험"
            />
            <kbd>↵</kbd>
          </label>
          <div className="search-match-label">
            {search ? "의미가 가까운 메모" : "문맥으로 찾은 메모"} <span>3건</span>
          </div>
          <div className="search-result">
            <span>업무 리듬</span>
            <strong>오전엔 알림을 끄고 글을 쓰면 흐름이 이어진다</strong>
            <small>“집중” 대신 “흐름”으로 찾아도 발견</small>
          </div>
          <div className="search-result">
            <span>작은 습관</span>
            <strong>산책하고 돌아오면 새로운 생각이 잘 떠오른다</strong>
            <small>비슷한 맥락의 기록</small>
          </div>
          <button
            type="button"
            className="related-expand"
            onClick={() => setShowRelated((open) => !open)}
          >
            <span>
              <Layers3 size={14} /> 관련 메모 2건
            </span>
            <ChevronDown className={showRelated ? "rotated" : ""} size={15} />
          </button>
          {showRelated && (
            <div className="related-expanded">
              <span>아이디어를 키우는 메모</span>
              <span>회의 전에 떠오른 질문 하나</span>
            </div>
          )}
        </div>
      </GuideSectionFrame>

      <GuideSectionFrame feature={GUIDE_FEATURES[4]}>
        <div className="feature-visual category-visual">
          <div className="category-demo-head">
            <span>내 카테고리</span>
            <span>자동 정리</span>
          </div>
          {showCategory && (
            <div className="category-pill-row">
              <span className="category-pill-demo">
                아이디어 <b>4</b>
              </span>
              <span className="category-pill-demo">
                프로젝트 <b>2</b>
              </span>
              <span className="category-vanishing">
                미분류 <b>0</b>
              </span>
              <button
                type="button"
                className="hide-category"
                onClick={() => setShowCategory(false)}
                aria-label="빈 카테고리 숨기기"
              >
                <X size={13} />
              </button>
            </div>
          )}
          {!showCategory && (
            <div className="hidden-category-note">
              <Check size={14} /> 비어 있는 카테고리는 자동으로 숨겨져요
            </div>
          )}
          <div className="merge-card">
            <span className="merge-dot" />
            <div>
              <strong>
                {mergeState === "merged"
                  ? "프로젝트로 정리했어요"
                  : mergeState === "kept"
                    ? "두 카테고리를 그대로 유지해요"
                    : "비슷한 카테고리가 있어요"}
              </strong>
              <small>
                {mergeState === "suggestion"
                  ? "아이디어와 영감 메모를 합칠까요?"
                  : "언제든 카테고리에서 다시 바꿀 수 있어요."}
              </small>
            </div>
            {mergeState === "suggestion" ? (
              <div className="merge-actions">
                <button type="button" onClick={() => setMergeState("merged")}>
                  합치기
                </button>
                <button type="button" onClick={() => setMergeState("kept")}>
                  유지
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
    </div>
  );
}
