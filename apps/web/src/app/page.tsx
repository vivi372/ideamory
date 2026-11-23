"use client";

import { useEffect } from "react";
import { Menu, X } from "lucide-react";
import {
  LegalWebviewModal,
  SidebarDrawer,
  SocialLinkModal,
  SocialLinkOverlay,
  useAuthDrawer,
  useGuestBootstrap,
} from "@/features/auth-drawer";
import { CategoryPickerSheet } from "@/features/category-picker";
import { CaptureInput } from "@/features/memo-capture";
import { ViewModeToggle, useViewModeStore } from "@/features/view-mode";
import { SearchBar } from "@/widgets/header";
import { KnowledgeGraphView } from "@/widgets/knowledge-graph";
import { MemoTimeline } from "@/widgets/memo-timeline";
import { ConditionalSplash } from "@/widgets/splash-screen";

/**
 * Ideamory 메인 타임라인 홈 페이지입니다.
 *
 * 최초 진입 시 `useGuestBootstrap`으로 0.1초 익명 게스트 세션을 자동 발급하고,
 * 상단 햄버거 메뉴와 연동된 `SidebarDrawer`, `SocialLinkModal`, `LegalWebviewModal`을 조합합니다.
 * (타임라인 CRUD 및 퀵 캡처 바, 하이브리드 검색은 후속 3-4 / 3-5 단계에서 연동됩니다.)
 *
 * @returns Ideamory 메인 셸 JSX
 */
export default function HomePage() {
  const { isBootstrapped } = useGuestBootstrap();
  const displayMode = useViewModeStore((state) => state.displayMode);
  const hydrateFromStorage = useViewModeStore(
    (state) => state.hydrateFromStorage,
  );

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  const {
    drawerOpen,
    setDrawerOpen,
    socialSheetOpen,
    setSocialSheetOpen,
    legalModalType,
    openLegalModal,
    closeLegalModal,
    isGuest,
    accountStatusLabel,
    categories,
    totalMemoCount,
    suggestionCategoryIds,
    viewMode,
    selectedCategoryId,
    selectAllMemos,
    selectCategory,
    selectTrash,
    handleResetGuestData,
    handleDeleteAccount,
    handleSocialLogin,
    isLinkingSocial,
    isResettingGuest,
    isDeletingAccount,
    isMutating,
  } = useAuthDrawer();

  const authOverlayProps = isLinkingSocial
    ? {
        open: true,
        title: "소셜 계정 연동 중...",
        description:
          "메모 데이터를 안전하게 이관하고 있습니다.\n잠시만 기다려 주세요.",
      }
    : isDeletingAccount
      ? {
          open: true,
          title: "회원탈퇴 처리 중...",
          description:
            "계정 및 모든 메모 데이터를 영구 삭제하고 있습니다.\n잠시만 기다려 주세요.",
        }
      : isResettingGuest
        ? {
            open: true,
            title: "게스트 데이터 초기화 중...",
            description:
              "기존 메모를 정리하고 새 시작 화면을 준비하고 있습니다.",
          }
        : { open: false };

  const currentLabel =
    viewMode === "TRASH"
      ? "휴지통"
      : viewMode === "CATEGORY"
        ? (categories.find((cat) => cat.id === selectedCategoryId)?.name ??
          "카테고리")
        : "전체 메모";

  return (
    <main className="ideamory-shell">
      <ConditionalSplash />
      <SocialLinkOverlay {...authOverlayProps} />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header
        className={`topbar${displayMode === "GRAPH" ? " is-graph-mode" : ""}`}
      >
        <button
          type="button"
          className="icon-button relative"
          aria-label={drawerOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={drawerOpen}
          onClick={(event) => {
            setDrawerOpen(!drawerOpen);
            event.currentTarget.blur();
          }}
        >
          <Menu size={21} />
          {suggestionCategoryIds.size > 0 ? (
            <span
              aria-label="유사 카테고리 병합 제안 알림"
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#E9A14E",
                boxShadow: "0 0 8px rgba(233, 161, 78, 0.7)",
              }}
            />
          ) : null}
        </button>
        <div className="brand-lockup">
          <img src="/ideamory-logo.png" alt="Ideamory 로고" />
          <span>IDEAMORY</span>
        </div>
        {displayMode === "CACHE" && viewMode !== "ALL" ? (
          <button
            type="button"
            className="topbar-view-pill"
            onClick={selectAllMemos}
            title="전체 메모로 돌아가기"
            aria-label={`${currentLabel} 필터 해제하고 전체 메모 보기`}
          >
            <span className="topbar-view-dot" aria-hidden="true" />
            <span className="topbar-view-text">{currentLabel}</span>
            <X size={12} aria-hidden="true" />
          </button>
        ) : null}
        <ViewModeToggle />
        {displayMode === "CACHE" ? <SearchBar /> : null}
      </header>

      <section
        className={`content-wrap${displayMode === "GRAPH" ? " is-graph-mode" : ""}`}
      >
        {displayMode === "GRAPH" ? (
          <KnowledgeGraphView isBootstrapped={isBootstrapped} />
        ) : (
          <>
            {totalMemoCount === 0 && viewMode === "ALL" ? (
              <div className="welcome-row">
                <div>
                  <p className="eyebrow">YOUR MEMORY CACHE</p>
                  <h1>오늘의 생각을 담아보세요</h1>
                  <p className="subcopy">떠오른 순간, 정리하지 말고 그대로.</p>
                </div>
              </div>
            ) : null}

            <MemoTimeline isBootstrapped={isBootstrapped} />
          </>
        )}
      </section>

      <CaptureInput />

      <SidebarDrawer
        open={drawerOpen}
        viewMode={viewMode}
        selectedCategoryId={selectedCategoryId}
        categories={categories}
        totalMemoCount={totalMemoCount}
        suggestionCategoryIds={suggestionCategoryIds}
        accountStatusLabel={accountStatusLabel}
        isGuest={isGuest}
        isMutating={isMutating}
        hideCategories={displayMode === "GRAPH"}
        onOpen={() => setDrawerOpen(true)}
        onClose={() => setDrawerOpen(false)}
        onSelectAllMemos={selectAllMemos}
        onSelectCategory={selectCategory}
        onSelectTrash={selectTrash}
        onOpenSocialSheet={() => setSocialSheetOpen(true)}
        onResetGuestData={() => {
          void handleResetGuestData();
        }}
      />

      <SocialLinkModal
        open={socialSheetOpen}
        isGuest={isGuest}
        isMutating={isMutating}
        onClose={() => setSocialSheetOpen(false)}
        onSelectProvider={handleSocialLogin}
        onDeleteAccount={() => {
          void handleDeleteAccount();
        }}
        onOpenLegal={openLegalModal}
      />

      <LegalWebviewModal
        legalModalType={legalModalType}
        onClose={closeLegalModal}
      />

      <CategoryPickerSheet />
    </main>
  );
}
