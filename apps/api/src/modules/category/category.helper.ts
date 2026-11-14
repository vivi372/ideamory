import type { MergeSuggestionResponseDto } from "@ideamory/api-spec";

/**
 * DB에서 조회된 유사 카테고리 병합 제안 조인 행 타입
 */
export interface MergeSuggestionJoinedRow {
  id: string;
  sourceCategoryId: string;
  sourceCategoryName: string;
  targetCategoryId: string;
  targetCategoryName: string;
  similarity: number;
}

/**
 * 단일 제안 조인 행을 API 응답 DTO(`MergeSuggestionResponseDto`)로 변환합니다.
 * 코사인 유사도는 소수점 넷째 자리에서 반올림해 일관된 수치를 제공합니다.
 *
 * @param row DB에서 조회된 제안 조인 행
 * @returns 직렬화된 병합 제안 응답 DTO
 */
export function toMergeSuggestionResponseDto(
  row: MergeSuggestionJoinedRow
): MergeSuggestionResponseDto {
  return {
    id: row.id,
    sourceCategoryId: row.sourceCategoryId,
    sourceCategoryName: row.sourceCategoryName,
    targetCategoryId: row.targetCategoryId,
    targetCategoryName: row.targetCategoryName,
    similarity: Number(row.similarity.toFixed(4)),
  };
}

/**
 * 병합 제안 목록을 API 응답 DTO 배열로 일괄 매핑합니다.
 *
 * @param rows DB에서 조회된 제안 조인 행 목록
 * @returns 병합 제안 응답 DTO 배열
 */
export function toMergeSuggestionResponseList(
  rows: MergeSuggestionJoinedRow[]
): MergeSuggestionResponseDto[] {
  return rows.map(toMergeSuggestionResponseDto);
}
