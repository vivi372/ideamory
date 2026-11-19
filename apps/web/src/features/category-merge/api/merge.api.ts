import type {
  MergeCategoryDto,
  MergeCategoryResponseDto,
  MergeSuggestionResponseDto,
} from "@ideamory/api-spec";
import { apiClient } from "../../../shared/api";

/**
 * 대기 중인 유사 카테고리 병합 제안 목록을 조회합니다.
 *
 * @returns 유사도 0.85 이상 병합 제안 DTO 배열
 */
export async function fetchMergeSuggestionsListApi(): Promise<
  MergeSuggestionResponseDto[]
> {
  const { data } = await apiClient.get<MergeSuggestionResponseDto[]>(
    "/categories/merge-suggestions"
  );
  return data;
}

/**
 * 의미론적으로 유사한 두 카테고리를 단일 트랜잭션으로 통합합니다.
 * `sourceCategoryId`에 속한 모든 메모를 `targetCategoryId`로 이전한 뒤 원본 카테고리를 삭제합니다.
 *
 * @param dto 삭제될 원본(`sourceCategoryId`) 및 흡수 대상(`targetCategoryId`) UUID v7
 * @returns 병합 성공 여부 및 이전된 메모 건수
 */
export async function mergeCategoriesApi(
  dto: MergeCategoryDto
): Promise<MergeCategoryResponseDto> {
  const { data } = await apiClient.post<MergeCategoryResponseDto>(
    "/categories/merge",
    dto
  );
  return data;
}

/**
 * 유사 카테고리 병합 제안을 거절하여 제안 큐 레코드를 영구 삭제합니다. (`204 No Content`)
 * 이후 사이드바 오렌지 닷과 상단 배너가 영구적으로 사라집니다.
 *
 * @param suggestionId 삭제할 병합 제안 UUID v7
 */
export async function dismissMergeSuggestionApi(
  suggestionId: string
): Promise<void> {
  await apiClient.delete(`/categories/merge-suggestions/${suggestionId}`);
}
