"use client";

import Link from "next/link";
import {
  Download,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  APK_DOWNLOAD_HREF,
  APK_FILE_NAME,
  APK_VERSION,
  DOWNLOAD_HIGHLIGHT_FEATURES,
  type DownloadHighlightFeature,
} from "./download-data";

/**
 * 기능 식별자에 대응하는 아이콘을 반환합니다.
 *
 * @param id 기능 카드 식별자
 * @returns Lucide 아이콘 엘리먼트
 */
function renderHighlightIcon(id: DownloadHighlightFeature["id"]) {
  switch (id) {
    case "share-intent":
      return <Share2 size={16} aria-hidden="true" />;
    case "zero-splash":
      return <Zap size={16} aria-hidden="true" />;
    case "offline-and-back":
      return <WifiOff size={16} aria-hidden="true" />;
  }
}

/**
 * `/download` 페이지의 히어로 배지, 앱 아이콘, APK 다운로드 CTA 및 핵심 기능/설치 안내 카드를 렌더링합니다.
 *
 * @returns 다운로드 페이지 본문 섹션 JSX
 */
export function DownloadContentSection() {
  return (
    <section
      className="guide-content"
      style={{ paddingTop: 48, textAlign: "center" }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px solid rgba(229, 169, 92, 0.28)",
          background: "rgba(229, 169, 92, 0.1)",
          color: "#F0BE78",
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <Sparkles size={13} aria-hidden="true" />
        <span>Capacitor Android Preview · v{APK_VERSION}</span>
      </div>

      <div style={{ marginTop: 28, display: "grid", placeItems: "center" }}>
        <img
          src="/ideamory-app-icon.jpg"
          alt="Ideamory Android 앱 아이콘"
          style={{
            width: 108,
            height: 108,
            borderRadius: 26,
            objectFit: "cover",
            border: "1px solid rgba(229, 169, 92, 0.32)",
            background: "#1A1816",
            boxShadow: "0 20px 55px rgba(0, 0, 0, 0.45)",
          }}
        />
      </div>

      <h1
        style={{
          marginTop: 22,
          marginBottom: 12,
          color: "#F4EFEA",
          fontSize: "clamp(26px, 6vw, 38px)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1.25,
        }}
      >
        주머니 속 0.1초 기억 캐시,
        <br />
        <span style={{ color: "#E5A95C" }}>Ideamory Android</span>
      </h1>

      <p
        style={{
          margin: "0 auto",
          maxWidth: 440,
          color: "#A69D93",
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        웹 브라우저뿐만 아니라 유튜브·인스타·뉴스 앱에서{" "}
        <strong style={{ color: "#F4EFEA" }}>공유하기</strong> 한 번으로 생각과
        링크를 즉시 담아보세요.
      </p>

      <div
        style={{
          marginTop: 28,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <a
          href={APK_DOWNLOAD_HREF}
          download
          style={{
            height: 48,
            padding: "0 24px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 9,
            borderRadius: 999,
            background: "linear-gradient(135deg, #E5A95C, #F0BE78)",
            color: "#1C150C",
            fontSize: 14,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 10px 28px rgba(229, 169, 92, 0.22)",
          }}
        >
          <Download size={17} aria-hidden="true" />
          <span>Android APK 다운로드 (v{APK_VERSION})</span>
        </a>

        <Link
          href="/"
          style={{
            height: 48,
            padding: "0 20px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderRadius: 999,
            border: "1px solid rgba(235, 225, 212, 0.16)",
            background: "#221F1C",
            color: "#F4EFEA",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <Smartphone size={16} aria-hidden="true" />
          <span>웹으로 바로 써보기</span>
        </Link>
      </div>

      <p style={{ marginTop: 12, color: "#A69D93", fontSize: 11 }}>
        지원 환경: Android 8.0 이상 · 테스트 빌드 (파일명:{" "}
        <code>{APK_FILE_NAME}</code>)
      </p>

      <div
        style={{
          marginTop: 40,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 14,
          textAlign: "left",
        }}
      >
        {DOWNLOAD_HIGHLIGHT_FEATURES.map((feature) => (
          <div
            key={feature.id}
            className="guide-feature"
            style={{ padding: 20 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#E5A95C",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {renderHighlightIcon(feature.id)}
              <span>{feature.title}</span>
            </div>
            <p
              style={{
                margin: "10px 0 0",
                color: "#A69D93",
                fontSize: 12,
                lineHeight: 1.65,
              }}
            >
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      <div
        className="guide-feature"
        style={{
          marginTop: 18,
          padding: 20,
          textAlign: "left",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <ShieldCheck
          size={18}
          style={{ color: "#E5A95C", flexShrink: 0, marginTop: 2 }}
          aria-hidden="true"
        />
        <div>
          <strong style={{ color: "#F4EFEA", fontSize: 13 }}>
            실기기 테스트 시 설치 안내
          </strong>
          <p
            style={{
              margin: "6px 0 0",
              color: "#A69D93",
              fontSize: 12,
              lineHeight: 1.65,
            }}
          >
            1) 다운로드한 APK 파일을 열 때 &lsquo;출처를 알 수 없는 앱
            설치&rsquo; 허용을 켜 주세요. 2) 로컬 PC 백엔드와 연동 테스트할 때는
            PC와 스마트폰을 같은 Wi-Fi에 연결한 뒤 PC의 LAN IP로 접속하면
            됩니다.
          </p>
        </div>
      </div>
    </section>
  );
}
