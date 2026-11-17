import { create } from "zustand";

/**
 * 지원하는 소셜 인증 제공자 타입
 */
export type SocialProvider = "kakao" | "google" | "github";

/**
 * 인앱 약관 오버레이 모달에서 표시할 문서 유형
 */
export type LegalDocumentType = "terms" | "privacy";

const PROVIDER_LABEL_MAP: Record<SocialProvider, string> = {
  kakao: "카카오 연동됨",
  google: "구글 연동됨",
  github: "깃허브 연동됨",
};

interface AuthStoreState {
  /** 사이드바 드로어 열림 여부 */
  drawerOpen: boolean;
  /** 소셜 계정 연동 바텀시트 열림 여부 */
  socialSheetOpen: boolean;
  /** 인앱 약관/개인정보 처리방침 오버레이 모달 유형 (닫힘 시 null) */
  legalModalType: LegalDocumentType | null;
  /** 초기 게스트/소셜 세션 부트스트랩 완료 여부 */
  isBootstrapped: boolean;
  /** 현재 연동된 소셜 제공자 (게스트 상태 시 null) */
  socialProvider: SocialProvider | null;
  setDrawerOpen: (open: boolean) => void;
  setSocialSheetOpen: (open: boolean) => void;
  openLegalModal: (type: LegalDocumentType) => void;
  closeLegalModal: () => void;
  setBootstrapped: (ready: boolean) => void;
  setSocialProvider: (provider: SocialProvider | null) => void;
}

/**
 * 현재 인증 상태에 대응하는 Zero-Profile 미니멀 텍스트 라벨을 반환합니다.
 *
 * @param provider 연동된 소셜 제공자 (게스트일 경우 null)
 * @returns 화면에 노출할 미니멀 상태 문구
 */
export function getAccountStatusLabel(provider: SocialProvider | null): string {
  if (!provider) {
    return "게스트 모드 · 기기 보관 중";
  }
  return PROVIDER_LABEL_MAP[provider];
}

/**
 * 인증 드로어, 소셜 연동 바텀시트, 약관 인앱 오버레이 및 세션 상태를 관리하는 Zustand 스토어입니다.
 */
export const useAuthStore = create<AuthStoreState>((set) => ({
  drawerOpen: false,
  socialSheetOpen: false,
  legalModalType: null,
  isBootstrapped: false,
  socialProvider: null,

  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setSocialSheetOpen: (open) => set({ socialSheetOpen: open }),
  openLegalModal: (type) => set({ legalModalType: type }),
  closeLegalModal: () => set({ legalModalType: null }),
  setBootstrapped: (ready) => set({ isBootstrapped: ready }),
  setSocialProvider: (provider) => set({ socialProvider: provider }),
}));
