"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { LegalDocumentType, SocialProvider } from "../model/auth-store";
import {
  GitHubBrandIcon,
  GoogleBrandIcon,
  KakaoBrandIcon,
} from "./social-icons";

interface SocialLinkModalProps {
  /** 바텀시트 열림 여부 */
  open: boolean;
  /** 게스트 모드 여부 (소셜 연동 완료 상태일 때만 회원탈퇴 버튼 노출) */
  isGuest: boolean;
  /** 뮤테이션 진행 중 여부 */
  isMutating: boolean;
  /** 바텀시트 닫기 콜백 */
  onClose: () => void;
  /** 소셜 로그인 선택 콜백 */
  onSelectProvider: (provider: SocialProvider) => void;
  /** 소셜 회원탈퇴 콜백 */
  onDeleteAccount: () => void;
  /** 약관/개인정보 처리방침 인앱 오버레이 오픈 콜백 */
  onOpenLegal: (type: LegalDocumentType) => void;
}

/**
 * `[데이터 백업 및 연동]` 클릭 시 노출되는 소셜 계정 연동 바텀시트 모달입니다.
 * `@radix-ui/react-dialog`를 기반으로 접근성(포커스 트랩, ESC 닫기)을 보장하고,
 * 하단 약관 링크는 외부 브라우저 이동 없이 인앱 오버레이로 연결합니다.
 *
 * @param props 바텀시트 상태 및 액션 핸들러
 * @returns 소셜 연동 바텀시트 JSX
 */
export function SocialLinkModal({
  open,
  isGuest,
  isMutating,
  onClose,
  onSelectProvider,
  onDeleteAccount,
  onOpenLegal,
}: SocialLinkModalProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      {open && (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="sheet-backdrop" />
          <DialogPrimitive.Content className="social-sheet">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <div>
                <p className="sheet-kicker">SECURE YOUR MEMORIES</p>
                <DialogPrimitive.Title asChild>
                  <h2>데이터 백업 및 연동</h2>
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label="연동 시트 닫기"
                >
                  <X size={18} />
                </button>
              </DialogPrimitive.Close>
            </div>

            <DialogPrimitive.Description asChild>
              <p className="social-description">
                소셜 계정을 연동하면 기기를 바꿔도 메모가 안전하게 유지됩니다.
              </p>
            </DialogPrimitive.Description>

            <div className="social-options">
              <button
                type="button"
                className="social-btn social-btn-kakao"
                onClick={() => onSelectProvider("kakao")}
              >
                <KakaoBrandIcon />
                <span>카카오 로그인</span>
              </button>
              <button
                type="button"
                className="social-btn social-btn-google"
                onClick={() => onSelectProvider("google")}
              >
                <GoogleBrandIcon />
                <span>Google로 계속하기</span>
              </button>
              <button
                type="button"
                className="social-btn social-btn-github"
                onClick={() => onSelectProvider("github")}
              >
                <GitHubBrandIcon />
                <span>GitHub로 계속하기</span>
              </button>
            </div>

            {!isGuest && (
              <button
                type="button"
                className="account-delete-button"
                disabled={isMutating}
                onClick={onDeleteAccount}
              >
                회원탈퇴 및 데이터 영구 삭제
              </button>
            )}

            <p className="terms-copy">
              연동 시{" "}
              <a
                href="#terms"
                onClick={(event) => {
                  event.preventDefault();
                  onOpenLegal("terms");
                }}
              >
                서비스 이용약관
              </a>{" "}
              및{" "}
              <a
                href="#privacy"
                onClick={(event) => {
                  event.preventDefault();
                  onOpenLegal("privacy");
                }}
              >
                개인정보 처리방침
              </a>
              에 동의하게 됩니다.
            </p>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
}
