import type {
  OgpResponseDto,
  RelatedMemoResponseDto,
  SearchResultResponseDto,
} from "@ideamory/api-spec";
import type {
  HybridSearchRawRow,
  JoinedOgpRawFields,
  RelatedMemoRawRow,
} from "./memo.type";

/**
 * 검색어에서 제어문자를 제거하고 연속 공백을 단일 공백으로 정제합니다.
 * PostgreSQL `plainto_tsquery('simple', ...)`와 Gemini 임베딩 API 모두에 일관된 입력을 전달하기 위함입니다.
 *
 * @param rawQuery 사용자가 입력한 원본 검색어
 * @returns 정제된 검색어 문자열
 */
export function sanitizeSearchQuery(rawQuery: string): string {
  return rawQuery
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 768차원 실수 배열을 PostgreSQL pgvector 캐스팅(`::vector`)에 사용할 문자열 리터럴로 직렬화합니다.
 * 파라미터 바인딩 시 유한하지 않은 숫자(NaN/Infinity)가 포함되지 않도록 방어합니다.
 *
 * @param embedding 768차원 임베딩 벡터 배열
 * @returns `[v1,v2,...]` 형태의 pgvector 리터럴 문자열
 * @throws Error 비정상적인 숫자 요소가 포함된 경우
 */
export function toPgVectorLiteral(embedding: number[]): string {
  const sanitized = embedding.map((val) => {
    if (!Number.isFinite(val)) {
      throw new Error("유효하지 않은 임베딩 벡터 요소가 포함되어 있습니다.");
    }
    return val;
  });
  return `[${sanitized.join(",")}]`;
}

/**
 * 점수를 0.0 ~ 1.0 범위로 안전하게 클램핑하고 소수점 넷째 자리에서 반올림합니다.
 * 부동소수점 오차로 인해 코사인 유사도가 `1.0000000000000002` 또는 `-0.0`으로 표출되는 현상을 방지합니다.
 *
 * @param value 원본 실수 스코어
 * @returns [0, 1] 범위의 반올림된 점수
 */
export function clampAndRoundScore(value: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  const clamped = Math.min(1, Math.max(0, numeric));
  return Number(clamped.toFixed(4));
}

/**
 * Raw SQL 결과의 날짜 컬럼(Date 객체 또는 ISO 문자열)을 ISO8601 문자열로 안전하게 변환합니다.
 *
 * @param value Date 인스턴스 또는 날짜 문자열
 * @returns ISO8601 타임스탬프 문자열
 */
export function toIsoStringSafe(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

/**
 * Raw SQL에서 LEFT JOIN으로 조회된 OGP 컬럼들을 API 응답 규격(`OgpResponseDto`)으로 매핑합니다.
 * 만료되었거나 연결된 OGP 캐시가 없어 `ogpId` 또는 `ogpTargetUrl`이 NULL이면 `null`을 반환합니다.
 *
 * @param row OGP 조인 컬럼을 포함한 Raw SQL 결과 행
 * @returns 직렬화된 OGP 응답 객체 또는 null
 */
export function mapJoinedOgpRow(
  row: JoinedOgpRawFields
): OgpResponseDto | null {
  if (!row.ogpId || !row.ogpTargetUrl || !row.ogpExpiresAt) {
    return null;
  }

  return {
    id: row.ogpId,
    targetUrl: row.ogpTargetUrl,
    title: row.ogpTitle ?? null,
    thumbnailUrl: row.ogpThumbnailUrl ?? null,
    description: row.ogpDescription ?? null,
    expiresAt: toIsoStringSafe(row.ogpExpiresAt),
    ...(row.ogpFetchedAt
      ? { fetchedAt: toIsoStringSafe(row.ogpFetchedAt) }
      : {}),
  };
}

/**
 * 하이브리드 검색 Raw SQL 행을 API 응답 DTO(`SearchResultResponseDto`)로 변환합니다.
 *
 * @param row DB에서 조회된 하이브리드 검색 결과 행
 * @returns 직렬화된 검색 결과 응답 DTO
 */
export function toSearchResultResponseDto(
  row: HybridSearchRawRow
): SearchResultResponseDto {
  return {
    id: row.id,
    content: row.content,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    ftsScore: clampAndRoundScore(row.ftsScore),
    vectorScore: clampAndRoundScore(row.vectorScore),
    finalScore: clampAndRoundScore(row.finalScore),
    ogp: mapJoinedOgpRow(row),
    createdAt: toIsoStringSafe(row.createdAt),
  };
}

/**
 * 하이브리드 검색 결과 목록을 API 응답 DTO 배열로 일괄 변환합니다.
 *
 * @param rows DB에서 조회된 하이브리드 검색 결과 행 목록
 * @returns 검색 결과 응답 DTO 배열
 */
export function toSearchResultResponseList(
  rows: HybridSearchRawRow[]
): SearchResultResponseDto[] {
  return rows.map(toSearchResultResponseDto);
}

/**
 * 연관 메모 Raw SQL 행을 API 응답 DTO(`RelatedMemoResponseDto`)로 변환합니다.
 *
 * @param row DB에서 조회된 연관 메모 결과 행
 * @returns 직렬화된 연관 메모 응답 DTO
 */
export function toRelatedMemoResponseDto(
  row: RelatedMemoRawRow
): RelatedMemoResponseDto {
  return {
    id: row.id,
    content: row.content,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    similarity: clampAndRoundScore(row.similarity),
    ogp: mapJoinedOgpRow(row),
    createdAt: toIsoStringSafe(row.createdAt),
  };
}

/**
 * 연관 메모 목록을 API 응답 DTO 배열로 일괄 변환합니다.
 *
 * @param rows DB에서 조회된 연관 메모 결과 행 목록
 * @returns 연관 메모 응답 DTO 배열
 */
export function toRelatedMemoResponseList(
  rows: RelatedMemoRawRow[]
): RelatedMemoResponseDto[] {
  return rows.map(toRelatedMemoResponseDto);
}
