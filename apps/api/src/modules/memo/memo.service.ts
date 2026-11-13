import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import {
  ERROR_CODES,
  type CreateMemoDto,
  type UpdateMemoDto,
  type GetMemosQueryDto,
  type MemoResponseDto,
} from "@ideamory/api-spec";
import { BusinessException } from "../../common/exceptions/business.exception";
import { AiService } from "../ai/ai.service";
import { OgpService } from "../ogp/ogp.service";
import {
  MemoRepository,
  type MemoOwnerIdentity,
  type MemoWithRelations,
} from "./memo.repository";

/** 휴지통 영구 보관 기한 (30일, 밀리초 단위) */
const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * 메모 코어 비즈니스 서비스
 *
 * [2단계 비동기 퀵 캡처 파이프라인 (Two-Phase Pipeline)]
 * 1. 동기 1단계: 문두 `@카테고리` 지시어만 즉시 파싱하고 미지정 시 `'미분류'` 카테고리로 DB에 선저장하여 0.1초 내 `201 Created`를 반환합니다.
 * 2. 비동기 2단계: 응답 반환 후 백그라운드에서 Gemini 가변 카테고리 분류, 768차원 임베딩 생성, 대표 URL 1개 OGP 크롤링을 비차단(Non-blocking) 실행합니다.
 */
@Injectable()
export class MemoService {
  private readonly logger = new Logger(MemoService.name);

  constructor(
    private readonly memoRepository: MemoRepository,
    private readonly aiService: AiService,
    private readonly ogpService: OgpService
  ) {}

  /**
   * 요청 주체(소셜 정회원 또는 게스트)의 식별자가 유효한지 검증합니다.
   *
   * @throws BusinessException userId와 guestToken이 모두 누락된 경우 401 Unauthorized 발생
   */
  private assertOwner(owner: MemoOwnerIdentity): void {
    if (!owner.userId && !owner.guestToken) {
      throw new BusinessException(
        "인증 토큰 또는 게스트 토큰이 필요합니다.",
        ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  /**
   * 조인된 메모 엔티티를 API 응답 규격(MemoResponseDto)으로 직렬화합니다.
   */
  private toMemoResponseDto(record: MemoWithRelations): MemoResponseDto {
    return {
      id: record.id,
      content: record.content,
      categoryId: record.categoryId,
      categoryName: record.categoryName,
      ogpId: record.ogpId,
      ogp: record.ogp ? this.ogpService.toOgpResponseDto(record.ogp) : null,
      deletedAt: record.deletedAt ? record.deletedAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  /**
   * 0.1초 퀵 캡처 요청을 처리합니다.
   * 1단계 동기 선저장 후 즉시 201 응답을 반환하고, 2단계 AI 분류·임베딩·OGP 크롤링을 백그라운드에서 실행합니다.
   *
   * @param owner 요청 주체(userId 또는 guestToken)
   * @param dto 클라이언트 선발급 UUID v7 및 본문(1~5000자)
   * @returns 즉시 생성된 메모 응답 DTO
   */
  async createMemo(
    owner: MemoOwnerIdentity,
    dto: CreateMemoDto
  ): Promise<MemoResponseDto> {
    this.assertOwner(owner);

    // 1. 문두 @카테고리 지시어 우선 파싱 (정규식 ^@(\S+))
    const directive = this.aiService.parseLeadingCategoryDirective(dto.content);
    const hasExplicitDirective =
      directive.categoryName !== null && directive.normalizedName !== null;

    const initialCategoryName = hasExplicitDirective
      ? directive.categoryName!
      : "미분류";
    const initialNormalizedName = hasExplicitDirective
      ? directive.normalizedName!
      : "미분류";

    // 2. 단일 트랜잭션 내에서 초기 카테고리 확정 및 메모 즉시 INSERT
    const created = await this.memoRepository.withTransaction(async (tx) => {
      const category = await this.memoRepository.findOrCreateCategory(
        owner,
        initialCategoryName,
        initialNormalizedName,
        tx
      );

      const timestamps = await this.memoRepository.insertMemo(
        {
          id: dto.id,
          owner,
          categoryId: category.id,
          content: directive.cleanedContent,
        },
        tx
      );

      return { category, timestamps };
    });

    // 3. 비동기 2단계 파이프라인 트리거 (응답 지연을 막기 위해 await 하지 않고 백그라운드 실행)
    void this.runBackgroundEnrichment(
      dto.id,
      owner,
      directive.cleanedContent,
      hasExplicitDirective
    );

    return {
      id: dto.id,
      content: directive.cleanedContent,
      categoryId: created.category.id,
      categoryName: created.category.name,
      ogpId: null,
      ogp: null,
      deletedAt: null,
      createdAt: created.timestamps.createdAt.toISOString(),
      updatedAt: created.timestamps.updatedAt.toISOString(),
    };
  }

  /**
   * 2단계 비동기 백그라운드 파이프라인:
   * LLM 가변 카테고리 분류(지시어 미존재 시), Gemini 768차원 임베딩 생성, 대표 URL 1개 OGP 크롤링을 병렬 수행합니다.
   * 백그라운드 작업 중 오류가 발생해도 UnhandledRejection 없이 안전하게 로깅만 남깁니다.
   */
  protected async runBackgroundEnrichment(
    memoId: string,
    owner: MemoOwnerIdentity,
    content: string,
    hasExplicitDirective: boolean
  ): Promise<void> {
    try {
      // 1) AI 카테고리 분류 작업 (문두 @지시어가 없었을 때만 수행)
      const classifyTask = (async (): Promise<string | undefined> => {
        if (hasExplicitDirective) {
          return undefined;
        }
        const existingCategories =
          await this.memoRepository.findCategoriesByOwner(owner);
        const candidateNames = existingCategories
          .map((cat) => cat.name)
          .filter((name) => name !== "미분류");

        const suggested = await this.aiService.classifyMemoCategory(
          content,
          candidateNames
        );
        if (!suggested) {
          return undefined;
        }

        const resolvedCategory = await this.memoRepository.findOrCreateCategory(
          owner,
          suggested.name,
          suggested.normalizedName
        );
        return resolvedCategory.id;
      })();

      // 2) 768차원 시맨틱 임베딩 생성 작업
      const embeddingTask = this.aiService.generateEmbedding(content);

      // 3) 본문 내 첫 번째 대표 URL 1개만 추출하여 OGP 크롤링 및 캐싱
      const ogpTask = (async (): Promise<string | undefined> => {
        const firstUrl = this.ogpService.extractFirstUrl(content);
        if (!firstUrl) {
          return undefined;
        }
        try {
          const ogp = await this.ogpService.parseAndCacheOgp(firstUrl);
          return ogp.id;
        } catch (ogpError: any) {
          this.logger.warn(
            `백그라운드 OGP 파싱 스킵 (memoId: ${memoId}, url: ${firstUrl}): ${ogpError?.message || ogpError}`
          );
          return undefined;
        }
      })();

      const [resolvedCategoryId, embedding, ogpId] = await Promise.all([
        classifyTask,
        embeddingTask,
        ogpTask,
      ]);

      await this.memoRepository.updateMemoBackgroundEnrichment(memoId, {
        ...(resolvedCategoryId ? { categoryId: resolvedCategoryId } : {}),
        ...(embedding ? { embedding } : {}),
        ...(ogpId ? { ogpId } : {}),
      });
    } catch (error: any) {
      this.logger.error(
        `비동기 메모 백그라운드 파이프라인 실패 (memoId: ${memoId}): ${error?.message || error}`
      );
    }
  }

  /**
   * 소유자의 메인 타임라인 또는 30일 휴지통 메모 목록을 최신순으로 조회합니다.
   *
   * @param owner 요청 주체(userId 또는 guestToken)
   * @param query 카테고리 필터 및 휴지통 조회 플래그
   * @returns OGP 메타데이터가 조인된 메모 목록
   */
  async getMemos(
    owner: MemoOwnerIdentity,
    query: GetMemosQueryDto
  ): Promise<MemoResponseDto[]> {
    this.assertOwner(owner);

    const rows = await this.memoRepository.findMemosWithOgp(owner, {
      categoryId: query.categoryId,
      deleted: query.deleted ?? false,
    });

    return rows.map((row) => this.toMemoResponseDto(row));
  }

  /**
   * 메모 본문 인라인 수정 또는 카테고리 수동 변경을 처리합니다.
   *
   * @param owner 요청 주체(userId 또는 guestToken)
   * @param memoId 수정할 메모 UUID
   * @param dto 수정할 content 및/또는 categoryId
   * @returns 수정 완료된 최신 메모 DTO
   * @throws BusinessException 대상 메모 또는 카테고리가 없으면 404 Not Found 발생
   */
  async updateMemo(
    owner: MemoOwnerIdentity,
    memoId: string,
    dto: UpdateMemoDto
  ): Promise<MemoResponseDto> {
    this.assertOwner(owner);

    const existing = await this.memoRepository.findMemoByIdAndOwner(
      memoId,
      owner
    );
    if (!existing) {
      throw new BusinessException(
        "수정할 메모를 찾을 수 없습니다.",
        ERROR_CODES.MEMO_WARN_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    if (dto.categoryId) {
      const targetCategory = await this.memoRepository.findCategoryByIdAndOwner(
        dto.categoryId,
        owner
      );
      if (!targetCategory) {
        throw new BusinessException(
          "선택한 카테고리를 찾을 수 없습니다.",
          ERROR_CODES.CATEGORY_WARN_NOT_FOUND,
          HttpStatus.NOT_FOUND
        );
      }
    }

    await this.memoRepository.updateMemoById(memoId, owner, {
      content: dto.content,
      categoryId: dto.categoryId,
    });

    const updated = await this.memoRepository.findMemoByIdAndOwner(
      memoId,
      owner
    );
    return this.toMemoResponseDto(updated!);
  }

  /**
   * 실수 방지를 위해 메모를 즉시 영구 삭제하지 않고 30일 휴지통으로 이동(Soft Delete)합니다.
   *
   * @param owner 요청 주체(userId 또는 guestToken)
   * @param memoId 삭제할 메모 UUID
   * @throws BusinessException 대상 메모가 존재하지 않으면 404 Not Found 발생
   */
  async softDeleteMemo(
    owner: MemoOwnerIdentity,
    memoId: string
  ): Promise<void> {
    this.assertOwner(owner);

    const updated = await this.memoRepository.updateMemoDeletedAt(
      memoId,
      owner,
      new Date()
    );
    if (updated.length === 0) {
      throw new BusinessException(
        "삭제할 메모를 찾을 수 없습니다.",
        ERROR_CODES.MEMO_WARN_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }
  }

  /**
   * 휴지통에 보관된 메모를 활성 타임라인으로 원클릭 복구(deleted_at = NULL)합니다.
   *
   * @param owner 요청 주체(userId 또는 guestToken)
   * @param memoId 복구할 메모 UUID
   * @returns 복구된 메모 응답 DTO
   * @throws BusinessException 대상 메모가 존재하지 않으면 404 Not Found 발생
   */
  async restoreMemo(
    owner: MemoOwnerIdentity,
    memoId: string
  ): Promise<MemoResponseDto> {
    this.assertOwner(owner);

    const restored = await this.memoRepository.updateMemoDeletedAt(
      memoId,
      owner,
      null
    );
    if (restored.length === 0) {
      throw new BusinessException(
        "복구할 메모를 찾을 수 없습니다.",
        ERROR_CODES.MEMO_WARN_NOT_FOUND,
        HttpStatus.NOT_FOUND
      );
    }

    const record = await this.memoRepository.findMemoByIdAndOwner(
      memoId,
      owner
    );
    return this.toMemoResponseDto(record!);
  }

  /**
   * 매일 자정 크론에서 호출되어 30일 경과 휴지통 메모를 영구 삭제하고,
   * 참조 카운트가 0건이 된 고아 카테고리를 일괄 정리(Garbage Collection)합니다.
   *
   * @returns 영구 삭제된 메모 수 및 정리된 고아 카테고리 수
   */
  async cleanupExpiredTrashAndOrphans(): Promise<{
    deletedMemoCount: number;
    deletedCategoryCount: number;
  }> {
    const cutoffDate = new Date(Date.now() - TRASH_RETENTION_MS);

    return this.memoRepository.withTransaction(async (tx) => {
      // FK ON DELETE RESTRICT 위반 방지를 위해 30일 경과 메모를 먼저 삭제한 뒤 고아 카테고리 정리
      const deletedMemos = await this.memoRepository.deleteExpiredTrashMemos(
        cutoffDate,
        tx
      );
      const deletedCategories =
        await this.memoRepository.deleteOrphanCategories(tx);

      return {
        deletedMemoCount: deletedMemos.length,
        deletedCategoryCount: deletedCategories.length,
      };
    });
  }
}

