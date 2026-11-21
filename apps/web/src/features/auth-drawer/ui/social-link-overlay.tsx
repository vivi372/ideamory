"use client";

import { Loader2 } from "lucide-react";

interface SocialLinkOverlayProps {
  /** 계정 연동·초기화·탈퇴 진행 중 오버레이 표시 여부 */
  open: boolean;
  /** 오버레이 제목 */
  title?: string;
  /** 오버레이 안내 문구 */
  description?: string;
}

/**
 * 소셜 계정 연동 복귀, 게스트 데이터 초기화, 회원탈퇴 등 시간이 소요되는 계정 작업 중
 * 화면 중앙에 모달 형태로 진행 상태를 안내해 화면 멈춤이나 연동 실패로 오해되는 현상을 방지합니다.
 */
export function SocialLinkOverlay({
  open,
  title = "소셜 계정 연동 중...",
  description = "메모 데이터를 안전하게 이관하고 있습니다.\n잠시만 기다려 주세요.",
}: SocialLinkOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="auth-action-backdrop"
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="auth-action-dialog">
        <Loader2
          size={32}
          className="auth-action-spinner"
          aria-hidden="true"
        />
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}
