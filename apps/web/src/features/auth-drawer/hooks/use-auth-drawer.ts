"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  clearAllAuthTokens,
  queryKeys,
  setGuestToken,
} from "@/shared/api";
import { useFeedbackStore } from "@/shared/lib/feedback/use-feedback";
import { isCapacitorNative } from "@/shared/lib/native-bridge";
import { generateUuidV7 } from "@/shared/lib/uuid-v7";
import { useViewStore } from "@/shared/model/view-store";
import {
  deleteSocialAccountApi,
  fetchCategoriesApi,
  fetchMergeSuggestionsApi,
  initGuestSessionApi,
  resetGuestDataApi,
} from "../api/auth.api";
import {
  getAccountStatusLabel,
  useAuthStore,
  type SocialProvider,
} from "../model/auth-store";
import { rememberPendingOAuthProvider } from "./use-guest-bootstrap";

/**
 * 사이드바 드로어, 게스트 초기화, 소셜 연동 및 회원탈퇴 플로우를 조율하는 커스텀 훅입니다.
 *
 * UI 컴포넌트가 `axios`나 캐시 무효화 로직에 직접 의존하지 않도록 모든 서버 통신과
 * Zustand / TanStack Query / Confirm 다이얼로그 오케스트레이션을 이 훅에 캡슐화합니다.
 *
 * @returns 드로어 상태, 카테고리/병합 제안 목록, 계정 액션 핸들러 모음
 */
export function useAuthDrawer() {
  const queryClient = useQueryClient();

  const drawerOpen = useAuthStore((state) => state.drawerOpen);
  const socialSheetOpen = useAuthStore((state) => state.socialSheetOpen);
  const legalModalType = useAuthStore((state) => state.legalModalType);
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);
  const isLinkingSocial = useAuthStore((state) => state.isLinkingSocial);
  const socialProvider = useAuthStore((state) => state.socialProvider);

  const setDrawerOpen = useAuthStore((state) => state.setDrawerOpen);
  const setSocialSheetOpen = useAuthStore((state) => state.setSocialSheetOpen);
  const openLegalModal = useAuthStore((state) => state.openLegalModal);
  const closeLegalModal = useAuthStore((state) => state.closeLegalModal);
  const setSocialProvider = useAuthStore((state) => state.setSocialProvider);

  const viewMode = useViewStore((state) => state.viewMode);
  const selectedCategoryId = useViewStore((state) => state.selectedCategoryId);
  const setViewMode = useViewStore((state) => state.setViewMode);
  const setSelectedCategory = useViewStore((state) => state.setSelectedCategory);
  const resetView = useViewStore((state) => state.resetView);

  // 세션 부트스트랩 완료 이후에만 사이드바 카테고리 및 병합 제안 목록 조회
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.list(),
    queryFn: fetchCategoriesApi,
    enabled: isBootstrapped,
  });

  const mergeSuggestionsQuery = useQuery({
    queryKey: queryKeys.categories.mergeSuggestions(),
    queryFn: fetchMergeSuggestionsApi,
    enabled: isBootstrapped,
  });

  const resetGuestMutation = useMutation({
    mutationFn: async () => {
      await resetGuestDataApi();
      clearAllAuthTokens();
      const freshSession = await initGuestSessionApi({
        memoId: generateUuidV7(),
        categoryId: generateUuidV7(),
      });
      setGuestToken(freshSession.guestToken);
    },
    onSuccess: async () => {
      setSocialProvider(null);
      resetView();
      setDrawerOpen(false);
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: queryKeys.memos.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      useFeedbackStore
        .getState()
        .showToast("info", "게스트 데이터가 초기화되었습니다.");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await deleteSocialAccountApi();
      clearAllAuthTokens();
      const freshSession = await initGuestSessionApi({
        memoId: generateUuidV7(),
        categoryId: generateUuidV7(),
      });
      setGuestToken(freshSession.guestToken);
    },
    onSuccess: async () => {
      setSocialProvider(null);
      resetView();
      setSocialSheetOpen(false);
      setDrawerOpen(false);
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: queryKeys.memos.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      useFeedbackStore
        .getState()
        .showToast("info", "회원탈퇴 및 데이터 삭제가 완료되었습니다.");
    },
  });

  const handleResetGuestData = async () => {
    const confirmed = await useFeedbackStore.getState().openConfirm({
      title: "게스트 데이터 초기화",
      description: "작성한 모든 메모 데이터가 영구히 삭제됩니다.",
      confirmLabel: "초기화 및 삭제",
      cancelLabel: "취소",
      destructive: true,
    });
    if (!confirmed) return;
    await resetGuestMutation.mutateAsync();
  };

  const handleDeleteAccount = async () => {
    const confirmed = await useFeedbackStore.getState().openConfirm({
      title: "회원탈퇴 및 데이터 영구 삭제",
      description: "작성한 모든 메모와 계정 데이터가 영구히 삭제됩니다.",
      confirmLabel: "초기화 및 삭제",
      cancelLabel: "취소",
      destructive: true,
    });
    if (!confirmed) return;
    await deleteAccountMutation.mutateAsync();
  };

  const handleSocialLogin = (provider: SocialProvider) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      useFeedbackStore
        .getState()
        .showToast(
          "warn",
          "소셜 OAuth 환경변수(NEXT_PUBLIC_SUPABASE_URL) 설정이 필요합니다."
        );
      return;
    }

    rememberPendingOAuthProvider(provider);
    if (isCapacitorNative()) {
      setSocialSheetOpen(false);
      setDrawerOpen(false);
    }
    const redirectUrl = isCapacitorNative()
      ? "com.ideamory.app://auth/callback"
      : window.location.origin;
    const redirectTo = encodeURIComponent(redirectUrl);
    window.location.assign(
      `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/authorize?provider=${provider}&redirect_to=${redirectTo}`
    );
  };

  const categories = categoriesQuery.data ?? [];
  const mergeSuggestions = mergeSuggestionsQuery.data ?? [];
  const suggestionCategoryIds = new Set<string>();
  mergeSuggestions.forEach((item) => {
    suggestionCategoryIds.add(item.sourceCategoryId);
    suggestionCategoryIds.add(item.targetCategoryId);
  });

  const totalMemoCount = categories.reduce(
    (sum, category) => sum + (category.memoCount ?? 0),
    0
  );

  return {
    drawerOpen,
    setDrawerOpen,
    socialSheetOpen,
    setSocialSheetOpen,
    legalModalType,
    openLegalModal,
    closeLegalModal,
    socialProvider,
    accountStatusLabel: getAccountStatusLabel(socialProvider),
    isGuest: socialProvider === null,
    categories,
    totalMemoCount,
    suggestionCategoryIds,
    viewMode,
    selectedCategoryId,
    selectAllMemos: () => {
      setViewMode("ALL");
      setDrawerOpen(false);
    },
    selectCategory: (categoryId: string) => {
      setSelectedCategory(categoryId);
      setDrawerOpen(false);
    },
    selectTrash: () => {
      setViewMode("TRASH");
      setDrawerOpen(false);
    },
    handleResetGuestData,
    handleDeleteAccount,
    handleSocialLogin,
    isLinkingSocial,
    isMutating: resetGuestMutation.isPending || deleteAccountMutation.isPending,
  };
}
