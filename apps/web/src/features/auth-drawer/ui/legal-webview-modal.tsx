"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { LegalDocumentType } from "../model/auth-store";

interface LegalWebviewModalProps {
  /** 표시할 약관 문서 유형 (`terms` | `privacy`, null이면 닫힘) */
  legalModalType: LegalDocumentType | null;
  /** 모달 닫기 콜백 */
  onClose: () => void;
}

const LEGAL_DOCUMENTS: Record<
  LegalDocumentType,
  { title: string; sections: readonly { heading: string; body: string }[] }
> = {
  terms: {
    title: "서비스 이용약관",
    sections: [
      {
        heading: "1. 목적 및 서비스 제공",
        body: "Ideamory(이하 '서비스')는 사용자의 메모를 0.1초 만에 캡처하고 AI 기반 자동 분류, 링크 미리보기(OGP), 문맥 하이브리드 검색을 제공하는 초경량 지식 서재 플랫폼입니다.",
      },
      {
        heading: "2. 익명 게스트 및 소셜 계정 연동",
        body: "사용자는 회원가입 없이 익명 게스트 세션으로 즉시 서비스를 이용할 수 있으며, 소셜 계정 연동 시 기존 게스트 메모 및 카테고리가 정식 계정으로 100% 이관됩니다.",
      },
      {
        heading: "3. 데이터 삭제 및 보관 정책",
        body: "휴지통으로 이동한 메모는 30일간 보관 후 자동 영구 삭제되며, 게스트 데이터 초기화 또는 회원탈퇴 시 모든 메모·카테고리·임베딩 데이터는 즉시 완전 파기됩니다.",
      },
    ],
  },
  privacy: {
    title: "개인정보 처리방침",
    sections: [
      {
        heading: "1. 최소 수집 원칙 (Zero-Profile)",
        body: "서비스는 프로필 사진이나 불필요한 개인정보를 화면에 노출하거나 수집하지 않으며, 익명 게스트 토큰 또는 소셜 인증 식별자(UUID)만을 통해 소유권을 격리합니다.",
      },
      {
        heading: "2. AI 파이프라인 처리 고지",
        body: "사용자가 저장한 메모 본문은 자동 카테고리 분류, 768차원 시맨틱 임베딩 벡터 생성 및 연관 메모 추천을 위해 Google Gemini API로 전송되어 처리됩니다.",
      },
      {
        heading: "3. 파기 절차 및 사용자 권리",
        body: "사용자는 언제든지 사이드바 드로어에서 게스트 데이터 초기화 또는 회원탈퇴를 요청할 수 있으며, 요청 즉시 단일 트랜잭션으로 모든 데이터가 영구 파기됩니다.",
      },
    ],
  },
};

/**
 * 외부 브라우저로 이탈하지 않고 인앱 오버레이로 서비스 이용약관 및 개인정보 처리방침을
 * 표출하는 `@radix-ui/react-dialog` 기반 모달 컴포넌트입니다.
 *
 * @param props 문서 유형 및 닫기 핸들러
 * @returns 인앱 약관 오버레이 모달 JSX
 */
export function LegalWebviewModal({
  legalModalType,
  onClose,
}: LegalWebviewModalProps) {
  const doc = legalModalType ? LEGAL_DOCUMENTS[legalModalType] : null;

  return (
    <DialogPrimitive.Root
      open={legalModalType !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {doc && (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="sheet-backdrop" />
          <DialogPrimitive.Content
            className="demo-modal"
            style={{ textAlign: "left", maxHeight: "80vh", overflowY: "auto" }}
          >
            <div
              className="sheet-header"
              style={{ marginBottom: "14px", alignItems: "center" }}
            >
              <DialogPrimitive.Title asChild>
                <h2>{doc.title}</h2>
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="sheet-close"
                  aria-label="약관 닫기"
                >
                  <X size={18} />
                </button>
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Description asChild>
              <div style={{ display: "grid", gap: "14px" }}>
                {doc.sections.map((section) => (
                  <div key={section.heading}>
                    <strong
                      style={{
                        display: "block",
                        color: "#EAFBFF",
                        fontSize: "13px",
                        marginBottom: "5px",
                      }}
                    >
                      {section.heading}
                    </strong>
                    <p style={{ margin: 0 }}>{section.body}</p>
                  </div>
                ))}
              </div>
            </DialogPrimitive.Description>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      )}
    </DialogPrimitive.Root>
  );
}
