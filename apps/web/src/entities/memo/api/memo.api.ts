import type {
  CreateMemoDto,
  GetMemosQueryDto,
  MemoResponseDto,
  UpdateMemoDto,
} from "@ideamory/api-spec";
import { apiClient } from "@/shared/api";

/**
 * 메모 타임라인 또는 30일 휴지통 목록을 조회합니다.
 *
 * @param query 카테고리 필터(`categoryId`) 및 휴지통 여부(`deleted`)
 * @returns 최신순으로 정렬된 메모 응답 DTO 배열
 */
export async function fetchMemosApi(
  query: Partial<GetMemosQueryDto> = {}
): Promise<MemoResponseDto[]> {
  const { data } = await apiClient.get<MemoResponseDto[]>("/memos", {
    params: {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.deleted !== undefined ? { deleted: query.deleted } : {}),
    },
  });
  return data;
}

/**
 * 클라이언트에서 선발급한 UUID v7 식별자와 본문으로 새 메모를 생성합니다.
 *
 * @param dto `id` (UUID v7) 및 `content` (1~5000자)
 * @returns 서버에 저장된 메모 응답 DTO (`201 Created`)
 */
export async function createMemoApi(
  dto: CreateMemoDto
): Promise<MemoResponseDto> {
  const { data } = await apiClient.post<MemoResponseDto>("/memos", dto);
  return data;
}

/**
 * 기존 메모의 본문 또는 카테고리를 수정합니다.
 *
 * @param id 수정 대상 메모 UUID v7
 * @param dto 변경할 `content` 또는 `categoryId`
 * @returns 수정된 메모 응답 DTO
 */
export async function updateMemoApi(
  id: string,
  dto: UpdateMemoDto
): Promise<MemoResponseDto> {
  const { data } = await apiClient.patch<MemoResponseDto>(`/memos/${id}`, dto);
  return data;
}

/**
 * 메모를 즉시 30일 휴지통으로 이동(Soft Delete)합니다. (`204 No Content`)
 *
 * @param id 삭제할 메모 UUID v7
 */
export async function softDeleteMemoApi(id: string): Promise<void> {
  await apiClient.delete(`/memos/${id}`);
}

/**
 * 휴지통에 보관 중인 메모를 원래 타임라인으로 복구합니다.
 *
 * @param id 복구할 메모 UUID v7
 * @returns 복구된 메모 응답 DTO
 */
export async function restoreMemoApi(id: string): Promise<MemoResponseDto> {
  const { data } = await apiClient.post<MemoResponseDto>(
    `/memos/${id}/restore`
  );
  return data;
}
