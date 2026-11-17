import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { FeedbackProvider } from "./providers/feedback-provider";
import { QueryProvider } from "./providers/query-provider";

export const metadata: Metadata = {
  title: "Ideamory — 생각을 담는 기억 캐시",
  description:
    "떠오른 순간, 정리하지 말고 그대로. Ideamory는 당신의 생각을 위한 초경량 메모 서비스입니다.",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#03172E" },
    { media: "(prefers-color-scheme: light)", color: "#f8fbfd" },
  ],
};

/**
 * Ideamory 루트 레이아웃입니다.
 * 퍼블리싱 다크 비주얼 시스템(`globals.css`), TanStack Query(`QueryProvider`),
 * 전역 Radix Toast/Dialog 피드백 시스템(`FeedbackProvider`)을 애플리케이션 최상단에 결합합니다.
 *
 * @param props 페이지 children
 * @returns HTML 루트 문서
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <QueryProvider>
          <FeedbackProvider>{children}</FeedbackProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
