import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import {
  ERROR_CODES,
  type CreateCategoryDto,
  type UpdateCategoryDto,
  type MergeCategoryDto,
  type CategoryResponseDto,
  type MergeCategoryResponseDto,
  type MergeSuggestionResponseDto,
} from "@ideamory/api-spec";
import { BusinessException } from "../../common/exceptions/business.exception";
import type { OwnerIdentity } from "../../common/types/owner.type";
import { AiService } from "../ai/ai.service";
import { toMergeSuggestionResponseList } from "./category.helper";
import { CategoryRepository } from "./category.repository";

/**
 * 카테고리 관리, AI 유사 카테고리 탐지 제안 큐 및 원클릭 병합 비즈니스 서비스
 *
 * [설계 원칙]
 * 1. 공백 정규화(Whitespace Normalization): `name.replace(/\s+/g, "").toLowerCase()` 키로 띄어쓰기 파편화(`예외 사항` vs `예외사항`)를 방지합니다.
 * 2. 실시간 활성 가시성(Zero-Overhead Visibility): 활성 메모(deleted_at IS NULL)가 1건 이상인 카테고리만 목록에 노출합니다.
 * 3. 비동기 탐지 파이프라인: 카테고리 생성/수정 시 즉시 HTTP 응답을 반환한 뒤 백그라운드에서 768차원 임베딩 저장 및 유사 카테고리(코사인 유사도 >= 0.85) 큐잉을 수행합니다.
 * 4. 원자적 병합 트랜잭션: sourceCategoryId의 모든 메모(휴지통 포함)를 targetCategoryId로 이전한 뒤 원본 카테고리를 삭제하여 ON DELETE CASCADE로 제안 큐도 자동 소멸시킵니다.
 */
@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly aiService: AiService
  ) {}

  /**
   * 요청 주체(소셜 정회원 또는 게스트)의 식별자가 유효한지 검증합니다.
   *
   * @throws BusinessException userId와 guestToken이 모두 누락된 경우 401 Unauthorized 발생
   */
  private assertOwner(owner: OwnerIdentity): void {
    if (!owner.userId && !owner.guestToken) {
      throw new BusinessException(
        "인증 토큰 또는 게스트 토큰이 필요합니다.",
        ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  /**
   * 표시용 카테고리명에서 모든 공백을 제거하고 소문자로 변환한 정규화 키를 생성합니다.
   *
   * @param name 앞뒤 공백이 정리된 카테고리 표시명 (1~10자)
   * @returns 유니크 인덱스 비교용 정규화 문자열
   */
  public normalizeCategoryName(name: string): string {
    return name.trim().replace(/\s+/g, "").toLowerCase();
  }

  /**
   * 활성 메모(deleted_at IS NULL)가 1건 이상 존재하는 소유자의 카테고리 목록을 조회합니다.
   *
   * @param owner 요청 주체(userId 또는 guestToken)
   * @returns 활성 메모 수(`memoCount`)가 포함된 카테고리 목록
   */
  async getCategories(owner: OwnerIdentity): Promise<CategoryResponseDto[]> {
    this.assertOwner(owner);
    return this.categoryRepository.findActiveCategoriesWithMemoCount(owner);
  }

  /**
   * 신규 텍스트 전용 카테고리를 수동 생성합니다.
   * 동일 세션 내 공백 정규화 키가 중복되는 경우 409 Conflict 예외를 발생시킵니다.
   *
   * @param owner 요청 주체(userId 또는 guestToken)
   * @param dto 선발급 UUID v7 및 1~10자 카테고리명
   * @returns 생성된 카테고리 응답 DTO
   * @throws BusinessException 중복 카테고리명 존재 시 409 Conflict 발생
   */
  async createCategory(
    owner: OwnerIdentity,
    dto: CreateCategoryDto
  ): Promise<CategoryResponseDto> {
    this.assertOwner(owner);

    const trimmedName = dto.name.trim();
    const normalizedName = this.normalizeCategoryName(trimmedName);

    const duplicate =
      await this.categoryRepository.findCategoryByNormalizedName(
        owner,
        normalizedName
      );
    if (duplicate) {
      throw new BusinessException(
        "동일한 이름의 카테고리가 이미 존재합니다.",
        ERROR_CODES.CATEGORY_WARN_DUPLICATE,
        HttpStatus.CONFLICT
      );
    }

    const created = await this.categoryRepository.insertCategory({
      id: dto.id,
      owner,
      name: trimmedName,
      normalizedName,
    });

    // 응답 지연 방지를 위해 백그라운드에서 카테고리 임베딩 생성 및 유사 카테고리 탐지 트리거
    void this.syncCategoryEmbeddingAndDetectSimilar(created.id, created.name);

    return {
      id: created.id,
      name: created.name,
      memoCount: 0,
    };
  }

  /**
   * 기존 카테고리의 명칭을 수정합니다.
   * 대상 카테고리의 소유권 검증 및 자기 자신을 제외한 공백 정규화 중복 검사를 수행합니다.
   *
   * @param owner 요청 주체(userId 또는 guestToken)
   * @param categoryId 수정할 카테고리 UUID v7
   * @param dto 새 카테고리명 (1~10자, 이모지 배제)
   * @returns 수정된 카테고리 및 현재 활성 메모 수
   * @throws BusinessException 미존재/타인 소유 시 404, 정규화 이름 중복 시 409 발생
   */
  async updateCategory(
    owner: OwnerIdentity,
    categoryId: string,
    dto: UpdateCategoryDto
  ): Promise<CategoryResponseDto> {
    this.assertOwner(owner);

    const trimmedName = dto.name.trim();
    const normalizedName = this.normalizeCategoryName(trimmedName);

    const existing = await this.categoryRepository.findCategoryByIdAndOwner(
      categoryId,
      owner
    );
    if (!existing) {
      throw new BusinessException(
        "수정할 카테고리를 찾을 수 없습니다.",
        ERROR_CODES.CATEGORY_WARN_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    // 기존 명칭과 동일하면 불필요한 제안 큐 삭제 및 Gemini 재임베딩 호출을 생략합니다.
    if (existing.name === trimmedName) {
      const memoCount =
        await this.categoryRepository.countActiveMemosByCategoryId(
          categoryId,
          owner
        );
      return {
        id: existing.id,
        name: existing.name,
        memoCount,
      };
    }

    const duplicate =
      await this.categoryRepository.findCategoryByNormalizedName(
        owner,
        normalizedName,
        categoryId
      );
    if (duplicate) {
      throw new BusinessException(
        "동일한 이름의 카테고리가 이미 존재합니다.",
        ERROR_CODES.CATEGORY_WARN_DUPLICATE,
        HttpStatus.CONFLICT
      );
    }

    // 이름 변경과 기존 병합 제안 큐 정리를 단일 트랜잭션으로 묶어 원자성을 보장합니다.
    const updated = await this.categoryRepository.withTransaction(async (tx) => {
      const renamed = await this.categoryRepository.updateCategoryName(
        categoryId,
        owner,
        trimmedName,
        normalizedName,
        tx
      );
      await this.categoryRepository.deleteSuggestionsByCategoryId(
        categoryId,
        owner,
        tx
      );
      return renamed;
    });

    const memoCount =
      await this.categoryRepository.countActiveMemosByCategoryId(
        categoryId,
        owner
      );

    // 낙관적 200 OK 반환 후 백그라운드 워커에서 새 카테고리명 임베딩 갱신 및 유사 카테고리 재탐지
    void this.syncCategoryEmbeddingAndDetectSimilar(updated.id, updated.name);

    return {
      id: updated.id,
      name: updated.name,
      memoCount,
    };
  }

  /**
   * 단일 PostgreSQL 트랜잭션 내에서 원본 카테고리(`sourceCategoryId`)의 모든 메모를
   * 대상 카테고리(`targetCategoryId`)로 이전하고 빈 원본 카테고리를 삭제합니다.
   *
   * @param owner 요청 주체(userId 또는 guestToken)
   * @param dto 원본 및 대상 카테고리 UUID v7
   * @returns 통합 성공 여부 및 이전된 메모 건수
   * @throws BusinessException 동일 ID 병합 시 400, 미존재/타인 소유 시 404 발생
   */
  async mergeCategories(
    owner: OwnerIdentity,
    dto: MergeCategoryDto
  ): Promise<MergeCategoryResponseDto> {
    this.assertOwner(owner);

    if (dto.sourceCategoryId === dto.targetCategoryId) {
      throw new BusinessException(
        "동일한 카테고리끼리는 병합할 수 없습니다.",
        ERROR_CODES.CATEGORY_ERROR_MERGE_SAME,
        HttpStatus.BAD_REQUEST
      );
    }

    return this.categoryRepository.withTransaction(async (tx) => {
      // 1. 병합 원본과 대상 카테고리 모두 현재 요청자의 소유인지 동시 검증
      const [source, target] = await Promise.all([
        this.categoryRepository.findCategoryByIdAndOwner(
          dto.sourceCategoryId,
          owner,
          tx
        ),
        this.categoryRepository.findCategoryByIdAndOwner(
          dto.targetCategoryId,
          owner,
          tx
        ),
      ]);

      if (!source || !target) {
        throw new BusinessException(
          "병합할 카테고리를 찾을 수 없습니다.",
          ERROR_CODES.CATEGORY_WARN_NOT_FOUND,
          HttpStatus.NOT_FOUND
        );
      }

      // 2. 활성·휴지통 메모 전체를 대상 카테고리로 원자적 이전
      const affectedMemosCount =
        await this.categoryRepository.reassignMemosCategory(
          dto.sourceCategoryId,
          dto.targetCategoryId,
          owner,
          tx
        );

      // 3. 참조 메모가 0건이 된 원본 카테고리 삭제
      await this.categoryRepository.deleteCategoryById(
        dto.sourceCategoryId,
        owner,
        tx
      );

      return {
        success: true,
        affectedMemosCount,
      };
    });
  }

  /**
   * 특정 카테고리의 768차원 임베딩 벡터 보유 여부를 반환합니다 (MemoService 배치 임베딩 판별용).
   *
   * @param categoryId 카테고리 UUID
   * @returns embedding이 이미 저장되어 있으면 true
   */
  async hasCategoryEmbedding(categoryId: string): Promise<boolean> {
    return this.categoryRepository.hasCategoryEmbedding(categoryId);
  }

  /**
   * 비동기 백그라운드에서 카테고리명 임베딩 벡터를 저장하고 pgvector 유사 카테고리 탐지를 실행합니다.
   * MemoService 배치 임베딩에서 이미 획득한 벡터가 있으면 재사용하여 중복 API 호출을 방지합니다.
   * 백그라운드 작업 실패 시에도 메인 요청 흐름에 영향을 주지 않고 안전하게 경고 로그만 남깁니다.
   *
   * @param categoryId 임베딩을 저장할 카테고리 UUID
   * @param categoryName 카테고리 표시명
   * @param precomputedEmbedding 배치 임베딩으로 선계산된 768차원 벡터 (선택)
   */
  async syncCategoryEmbeddingAndDetectSimilar(
    categoryId: string,
    categoryName: string,
    precomputedEmbedding?: number[] | null
  ): Promise<void> {
    try {
      const embedding =
        precomputedEmbedding ??
        (await this.aiService.generateEmbedding(categoryName));

      if (!embedding) {
        return;
      }

      await this.categoryRepository.updateCategoryEmbedding(
        categoryId,
        embedding
      );
      await this.categoryRepository.detectAndQueueSimilarCategories(categoryId);
    } catch (error: any) {
      this.logger.warn(
        `비동기 유사 카테고리 탐지 스킵 (categoryId: ${categoryId}): ${error?.message || error}`
      );
    }
  }

  /**
   * 대기 중인 유사 카테고리 병합 제안 큐를 조회합니다 (사이드바 뱃지 및 상단 1줄 배너용).
   *
   * @param owner 요청 주체(userId 또는 guestToken)
   * @returns 카테고리명이 포함된 병합 제안 목록
   */
  async getMergeSuggestions(
    owner: OwnerIdentity
  ): Promise<MergeSuggestionResponseDto[]> {
    this.assertOwner(owner);
    const rows = await this.categoryRepository.findMergeSuggestions(owner);
    return toMergeSuggestionResponseList(rows);
  }

  /**
   * 사용자가 [합치지 않기]를 선택한 병합 제안 레코드를 DB에서 즉시 완전 영구 삭제합니다.
   * 영구 삭제를 통해 동일 카테고리 쌍에 대한 재알림 피로도를 원천 차단합니다.
   *
   * @param owner 요청 주체(userId 또는 guestToken)
   * @param suggestionId 삭제할 제안 UUID v7
   * @throws BusinessException 대상 제안이 없거나 소유권이 불일치할 경우 404 Not Found 발생
   */
  async dismissMergeSuggestion(
    owner: OwnerIdentity,
    suggestionId: string
  ): Promise<void> {
    this.assertOwner(owner);

    const deleted = await this.categoryRepository.deleteMergeSuggestionById(
      suggestionId,
      owner
    );
    if (deleted.length === 0) {
      throw new BusinessException(
        "삭제할 병합 제안을 찾을 수 없습니다.",
        ERROR_CODES.CATEGORY_WARN_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }
}
