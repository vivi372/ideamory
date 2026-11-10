import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Ideamory - 뇌의 캐시 메모리",
  description: "0.1초 퀵 캡처 & AI 하이브리드 지식 서재"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased bg-slate-950 text-slate-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}

