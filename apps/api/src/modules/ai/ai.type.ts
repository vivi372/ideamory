/**
 * 문두 `@카테고리명` 지시어 파싱 결과 모델
 */
export interface ParsedDirectiveResult {
  /** 추출된 카테고리 표시 이름 (없으면 null) */
  categoryName: string | null;
  /** DB 정규화 비교용 키 (없으면 null) */
  normalizedName: string | null;
  /** 지시어 제거 후 정돈된 메모 본문 */
  cleanedContent: string;
}
