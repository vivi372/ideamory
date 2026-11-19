"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  WifiOff,
  Zap,
} from "lucide-react";

const APK_VERSION = "1.0.4";
const APK_FILE_NAME = `ideamory-android-v${APK_VERSION}.apk`;
const APK_DOWNLOAD_HREF = `/downloads/${APK_FILE_NAME}`;

/**
 * Ideamory Android(Capacitor) 앱 임시 배포 및 실기기 설치 안내 페이지(`/download`)입니다.
 *
 * 업로드된 네이티브 앱 아이콘(`ideamory-app-icon.jpg`)과 Ideamory 다크 네이비 + 시안
 * 디자인 토큰을 반영하여 APK 다운로드, Android 공유하기(Share Intent) 및
 * 0.1초 퀵 캡처 앱 사용 가이드를 제공합니다.
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
          "radial-gradient(circle at 50% 10%, rgba(39, 215, 242, 0.12), transparent 48%), #020B18",
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
            border: "1px solid rgba(39, 215, 242, 0.28)",
            background: "rgba(39, 215, 242, 0.08)",
            color: "#7DD3FC",
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
              border: "1px solid rgba(39, 215, 242, 0.35)",
              boxShadow: "0 20px 55px rgba(18, 231, 245, 0.18)",
            }}
          />
        </div>

        <h1
          style={{
            marginTop: 22,
            marginBottom: 12,
            color: "#EAFBFF",
            fontSize: "clamp(26px, 6vw, 38px)",
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1.25,
          }}
        >
          주머니 속 0.1초 기억 캐시,
          <br />
          <span style={{ color: "#27D7F2" }}>Ideamory Android</span>
        </h1>

        <p
          style={{
            margin: "0 auto",
            maxWidth: 440,
            color: "#94A3B8",
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          웹 브라우저뿐만 아니라 유튜브·인스타·뉴스 앱에서{" "}
          <strong style={{ color: "#BAE6FD" }}>공유하기</strong> 한 번으로
          생각과 링크를 즉시 담아보세요.
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
              background: "linear-gradient(135deg, #27D7F2, #12E7F5)",
              color: "#03172E",
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 10px 28px rgba(39, 215, 242, 0.25)",
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
              border: "1px solid rgba(56, 189, 248, 0.28)",
              background: "rgba(10, 39, 68, 0.55)",
              color: "#BAE6FD",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Smartphone size={16} aria-hidden="true" />
            <span>웹으로 바로 써보기</span>
          </Link>
        </div>

        <p style={{ marginTop: 12, color: "#64748B", fontSize: 11 }}>
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
          <div className="guide-feature" style={{ padding: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#27D7F2",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <Share2 size={16} aria-hidden="true" />
              <span>Share Intent 즉시 캡처</span>
            </div>
            <p
              style={{
                margin: "10px 0 0",
                color: "#94A3B8",
                fontSize: 12,
                lineHeight: 1.65,
              }}
            >
              외부 앱에서 공유하기 ➔ Ideamory를 선택하면 하단 썸존 입력창에
              텍스트와 링크가 0ms로 자동 주입됩니다.
            </p>
          </div>

          <div className="guide-feature" style={{ padding: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#27D7F2",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <Zap size={16} aria-hidden="true" />
              <span>0ms 조건부 스플래시</span>
            </div>
            <p
              style={{
                margin: "10px 0 0",
                color: "#94A3B8",
                fontSize: 12,
                lineHeight: 1.65,
              }}
            >
              정상 네트워크에서는 1~2초 고정 대기 없이 썸존으로 직행하며,
              백엔드 지연 시에만 부드러운 로딩 스플래시를 표시합니다.
            </p>
          </div>

          <div className="guide-feature" style={{ padding: 20 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#27D7F2",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <WifiOff size={16} aria-hidden="true" />
              <span>브랜드 오프라인 &amp; 뒤로가기</span>
            </div>
            <p
              style={{
                margin: "10px 0 0",
                color: "#94A3B8",
                fontSize: 12,
                lineHeight: 1.65,
              }}
            >
              열린 드로어·시트·필터를 역순으로 닫은 뒤 2초 내 2회 뒤로가기 시
              안전하게 종료되며, 오프라인 시 재시도 안내 뷰를 제공합니다.
            </p>
          </div>
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
            style={{ color: "#27D7F2", flexShrink: 0, marginTop: 2 }}
            aria-hidden="true"
          />
          <div>
            <strong style={{ color: "#E6F4F8", fontSize: 13 }}>
              실기기 테스트 시 설치 안내
            </strong>
            <p
              style={{
                margin: "6px 0 0",
                color: "#94A3B8",
                fontSize: 12,
                lineHeight: 1.65,
              }}
            >
              1) 다운로드한 APK 파일을 열 때 &lsquo;출처를 알 수 없는 앱
              설치&rsquo; 허용을 켜 주세요. 2) 로컬 PC 백엔드와 연동 테스트할
              때는 PC와 스마트폰을 같은 Wi-Fi에 연결한 뒤 PC의 LAN IP로
              접속하면 됩니다.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
