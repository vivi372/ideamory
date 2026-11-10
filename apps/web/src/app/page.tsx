"use client";

import React from "react";
import type { CreateMemoDto } from "@ideamory/api-spec";

export default function HomePage() {
  // 0단계 연결 검증용 DTO 타입 확인
  const exampleMemo: CreateMemoDto = {
    content: "Ideamory 0.1초 퀵 캡처 프로젝트 환경이 성공적으로 초기화되었습니다.",
    categoryName: "온보딩"
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Ideamory (아이디모리)
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          모바일 퍼스트 0.1초 퀵 캡처 &amp; AI 하이브리드 지식 서재
        </p>

        <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 text-left">
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
            {exampleMemo.categoryName}
          </span>
          <p className="mt-2 text-sm text-slate-200">
            {exampleMemo.content}
          </p>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          0단계 Monorepo (Next.js 15 + NestJS + Supabase) 환경 구성 완료
        </p>
      </div>
    </main>
  );
}

