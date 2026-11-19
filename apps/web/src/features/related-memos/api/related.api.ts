import type {
  RelatedMemoQueryDto,
  RelatedMemoResponseDto,
} from "@ideamory/api-spec";
import { apiClient } from "../../../shared/api";

/**
 * 기준 메모의 768차원 임베딩과 코사인 유사도 0.8 이상인 연관 메모 목록을 조회합니다.
 *
 * @param memoId 기준 메모 UUID v7
 * @param query 코사인 유사도 하한(`threshold`, 기본 0.8) 및 최대 개수(`limit`, 기본 10)
 * @returns 유사도 내림차순 연관 메모 DTO 배열
 */
export async function fetchRelatedMemosApi(
  memoId: string,
  query: Partial<RelatedMemoQueryDto> = {}
): Promise<RelatedMemoResponseDto[]> {
  const { data } = await apiClient.get<RelatedMemoResponseDto[]>(
    `/memos/${memoId}/related`,
    {
      params: {
        ...(query.threshold !== undefined
          ? { threshold: query.threshold }
          : {}),
        ...(query.limit !== undefined ? { limit: query.limit } : {}),
      },
    }
  );
  return data;
}
