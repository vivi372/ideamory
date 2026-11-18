"use client";

import { ChevronRight, Menu, Search } from "lucide-react";
import {
  LegalWebviewModal,
  SidebarDrawer,
  SocialLinkModal,
  useAuthDrawer,
  useGuestBootstrap,
} from "@/features/auth-drawer";
import { CaptureInput } from "@/features/memo-capture";
import { MemoTimeline } from "@/widgets/memo-timeline";

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
    isMutating,
  } = useAuthDrawer();

  const currentLabel =
    viewMode === "TRASH"
      ? "휴지통"
      : viewMode === "CATEGORY"
        ? (categories.find((cat) => cat.id === selectedCategoryId)?.name ??
          "카테고리")
        : "전체 메모";

  return (
    <main className="ideamory-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <button
          type="button"
          className="icon-button"
          aria-label={drawerOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={drawerOpen}
          onClick={(event) => {
            setDrawerOpen(!drawerOpen);
            event.currentTarget.blur();
          }}
        >
          <Menu size={21} />
        </button>
        <div className="brand-lockup">
          <img src="/ideamory-logo.png" alt="Ideamory 로고" />
          <span>IDEAMORY</span>
        </div>
        <div className="header-search">
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            placeholder="기억 속에서 찾기"
            aria-label="메모 검색"
            readOnly
          />
        </div>
      </header>

      <section className="content-wrap">
        <div className="welcome-row">
          <div>
            <p className="eyebrow">YOUR MEMORY CACHE</p>
            <h1>오늘의 생각을 담아보세요</h1>
            <p className="subcopy">떠오른 순간, 정리하지 말고 그대로.</p>
          </div>
          <div className="memory-count">
            <span>{totalMemoCount}</span>
            <small>memories</small>
          </div>
        </div>

        <div className="timeline-label">
          <span>{currentLabel}</span>
          <span className="line" />
          <span className="sort-label">
            최신순 <ChevronRight size={13} />
          </span>
        </div>

        <MemoTimeline isBootstrapped={isBootstrapped} />
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
    </main>
  );
}
