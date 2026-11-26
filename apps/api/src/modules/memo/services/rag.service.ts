import { Injectable } from "@nestjs/common";
import type {
  AiSearchRequestDto,
  AiSearchResponseDto,
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
import {
  buildFallbackBriefing,
  buildRagBriefingPrompt,
  parseDecomposedSubQueries,
  rankCandidatesByRrf,
  sanitizeBriefingMarkdown,
  toAiSearchSources,
} from "./rag.helper";

/** 서브쿼리당 하이브리드 검색 후보 조회 상한 */
const SUBQUERY_SEARCH_LIMIT = 30;
/** 하이브리드 검색 최소 코사인 유사도 임계값 (gemini-embedding-2 단문·키워드 매칭 보정) */
const SUBQUERY_VECTOR_THRESHOLD = 0.45;
/** LLM 브리핑 컨텍스트 및 sources 배열에 포함할 최대 근거 메모 수 */
const MAX_RAG_SOURCES = 5;
/** 서브쿼리 분해 최대 개수 */
const MAX_SUBQUERIES = 3;

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
    const rawSubQueries = await this.aiService.generateTextWithInstruction({
      systemInstruction: RAG_QUERY_DECOMPOSITION_INSTRUCTION,
      prompt: `질문: ${sanitizedQuery}`,
      temperature: 0.1,
      maxOutputTokens: 160,
      timeoutMs: 6000,
    });
    const subQueries = parseDecomposedSubQueries(
      rawSubQueries,
      sanitizedQuery,
      MAX_SUBQUERIES
    );

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
    const rankedCandidates = rankCandidatesByRrf(
      searchResultsPerQuery.map((rows) => rows.map(toSearchResultResponseDto))
    ).slice(0, MAX_RAG_SOURCES);

    if (rankedCandidates.length === 0) {
      return {
        answer: RAG_EMPTY_SOURCES_ANSWER,
        sources: [],
      };
    }

    // 4단계: 구조화 마크다운 브리핑 생성 (LLM 장애 시 상위 근거 메모 요약 폴백)
    const briefingPrompt = buildRagBriefingPrompt(
      sanitizedQuery,
      rankedCandidates
    );
    const generatedAnswer = await this.aiService.generateTextWithInstruction({
      systemInstruction: RAG_BRIEFING_SYSTEM_INSTRUCTION,
      prompt: briefingPrompt,
      temperature: 0.35,
      maxOutputTokens: 800,
      timeoutMs: 25000,
    });

    const sanitizedAnswer = generatedAnswer
      ? sanitizeBriefingMarkdown(generatedAnswer)
      : "";

    return {
      answer:
        sanitizedAnswer ||
        buildFallbackBriefing(sanitizedQuery, rankedCandidates),
      sources: toAiSearchSources(rankedCandidates),
    };
  }
}
