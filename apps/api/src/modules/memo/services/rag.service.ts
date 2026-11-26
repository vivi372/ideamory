import { Injectable, Logger } from "@nestjs/common";
import type {
  AiSearchRequestDto,
  AiSearchResponseDto,
  AiSearchSourceDto,
  SearchResultResponseDto,
} from "@ideamory/api-spec";
import { LogTrace } from "../../../common/decorators/log-trace.decorator";
import {
  assertOwnerIdentity,
  type OwnerIdentity,
} from "../../../common/types/owner.type";
import { AiService } from "../../ai/ai.service";
import { sanitizeSearchQuery, toSearchResultResponseDto } from "../memo.helper";
import { MemoRepository } from "../memo.repository";
import {
  RAG_BRIEFING_SYSTEM_INSTRUCTION,
  RAG_EMPTY_SOURCES_ANSWER,
  RAG_QUERY_DECOMPOSITION_INSTRUCTION,
} from "../prompts/rag-briefing.prompt";

/** RRF(Reciprocal Rank Fusion) 순위 감쇠 상수 k */
const RRF_K = 60;
/** 서브쿼리당 하이브리드 검색 후보 조회 상한 */
const SUBQUERY_SEARCH_LIMIT = 30;
/** 하이브리드 검색 최소 코사인 유사도 임계값 */
const SUBQUERY_VECTOR_THRESHOLD = 0.65;
/** LLM 브리핑 컨텍스트 및 sources 배열에 포함할 최대 근거 메모 수 */
const MAX_RAG_SOURCES = 5;
/** 서브쿼리 분해 최대 개수 */
const MAX_SUBQUERIES = 3;

interface RankedRagCandidate {
  dto: SearchResultResponseDto;
  rrfBaseSum: number;
  appearances: number;
  finalRrfScore: number;
}

/**
 * 6-1. 내 메모 기반 AI 브레인 RAG(Retrieval-Augmented Generation) 검색 파이프라인 서비스
 *
 * [4단계 검색·증강 파이프라인]
 * 1. LLM 서브쿼리 분해: 긴 자연어 질문으로 인한 단문 메모 벡터 유사도 희석을 막기 위해
 *    구체적 명사형 키워드/단문 2~3개로 분해합니다.
 * 2. 배치 임베딩 & 병렬 검색: `batchEmbedContents` 1회 호출 후 `searchMemosHybrid`를 병렬 실행합니다.
 * 3. RRF 빈도 가중치 합산: `Score(m) = Σ(1 / (60 + rank(q, m))) × (중복 출현 횟수)` 산식으로
 *    복수 서브쿼리에 동시 등장한 메모를 `[중요도: 매우 높음]` 앵커로 승격하고 상위 3~5건을 추출합니다.
 * 4. 구조화 마크다운 브리핑 생성: 1행 굵은 결론 요약 + 2~3개 불릿 포인트로 인과관계를 엮어 반환합니다.
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly memoRepository: MemoRepository,
    private readonly aiService: AiService
  ) {}

  /**
   * 사용자의 자연어 질문을 받아 멀티 쿼리 RAG 검색 및 마크다운 브리핑을 생성합니다.
   *
   * @param owner 인증된 요청 주체(`userId` 또는 `guestToken`)
   * @param dto 자연어 검색 질문 DTO(`query`, 1~500자)
   * @returns 구조화 마크다운 브리핑(`answer`) 및 상위 3~5건 근거 메모(`sources`)
   */
  @LogTrace()
  async searchAndBrief(
    owner: OwnerIdentity,
    dto: AiSearchRequestDto
  ): Promise<AiSearchResponseDto> {
    assertOwnerIdentity(owner);

    const sanitizedQuery = sanitizeSearchQuery(dto.query);
    if (!sanitizedQuery) {
      return {
        answer: RAG_EMPTY_SOURCES_ANSWER,
        sources: [],
      };
    }

    // 1단계: LLM 서브쿼리 분해 (실패·미설정 시 원문 질의 단일 배열 폴백)
    const subQueries = await this.decomposeQueries(sanitizedQuery);

    // 2단계: 배치 임베딩 1회 호출 및 서브쿼리별 하이브리드 검색 병렬 실행
    const queryVectors = await this.aiService.batchEmbedContents(subQueries);
    const searchResultsPerQuery = await Promise.all(
      subQueries.map((subQuery, idx) =>
        this.memoRepository.searchMemosHybrid({
          owner,
          queryText: subQuery,
          queryVector: queryVectors[idx] ?? null,
          threshold: SUBQUERY_VECTOR_THRESHOLD,
          limit: SUBQUERY_SEARCH_LIMIT,
        })
      )
    );

    // 3단계: RRF 빈도 가중치 합산 및 상위 3~5건 앵커 선별
    const rankedCandidates = this.rankCandidatesByRrf(
      searchResultsPerQuery.map((rows) => rows.map(toSearchResultResponseDto))
    ).slice(0, MAX_RAG_SOURCES);

    if (rankedCandidates.length === 0) {
      return {
        answer: RAG_EMPTY_SOURCES_ANSWER,
        sources: [],
      };
    }

    const sources: AiSearchSourceDto[] = rankedCandidates.map(({ dto: row }) => ({
      id: row.id,
      content: row.content,
      categoryName: row.categoryName,
      ogp: row.ogp ?? null,
      createdAt: row.createdAt,
    }));

    // 4단계: 구조화 마크다운 브리핑 생성 (LLM 장애 시 상위 근거 메모 요약 폴백)
    const contextLines = rankedCandidates.map((candidate, index) => {
      const isAnchor = candidate.appearances >= 2;
      const anchorTag = isAnchor ? "[중요도: 매우 높음] " : "";
      const clippedContent =
        candidate.dto.content.length > 500
          ? `${candidate.dto.content.slice(0, 500)}...`
          : candidate.dto.content;
      return `[메모 ${index + 1}] ${anchorTag}(카테고리: ${candidate.dto.categoryName}, 작성일: ${candidate.dto.createdAt.slice(0, 10)})\n${clippedContent}`;
    });

    const briefingPrompt = [
      `사용자 질문: ${sanitizedQuery}`,
      "",
      "검색된 근거 메모 목록:",
      contextLines.join("\n\n"),
    ].join("\n");

    const generatedAnswer = await this.aiService.generateTextWithInstruction({
      systemInstruction: RAG_BRIEFING_SYSTEM_INSTRUCTION,
      prompt: briefingPrompt,
      temperature: 0.25,
      maxOutputTokens: 512,
      timeoutMs: 12000,
    });

    const answer =
      generatedAnswer ??
      this.buildFallbackBriefing(sanitizedQuery, rankedCandidates);

    return {
      answer,
      sources,
    };
  }

  /**
   * 1단계: 긴 자연어 질의를 2~3개의 구체적 검색 서브쿼리로 분해합니다.
   * JSON 파싱 실패 또는 Gemini 미응답 시 정제된 원문 질의 1개를 그대로 반환해 검색 중단을 방지합니다.
   *
   * @param sanitizedQuery 정제된 사용자 질문
   * @returns 1~3개의 정제된 서브쿼리 배열
   */
  private async decomposeQueries(sanitizedQuery: string): Promise<string[]> {
    const raw = await this.aiService.generateTextWithInstruction({
      systemInstruction: RAG_QUERY_DECOMPOSITION_INSTRUCTION,
      prompt: `질문: ${sanitizedQuery}`,
      temperature: 0.1,
      maxOutputTokens: 160,
      timeoutMs: 6000,
    });

    if (!raw) {
      return [sanitizedQuery];
    }

    try {
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) {
        return [sanitizedQuery];
      }

      const uniqueQueries: string[] = [];
      const seen = new Set<string>();
      for (const item of parsed) {
        if (typeof item !== "string") {
          continue;
        }
        const normalized = sanitizeSearchQuery(item);
        if (!normalized || seen.has(normalized)) {
          continue;
        }
        seen.add(normalized);
        uniqueQueries.push(normalized);
        if (uniqueQueries.length >= MAX_SUBQUERIES) {
          break;
        }
      }

      return uniqueQueries.length > 0 ? uniqueQueries : [sanitizedQuery];
    } catch (error: any) {
      this.logger.debug(
        `서브쿼리 JSON 파싱 실패로 원문 질의 폴백 사용: ${error?.message || error}`
      );
      return [sanitizedQuery];
    }
  }

  /**
   * 3단계: 복수 서브쿼리 검색 결과를 RRF(Reciprocal Rank Fusion) 빈도 가중치 합산으로 재정렬합니다.
   *
   * 산식: `Score(m) = Σ (1 / (60 + rank(q, m))) * appearances(m)`
   * 단일 쿼리에서만 높은 점수를 얻은 메모보다 복수 서브쿼리에서 일관되게 상위에 랭크된 메모를
   * 핵심 앵커로 우선 배치합니다.
   *
   * @param perQueryResults 서브쿼리별 하이브리드 검색 결과 목록
   * @returns 최종 RRF 점수 내림차순으로 정렬된 후보 목록
   */
  public rankCandidatesByRrf(
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
   * Gemini 브리핑 호출이 불가하거나 실패했을 때 근거 메모를 바탕으로 반환하는 안전 폴백 요약입니다.
   *
   * @param query 정제된 사용자 질문
   * @param candidates 선별된 상위 근거 메모 후보
   * @returns 마크다운 규격을 준수한 폴백 요약 문자열
   */
  private buildFallbackBriefing(
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
}
