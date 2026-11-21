"use client";

import { Loader2 } from "lucide-react";

interface SocialLinkOverlayProps {
  /** 소셜 계정 연동 및 데이터 이관 진행 중 여부 */
  open: boolean;
}

/**
 * 외부 브라우저 OAuth 인증 완료 후 앱으로 복귀했을 때,
 * 게스트 화면이 잠깐 노출되어 연동 실패로 오해되는 현상을 방지하는 진행 중 오버레이입니다.
 */
export function SocialLinkOverlay({ open }: SocialLinkOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-6 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-label="소셜 계정 연동 중"
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-amber-500/25 bg-[#1b1917] px-6 py-7 text-center shadow-2xl">
        <Loader2
          size={28}
          className="animate-spin text-amber-400"
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-[#f3ece2]">
          소셜 계정 연동 중...
        </p>
        <p className="text-xs leading-relaxed text-[#a89f94]">
          메모 데이터를 안전하게 이관하고 있습니다.
          <br />
          잠시만 기다려 주세요.
        </p>
      </div>
    </div>
  );
}
