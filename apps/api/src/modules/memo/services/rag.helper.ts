import type {
  AiSearchSourceDto,
  SearchResultResponseDto,
} from "@ideamory/api-spec";
import { sanitizeSearchQuery } from "../memo.helper";

/** RRF(Reciprocal Rank Fusion) 순위 감쇠 상수 k */
export const RRF_K = 60;

export interface RankedRagCandidate {
  dto: SearchResultResponseDto;
  rrfBaseSum: number;
  appearances: number;
  finalRrfScore: number;
}

/**
 * LLM이 반환한 서브쿼리 JSON 배열 문자열을 파싱·중복 제거하여 최대 `maxCount`개의 검색 키워드로 정제합니다.
 * JSON 파싱 실패나 빈 배열인 경우 정제된 원문 질의를 폴백으로 반환합니다.
 *
 * @param raw LLM 원시 응답 문자열(또는 null)
 * @param fallbackQuery 파싱 실패 시 대체할 정제된 원문 질의
 * @param maxCount 최대 서브쿼리 개수
 * @returns 1~maxCount개의 정제된 서브쿼리 배열
 */
export function parseDecomposedSubQueries(
  raw: string | null,
  fallbackQuery: string,
  maxCount: number
): string[] {
  if (!raw) {
    return [fallbackQuery];
  }

  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) {
      return [fallbackQuery];
    }

    const uniqueQueries: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (typeof item !== "string") {
        continue;
      }
      const normalized = sanitizeSearchQuery(item);
      const dedupeKey = normalized.replace(/\s+/g, "").toLowerCase();
      if (!normalized || !dedupeKey || seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      uniqueQueries.push(normalized);
      if (uniqueQueries.length >= maxCount) {
        break;
      }
    }

    return uniqueQueries.length > 0 ? uniqueQueries : [fallbackQuery];
  } catch {
    return [fallbackQuery];
  }
}

/**
 * 복수 서브쿼리 검색 결과를 RRF(Reciprocal Rank Fusion) 빈도 가중치 합산으로 재정렬합니다.
 *
 * 산식: `Score(m) = Σ (1 / (60 + rank(q, m))) * appearances(m)`
 * 복수 서브쿼리에서 일관되게 상위에 랭크된 메모를 0순위 핵심 앵커로 승격합니다.
 *
 * @param perQueryResults 서브쿼리별 하이브리드 검색 결과 목록
 * @returns 최종 RRF 점수 내림차순으로 정렬된 후보 목록
 */
export function rankCandidatesByRrf(
  perQueryResults: SearchResultResponseDto[][]
): RankedRagCandidate[] {
  const candidateMap = new Map<
    string,
    { dto: SearchResultResponseDto; rrfBaseSum: number; appearances: number }
  >();

  for (const rows of perQueryResults) {
    const seenInThisQuery = new Set<string>();
    rows.forEach((row, index) => {
      if (seenInThisQuery.has(row.id)) {
        return;
      }
      seenInThisQuery.add(row.id);

      const rank = index + 1;
      const rrfIncrement = 1 / (RRF_K + rank);
      const existing = candidateMap.get(row.id);

      if (existing) {
        existing.rrfBaseSum += rrfIncrement;
        existing.appearances += 1;
      } else {
        candidateMap.set(row.id, {
          dto: row,
          rrfBaseSum: rrfIncrement,
          appearances: 1,
        });
      }
    });
  }

  return Array.from(candidateMap.values())
    .map((item) => ({
      ...item,
      finalRrfScore: item.rrfBaseSum * item.appearances,
    }))
    .sort((a, b) => {
      if (b.finalRrfScore !== a.finalRrfScore) {
        return b.finalRrfScore - a.finalRrfScore;
      }
      return b.dto.finalScore - a.dto.finalScore;
    });
}

/**
 * 선별된 RRF 후보들을 LLM 브리핑 프롬프트 컨텍스트 문자열로 직렬화합니다.
 * 프롬프트 인젝션 방어를 위해 질문(`<user_query>`)과 메모 데이터(`<memo_context>`)를 XML 태그로 명확히 격리하며,
 * 2개 이상 서브쿼리에 동시 등장한 앵커 메모에는 `[중요도: 매우 높음]` 태그를 부여합니다.
 *
 * @param query 정제된 사용자 질문
 * @param candidates 선별된 상위 근거 메모 후보 목록
 * @returns Gemini 브리핑 입력 프롬프트 문자열
 */
export function buildRagBriefingPrompt(
  query: string,
  candidates: RankedRagCandidate[]
): string {
  const contextLines = candidates.map((candidate, index) => {
    const anchorTag = candidate.appearances >= 2 ? "[중요도: 매우 높음] " : "";
    const clippedContent =
      candidate.dto.content.length > 500
        ? `${candidate.dto.content.slice(0, 500)}...`
        : candidate.dto.content;
    return `[메모 ${index + 1}] ${anchorTag}(카테고리: ${candidate.dto.categoryName}, 작성일: ${candidate.dto.createdAt.slice(0, 10)})\n${clippedContent}`;
  });

  return [
    `<user_query>${query}</user_query>`,
    "",
    "<memo_context>",
    contextLines.join("\n\n"),
    "</memo_context>",
  ].join("\n");
}

/**
 * RRF 후보 목록을 `AiSearchSourceDto[]` 응답 형식으로 직렬화합니다.
 *
 * @param candidates 선별된 상위 근거 메모 후보 목록
 * @returns 근거 메모 DTO 배열
 */
export function toAiSearchSources(
  candidates: RankedRagCandidate[]
): AiSearchSourceDto[] {
  return candidates.map(({ dto }) => ({
    id: dto.id,
    content: dto.content,
    categoryId: dto.categoryId,
    categoryName: dto.categoryName,
    ogp: dto.ogp ?? null,
    createdAt: dto.createdAt,
  }));
}

/**
 * LLM 브리핑 응답에 마크다운 코드펜스(```markdown ... ```)나 불필요한 서두 인사말이 섞여 있을 경우
 * 이를 제거하여 일관된 `**1행 결론** + 불릿 포인트` 형식으로 정제합니다.
 *
 * @param raw LLM 원시 브리핑 문자열
 * @returns 정제된 마크다운 브리핑 문자열
 */
export function sanitizeBriefingMarkdown(raw: string): string {
  const withoutFence = raw
    .trim()
    .replace(/^```(?:markdown|md)?\s*\r?\n?/i, "")
    .replace(/\r?\n?```\s*$/i, "")
    .trim();

  const lines = withoutFence.split(/\r?\n/);
  const greetingPattern =
    /^(안녕하세요|네,|물론입니다|사용자님의\s*메모에\s*따르면|요청하신\s*내용)/;
  while (lines.length > 1 && greetingPattern.test(lines[0].trim())) {
    lines.shift();
  }

  return lines.join("\n").trim();
}

/**
 * Gemini 브리핑 호출이 불가하거나 실패했을 때 근거 메모를 바탕으로 반환하는 안전 폴백 요약입니다.
 *
 * @param query 정제된 사용자 질문
 * @param candidates 선별된 상위 근거 메모 후보 목록
 * @returns 1행 굵은 요약 + 불릿 포맷의 폴백 문자열
 */
export function buildFallbackBriefing(
  query: string,
  candidates: RankedRagCandidate[]
): string {
  const bullets = candidates.slice(0, 3).map(({ dto }) => {
    const snippet =
      dto.content.length > 80 ? `${dto.content.slice(0, 80)}...` : dto.content;
    return `* **${dto.categoryName}**: ${snippet.replace(/\s+/g, " ")}`;
  });
  return `**"${query}"와 관련된 메모 ${candidates.length}건을 찾았습니다.**\n\n${bullets.join("\n")}`;
}
