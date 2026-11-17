"use client";

import { useState } from "react";
import { ArrowDown, ArrowUpRight, Check } from "lucide-react";

/**
 * `/guide` 페이지 상단 Hero 섹션 컴포넌트입니다.
 * 0.1초 퀵 캡처 인터랙션 데모(`saved` 토글 상태)를 자체적으로 캡슐화합니다.
 *
 * @returns Hero 섹션 JSX 엘리먼트
 */
export function GuideHero() {
  const [saved, setSaved] = useState(false);

  return (
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
  );
}
