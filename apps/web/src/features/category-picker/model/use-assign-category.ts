"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CategoryResponseDto, MemoResponseDto } from "@ideamory/api-spec";
import { updateMemoApi } from "../../../entities/memo";
import { ApiClientError, queryKeys } from "../../../shared/api";
import { useFeedback } from "../../../shared/lib/feedback/use-feedback";
import { createCategoryApi } from "../api/category.api";
import {
  applyCategoryCountOptimisticUpdate,
  applyMemoCategoryOptimisticUpdate,
} from "../lib/category-picker.helper";

export interface AssignCategoryVariables {
  /** 카테고리를 변경할 대상 메모 UUID v7 */
  memoId: string;
  /** 적용할 대상 카테고리 정보 */
  targetCategory: CategoryResponseDto;
  /** 신규 생성 후 매핑 여부 */
  isNew?: boolean;
}

interface AssignCategoryContext {
  previousMemoQueries: Array<[readonly unknown[], MemoResponseDto[] | undefined]>;
  previousCategories: CategoryResponseDto[] | undefined;
}

/**
 * 메모의 카테고리를 낙관적 UI(Optimistic UI)로 즉시 변경하거나
 * 신규 카테고리를 생성해 매핑하는 TanStack Query 뮤테이션 훅입니다.
 *
 * @returns TanStack Query `useMutation` 결과 객체
 */
export function useAssignCategory() {
  const queryClient = useQueryClient();
  const { showToast } = useFeedback();

  return useMutation<
    MemoResponseDto,
    unknown,
    AssignCategoryVariables,
    AssignCategoryContext
  >({
    mutationFn: async ({ memoId, targetCategory, isNew }) => {
      // 신규 카테고리인 경우 먼저 서버에 생성한 뒤 반환된 실제 ID로 메모 카테고리를 연결
      if (isNew) {
        const created = await createCategoryApi({
          id: targetCategory.id,
          name: targetCategory.name,
        });
        return updateMemoApi(memoId, { categoryId: created.id });
      }
      return updateMemoApi(memoId, { categoryId: targetCategory.id });
    },
    onMutate: async ({ memoId, targetCategory }) => {
      // 진행 중인 조회 요청이 낙관적 캐시를 덮어쓰지 않도록 선제 취소
      await queryClient.cancelQueries({ queryKey: queryKeys.memos.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.list() });

      // 실패 시 원복할 이전 메모·카테고리 캐시 스냅샷 저장
      const previousMemoQueries = queryClient.getQueriesData<MemoResponseDto[]>({
        queryKey: queryKeys.memos.all,
      });
      const previousCategories = queryClient.getQueryData<
        CategoryResponseDto[]
      >(queryKeys.categories.list());

      // 1단계: 모든 타임라인 캐시에서 대상 메모 배지를 즉시 교체하고 기존 카테고리 ID 확보
      let sourceCategoryId: string | null = null;
      queryClient.setQueriesData<MemoResponseDto[]>(
        { queryKey: queryKeys.memos.all },
        (old) => {
          const { updatedMemos, sourceCategoryId: prevId } =
            applyMemoCategoryOptimisticUpdate(old, memoId, targetCategory);
          if (prevId) {
            sourceCategoryId = prevId;
          }
          return updatedMemos;
        }
      );

      // 2단계: 사이드바 카테고리 목록의 메모 개수를 증감하고 0건 카테고리는 0ms 숨김
      queryClient.setQueryData<CategoryResponseDto[]>(
        queryKeys.categories.list(),
        (old) =>
          applyCategoryCountOptimisticUpdate(
            old,
            sourceCategoryId,
            targetCategory
          )
      );

      return { previousMemoQueries, previousCategories };
    },
    onError: (error, _variables, context) => {
      // 서버 요청 실패 시 백업해 둔 스냅샷으로 메모 및 카테고리 캐시를 즉시 롤백
      if (context?.previousMemoQueries) {
        for (const [key, data] of context.previousMemoQueries) {
          queryClient.setQueryData(key, data);
        }
      }
      if (context?.previousCategories !== undefined) {
        queryClient.setQueryData(
          queryKeys.categories.list(),
          context.previousCategories
        );
      }
      // 비-FIELD ApiClientError는 response.interceptor.ts에서 전역 알림이 이미 발행되므로 중복 토스트 방지
      if (!(error instanceof ApiClientError) || error.uxTag === "FIELD") {
        showToast(
          "error",
          error instanceof ApiClientError
            ? error.message
            : "카테고리 변경에 실패했습니다. 다시 시도해 주세요."
        );
      }
    },
    onSettled: () => {
      // 카테고리 이동으로 새 유사 카테고리 병합 제안이 생성될 수 있으므로 mergeSuggestions도 함께 동기화
      void queryClient.invalidateQueries({ queryKey: queryKeys.memos.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.list(),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.categories.mergeSuggestions(),
      });
    },
  });
}
