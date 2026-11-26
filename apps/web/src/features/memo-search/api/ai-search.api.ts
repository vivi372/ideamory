import type {
  AiSearchRequestDto,
  AiSearchResponseDto,
} from "@ideamory/api-spec";
import { apiClient } from "@/shared/api";

/**
 * 3-Stage Hybrid RAG 파이프라인(`POST /api/v1/memos/ai-search`)을 호출하여
 * 사용자 메모를 근거로 한 AI 브리핑 응답과 출처 메모 목록을 조회합니다.
 *
 * @param payload 자연어 질의어(`query`)가 담긴 요청 DTO
 * @returns 마크다운 브리핑(`answer`) 및 근거 메모(`sources`) DTO
 */
export async function aiSearchApi(
  payload: AiSearchRequestDto
): Promise<AiSearchResponseDto> {
  const { data } = await apiClient.post<AiSearchResponseDto>(
    "/memos/ai-search",
    payload,
    { timeout: 30000 }
  );
  return data;
}
