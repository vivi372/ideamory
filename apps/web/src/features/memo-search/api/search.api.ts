import type {
  SearchMemoQueryDto,
  SearchResultResponseDto,
} from "@ideamory/api-spec";
import { apiClient } from "@/shared/api";

/**
 * Gemini 768차원 벡터 코사인 유사도(0.6)와 PostgreSQL FTS 키워드 점수(0.4)를
 * 가중 결합한 하이브리드 검색 API를 호출합니다.
 *
 * 타이핑 도중 실시간 호출을 배제하고, 사용자가 `[Enter]` 또는 `[검색]` 버튼을
 * 명시적으로 실행했을 때만 호출됩니다.
 *
 * @param query 검색 질의어(`q`), 유사도 하한(`threshold`), 최대 개수(`limit`)
 * @returns 합산 점수(`finalScore`) 내림차순 검색 결과 DTO 배열
 */
export async function searchMemosApi(
  query: Partial<SearchMemoQueryDto> & { q: string }
): Promise<SearchResultResponseDto[]> {
  const { data } = await apiClient.get<SearchResultResponseDto[]>(
    "/memos/search",
    {
      params: {
        q: query.q,
        ...(query.threshold !== undefined
          ? { threshold: query.threshold }
          : {}),
        ...(query.limit !== undefined ? { limit: query.limit } : {}),
      },
    }
  );
  return data;
}
