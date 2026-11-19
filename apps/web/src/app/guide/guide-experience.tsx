"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { isCapacitorNative } from "@/shared/lib/native-bridge";
import { GuideFeatureSections } from "./_components/guide-feature-sections";
import { GuideHero } from "./_components/guide-hero";

/**
 * Ideamory 온보딩 인터랙티브 사용 가이드 조합 컴포넌트입니다.
 * 상단 Sticky Header, Hero 데모, 5대 기능 섹션, 하단 플로팅 CTA를 조합하여 렌더링합니다.
 *
 * @returns 가이드 페이지 JSX 엘리먼트
 */
export default function GuideExperience() {
  const router = useRouter();

  /**
   * 기존 Ideamory 인스턴스로 자연스럽게 복귀합니다.
   * - 외부 새 탭(`window.opener`)으로 열린 웹 가이드인 경우 탭을 닫아 원래 탭으로 돌아갑니다.
   * - 동일 앱/탭 내부에서 이동한 경우 히스토리 뒤로가기 또는 메인 타임라인으로 복귀합니다.
   */
  const handleReturnToApp = (options?: { focusCapture?: boolean }) => {
    if (
      typeof window !== "undefined" &&
      window.opener &&
      !window.opener.closed &&
      !isCapacitorNative()
    ) {
      window.close();
      // 브라우저 보안 정책으로 window.close()가 차단된 경우에만 현재 탭에서 메인으로 폴백
      window.setTimeout(() => {
        if (!window.closed) {
          router.replace(options?.focusCapture ? "/?focus=capture#capture" : "/");
        }
      }, 120);
      return;
    }

    if (options?.focusCapture) {
      router.replace("/?focus=capture#capture");
      return;
    }

    router.replace("/");
  };

  return (
    <main className="guide-page">
      <header className="guide-header">
        <button
          type="button"
          className="guide-back"
          onClick={() => handleReturnToApp()}
          aria-label="메인 타임라인으로 돌아가기"
        >
          <ArrowLeft size={19} />
        </button>
        <button
          type="button"
          className="guide-brand"
          onClick={() => handleReturnToApp()}
          aria-label="Ideamory 메인으로 돌아가기"
        >
          <img src="/ideamory-logo.png" alt="Ideamory 로고" />
          <span>IDEAMORY</span>
        </button>
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
        <button
          type="button"
          className="guide-cta"
          onClick={() => handleReturnToApp({ focusCapture: true })}
        >
          메모 남기러 돌아가기 <ArrowRight size={17} />
        </button>
      </div>
    </main>
  );
}
