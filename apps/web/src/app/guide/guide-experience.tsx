"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { GuideFeatureSections } from "./_components/guide-feature-sections";
import { GuideHero } from "./_components/guide-hero";

/**
 * Ideamory 온보딩 인터랙티브 사용 가이드 조합 컴포넌트입니다.
 * 상단 Sticky Header, Hero 데모, 5대 기능 섹션, 하단 플로팅 CTA를 조합하여 렌더링합니다.
 *
 * @returns 가이드 페이지 JSX 엘리먼트
 */
export default function GuideExperience() {
  return (
    <main className="guide-page">
      <header className="guide-header">
        <Link href="/" className="guide-back" aria-label="메인 타임라인으로 돌아가기">
          <ArrowLeft size={19} />
        </Link>
        <Link href="/" className="guide-brand">
          <img src="/ideamory-logo.png" alt="Ideamory 로고" />
          <span>IDEAMORY</span>
        </Link>
        <span className="guide-header-label">QUICK GUIDE</span>
      </header>

      <div className="guide-content">
        <GuideHero />
        <GuideFeatureSections />

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
