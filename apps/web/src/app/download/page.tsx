"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DownloadContentSection } from "./_components/download-sections";

/**
 * Ideamory Android(Capacitor) 앱 임시 배포 및 실기기 설치 안내 페이지(`/download`)입니다.
 *
 * 따뜻한 다크 차콜(`#121110`) + 소프트 앰버 골드(`#E5A95C`) 디자인 토큰을 반영하여
 * APK 다운로드, Android 공유하기(Share Intent) 및 0.1초 퀵 캡처 앱 사용 가이드를 제공합니다.
 *
 * @returns 임시 앱 다운로드 페이지 JSX
 */
export default function AppDownloadPage() {
  return (
    <main
      className="guide-page"
      style={{
        minHeight: "100vh",
        paddingBottom: 72,
        background:
          "radial-gradient(circle at 50% 10%, rgba(229, 169, 92, 0.1), transparent 48%), #121110",
      }}
    >
      <header className="guide-header">
        <Link href="/" className="guide-back" aria-label="홈으로 돌아가기">
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
        <div className="guide-brand">
          <img
            src="/ideamory-app-icon.jpg"
            alt="Ideamory 앱 아이콘"
            style={{ borderRadius: 8 }}
          />
          <span>IDEAMORY</span>
        </div>
        <span className="guide-header-label">ANDROID APK</span>
      </header>

      <DownloadContentSection />
    </main>
  );
}
