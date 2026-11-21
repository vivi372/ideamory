import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { OfflineBoundary } from "@/widgets/offline-view";
import { BackButtonProvider } from "./providers/back-button-provider";
import { FeedbackProvider } from "./providers/feedback-provider";
import { QueryProvider } from "./providers/query-provider";

export const metadata: Metadata = {
  title: "Ideamory — 생각을 담는 기억 캐시",
  description:
    "떠오른 순간, 정리하지 말고 그대로. Ideamory는 당신의 생각을 위한 초경량 메모 서비스입니다.",
  icons: {
    icon: [{ url: "/ideamory-app-icon.jpg", type: "image/jpeg" }],
    apple: "/ideamory-app-icon.jpg",
  },
  openGraph: {
    title: "Ideamory — 생각을 담는 기억 캐시",
    description:
      "떠오른 순간, 정리하지 말고 그대로. Ideamory는 당신의 생각을 위한 초경량 메모 서비스입니다.",
    images: [{ url: "/ideamory-guide-ogp.jpg", width: 1024, height: 1024 }],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#121110",
};

/**
 * Ideamory 루트 레이아웃입니다.
 * 퍼블리싱 다크 비주얼 시스템(`globals.css`), TanStack Query(`QueryProvider`),
 * 브랜드 오프라인 안내 바운더리(`OfflineBoundary`), 전역 피드백(`FeedbackProvider`),
 * 안드로이드 물리 뒤로가기 계층 제어(`BackButtonProvider`)를 최상단에 결합합니다.
 *
 * @param props 페이지 children
 * @returns HTML 루트 문서
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <QueryProvider>
          <FeedbackProvider>
            <OfflineBoundary>
              <BackButtonProvider>{children}</BackButtonProvider>
            </OfflineBoundary>
          </FeedbackProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
