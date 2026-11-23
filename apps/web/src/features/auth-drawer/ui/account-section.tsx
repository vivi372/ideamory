"use client";

import { ChevronRight, Cloud, KeyRound } from "lucide-react";

interface AccountSectionProps {
  /** Zero-Profile 미니멀 계정 상태 문구 (예: `게스트 모드 · 기기 보관 중`, `카카오 연동됨`) */
  accountStatusLabel: string;
  /** 게스트 모드 여부 */
  isGuest: boolean;
  /** 초기화/탈퇴 뮤테이션 진행 중 여부 */
  isMutating: boolean;
  /** `[AI 에이전트 연동 (MCP 키 관리)]` 카드 클릭 핸들러 */
  onOpenMcpSheet?: () => void;
  /** `[데이터 백업 및 연동]` 카드 클릭 핸들러 */
  onOpenSocialSheet: () => void;
  /** `[게스트 데이터 초기화]` 버튼 클릭 핸들러 */
  onResetGuestData: () => void;
}

/**
 * 사이드바 드로어 하단의 미니멀 계정 구획 컴포넌트입니다.
 * 프로필 이미지와 이메일 주소를 배제하고 텍스트 상태, MCP 연동 카드, 소셜 연동 카드, 게스트 초기화 버튼만 표출합니다.
 *
 * @param props 계정 상태 및 액션 콜백
 * @returns 계정 구획 JSX
 */
export function AccountSection({
  accountStatusLabel,
  isGuest,
  isMutating,
  onOpenMcpSheet,
  onOpenSocialSheet,
  onResetGuestData,
}: AccountSectionProps) {
  return (
    <>
      {onOpenMcpSheet && (
        <button
          type="button"
          className="backup-card mcp-entry-card"
          onClick={onOpenMcpSheet}
        >
          <KeyRound size={18} aria-hidden="true" />
          <span>AI 에이전트 연동 (MCP 키 관리)</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className="backup-card"
        onClick={onOpenSocialSheet}
      >
        <Cloud size={18} aria-hidden="true" />
        <span>데이터 백업 및 연동</span>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
      <p className="account-status">{accountStatusLabel}</p>
      {isGuest && (
        <button
          type="button"
          className="guest-reset-button"
          disabled={isMutating}
          onClick={onResetGuestData}
        >
          게스트 데이터 초기화
        </button>
      )}
      <p className="retention">삭제한 메모는 30일 동안 보관돼요.</p>
    </>
  );
}
