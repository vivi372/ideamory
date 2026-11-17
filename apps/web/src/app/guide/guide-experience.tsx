"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Layers3,
  Search,
  Sparkles,
  Link2,
  X,
} from "lucide-react";

const GUIDE_FEATURES = [
  {
    number: "01",
    title: "떠오른 순간, 바로 저장",
    text: "정리할 필요 없이 생각나는 그대로 적어두세요. 0.1초면 기록이 끝나요.",
  },
  {
    number: "02",
    title: "문두 @로 빠르게 분류",
    text: "문장 앞에 @카테고리를 붙이면 본문에서는 빠지고, 메모가 바로 분류돼요.",
  },
  {
    number: "03",
    title: "링크는 미리보기로 저장",
    text: "링크를 붙여 넣으면 제목과 설명을 함께 담아 나중에 다시 찾기 쉬워져요.",
  },
  {
    number: "04",
    title: "문맥으로 찾고 연결하기",
    text: "정확한 단어가 기억나지 않아도 의미가 가까운 메모와 관련 기록을 발견해요.",
  },
  {
    number: "05",
    title: "카테고리는 알아서 정리",
    text: "비어 있는 카테고리는 숨기고, 겹치는 분류는 한 번에 정돈할 수 있어요.",
  },
] as const;

/**
 * Ideamory 온보딩 인터랙티브 사용 가이드 컴포넌트입니다.
 * 0.1초 퀵 캡처, @카테고리 파싱, OGP 링크 미리보기, 하이브리드 검색, 스마트 카테고리 병합을 체험할 수 있습니다.
 *
 * @returns 가이드 페이지 JSX 엘리먼트
 */
export default function GuideExperience() {
  const [saved, setSaved] = useState(false);
  const [showRelated, setShowRelated] = useState(false);
  const [search, setSearch] = useState("");
  const [showCategory, setShowCategory] = useState(true);
  const [mergeState, setMergeState] = useState<"suggestion" | "merged" | "kept">(
    "suggestion"
  );

  return (
    <main className="guide-page">
      <header className="guide-header">
        <Link href="/" className="guide-back" aria-label="메인 타임라인으로 돌아가기">
          <ArrowLeft size={19} />
        </Link>
        <Link href="/" className="guide-brand">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Ideamory%20%ED%88%AC%EB%AA%85%20%EB%A1%9C%EA%B3%A0-sLCCbbfwzyk9vbHfpk0mPP2i9elB5l.png"
            alt="Ideamory 로고"
          />
          <span>IDEAMORY</span>
        </Link>
        <span className="guide-header-label">QUICK GUIDE</span>
      </header>

      <div className="guide-content">
        <section className="guide-hero" aria-labelledby="guide-title">
          <div className="guide-kicker">
            <span className="guide-kicker-dot" /> YOUR THOUGHTS, IN CONTEXT
          </div>
          <h1 id="guide-title">
            생각은 가볍게 담고,
            <br />
            <span>의미는 자연스럽게 이어져요.</span>
          </h1>
          <p className="guide-lede">
            정리보다 먼저 기록하세요.
            <br />
            Ideamory가 당신의 생각을 기억하고 연결합니다.
          </p>
          <div className="guide-hero-demo">
            <div className="hero-demo-top">
              <span className="demo-live-dot" /> QUICK CAPTURE <span>00:00.1</span>
            </div>
            <div className={`hero-note-preview ${saved ? "is-saved" : ""}`}>
              <span className="mini-category">아이디어</span>
              <p>다음 주 회의 안건에 넣을 것</p>
              <Check size={16} />
            </div>
            <div className="hero-input-mock">
              <span>떠오른 생각을 기록하세요...</span>
              <button
                type="button"
                onClick={() => {
                  setSaved(true);
                  window.setTimeout(() => setSaved(false), 1800);
                }}
                aria-label="빠르게 메모 저장"
              >
                <ArrowUpRight size={17} />
              </button>
            </div>
            <span className="hero-demo-caption">
              적고, 누르고, 다시 생각으로 돌아가기
            </span>
          </div>
          <a className="guide-scroll-link" href="#guide-features">
            30초 안에 둘러보기 <ArrowDown size={14} />
          </a>
        </section>

        <div className="guide-section-list" id="guide-features">
          <section className="guide-feature" id="quick-capture">
            <div className="feature-heading">
              <span className="feature-index">{GUIDE_FEATURES[0].number}</span>
              <div>
                <p className="feature-eyebrow">CAPTURE IN A MOMENT</p>
                <h2>{GUIDE_FEATURES[0].title}</h2>
                <p>{GUIDE_FEATURES[0].text}</p>
              </div>
            </div>
            <div className="feature-visual quick-visual">
              <div className="quick-line">
                <span className="quick-time">방금 전</span>
                <span className="quick-tag">생각</span>
              </div>
              <strong>회의 전에 떠오른 질문 하나</strong>
              <div className="quick-wave">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <span className="visual-footnote">
                <Clock3 size={13} /> 기록에 걸린 시간 <b>0.1초</b>
              </span>
            </div>
          </section>

          <section className="guide-feature" id="directive">
            <div className="feature-heading">
              <span className="feature-index">{GUIDE_FEATURES[1].number}</span>
              <div>
                <p className="feature-eyebrow">DIRECTIVE FIRST</p>
                <h2>{GUIDE_FEATURES[1].title}</h2>
                <p>{GUIDE_FEATURES[1].text}</p>
              </div>
            </div>
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
          </section>

          <section className="guide-feature" id="link-preview">
            <div className="feature-heading">
              <span className="feature-index">{GUIDE_FEATURES[2].number}</span>
              <div>
                <p className="feature-eyebrow">LINK, READY TO RETURN</p>
                <h2>{GUIDE_FEATURES[2].title}</h2>
                <p>{GUIDE_FEATURES[2].text}</p>
              </div>
            </div>
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
          </section>

          <section className="guide-feature" id="hybrid-search">
            <div className="feature-heading">
              <span className="feature-index">{GUIDE_FEATURES[3].number}</span>
              <div>
                <p className="feature-eyebrow">MEANING OVER EXACT WORDS</p>
                <h2>{GUIDE_FEATURES[3].title}</h2>
                <p>{GUIDE_FEATURES[3].text}</p>
              </div>
            </div>
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
          </section>

          <section className="guide-feature" id="smart-categories">
            <div className="feature-heading">
              <span className="feature-index">{GUIDE_FEATURES[4].number}</span>
              <div>
                <p className="feature-eyebrow">LESS CLUTTER, BETTER CONTEXT</p>
                <h2>{GUIDE_FEATURES[4].title}</h2>
                <p>{GUIDE_FEATURES[4].text}</p>
              </div>
            </div>
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
          </section>
        </div>

        <section className="guide-closing">
          <Sparkles size={19} />
          <p>
            생각이 떠오르면,
            <br />
            <strong>그 순간에 담아두세요.</strong>
          </p>
          <span>나머지는 Ideamory가 이어갈게요.</span>
        </section>
      </div>

      <div className="guide-cta-wrap">
        <Link className="guide-cta" href="/?focus=capture#capture">
          메인으로 돌아가기 <ArrowRight size={17} />
        </Link>
      </div>
    </main>
  );
}
