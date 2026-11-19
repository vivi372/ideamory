import type {
  CategoryResponseDto,
  CreateCategoryDto,
} from "@ideamory/api-spec";
import { apiClient } from "../../../shared/api";

/**
 * 활성 메모가 1건 이상 존재하는 카테고리 목록을 조회합니다.
 *
 * @returns 활성 카테고리 DTO 배열
 */
export async function fetchCategoriesListApi(): Promise<
  CategoryResponseDto[]
> {
  const { data } = await apiClient.get<CategoryResponseDto[]>("/categories");
  return data;
}

/**
 * 텍스트 전용(1~10자, 이모지 배제) 신규 카테고리를 생성합니다.
 * 백엔드에서 공백 정규화(`normalized_name`)를 통해 띄어쓰기 중복을 자동 방지합니다.
 *
 * @param dto 클라이언트에서 선발급한 UUID v7(`id`) 및 카테고리명(`name`)
 * @returns 생성(또는 공백 정규화로 매칭)된 카테고리 응답 DTO
 */
export async function createCategoryApi(
  dto: CreateCategoryDto
): Promise<CategoryResponseDto> {
  const { data } = await apiClient.post<CategoryResponseDto>(
    "/categories",
    dto
  );
  return data;
}
