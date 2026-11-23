import { createHash, randomBytes } from "node:crypto";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import {
  ERROR_CODES,
  type CreateMcpKeyDto,
  type McpKeyCreatedResponseDto,
  type McpKeyScope,
  type McpKeyStatusResponseDto,
} from "@ideamory/api-spec";
import { LogTrace } from "../../common/decorators/log-trace.decorator";
import { BusinessException } from "../../common/exceptions/business.exception";
import {
  assertOwnerIdentity,
  type OwnerIdentity,
} from "../../common/types/owner.type";
import { McpKeyRepository } from "./mcp-key.repository";

const MCP_KEY_PREFIX = "idm_live_";

export interface VerifiedMcpContext {
  keyId: string;
  owner: OwnerIdentity;
  scopes: McpKeyScope[];
  fixedCategoryName: string | null;
}

/**
 * Ideamory MCP API 키 발급, 상태 조회, 폐기 및 Bearer 토큰 검증을 담당하는 서비스입니다.
 *
 * [보안 원칙]
 * - 원문 키(`idm_live_{32hex}`)는 생성 응답 시점에만 1회 반환하고 DB에는 SHA-256 해시만 저장합니다.
 * - 로그 트레이스 데코레이터에서 원문 키가 노출되지 않도록 `logResult: false`를 적용합니다.
 */
@Injectable()
export class McpKeyService {
  private readonly logger = new Logger(McpKeyService.name);

  constructor(private readonly mcpKeyRepository: McpKeyRepository) {}

  /**
   * 원문 API 키 문자열을 SHA-256 64자리 Hex 해시로 변환합니다.
   *
   * @param rawKey `idm_live_...` 원문 키
   * @returns SHA-256 Hex 문자열
   */
  public hashApiKey(rawKey: string): string {
    return createHash("sha256").update(rawKey, "utf8").digest("hex");
  }

  /**
   * 요청 주체의 현재 MCP 키 메타데이터(보유 여부, 접두어, 권한, 고정 카테고리)를 조회합니다.
   *
   * @param owner 요청 주체 식별자
   * @returns MCP 키 상태 응답 DTO
   */
  @LogTrace()
  async getKeyStatus(owner: OwnerIdentity): Promise<McpKeyStatusResponseDto> {
    assertOwnerIdentity(owner);

    const record = await this.mcpKeyRepository.findByOwner(owner);
    if (!record) {
      return {
        hasKey: false,
        keyPrefix: null,
        scopes: [],
        fixedCategoryName: null,
        createdAt: null,
        lastUsedAt: null,
      };
    }

    const validScopes = record.scopes.filter(
      (scope): scope is McpKeyScope => scope === "READ" || scope === "WRITE",
    );

    return {
      hasKey: true,
      keyPrefix: record.keyPrefix,
      scopes: validScopes,
      fixedCategoryName: record.fixedCategoryName,
      createdAt: record.createdAt.toISOString(),
      lastUsedAt: record.lastUsedAt ? record.lastUsedAt.toISOString() : null,
    };
  }

  /**
   * 신규 MCP API 키를 발급하거나 기존 활성 키를 원자적으로 재발급(교체)합니다.
   *
   * @param owner 요청 주체 식별자
   * @param dto 허용 권한(`scopes`) 및 선택적 고정 카테고리(`fixedCategoryName`)
   * @returns 원문 `apiKey`가 1회 포함된 생성 응답 DTO
   */
  @LogTrace({ logArgs: true, logResult: false })
  async issueKey(
    owner: OwnerIdentity,
    dto: CreateMcpKeyDto,
  ): Promise<McpKeyCreatedResponseDto> {
    assertOwnerIdentity(owner);

    const uniqueScopes = Array.from(new Set(dto.scopes));
    const rawKey = `${MCP_KEY_PREFIX}${randomBytes(16).toString("hex")}`;
    const keyHash = this.hashApiKey(rawKey);
    const keyPrefix = `${rawKey.slice(0, 13)}...`;
    const fixedCategoryName = dto.fixedCategoryName?.trim() || null;

    const saved = await this.mcpKeyRepository.upsertKeyForOwner({
      id: uuidv7(),
      owner,
      keyHash,
      keyPrefix,
      scopes: uniqueScopes,
      fixedCategoryName,
    });

    return {
      apiKey: rawKey,
      scopes: uniqueScopes,
      fixedCategoryName: saved.fixedCategoryName,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  /**
   * 요청 주체의 활성 MCP API 키를 즉시 폐기(삭제)합니다.
   *
   * @param owner 요청 주체 식별자
   */
  @LogTrace()
  async revokeKey(owner: OwnerIdentity): Promise<void> {
    assertOwnerIdentity(owner);
    await this.mcpKeyRepository.deleteByOwner(owner);
  }

  /**
   * 외부 MCP 클라이언트가 전달한 Bearer 토큰을 SHA-256 해시 대조로 검증합니다.
   *
   * @param rawToken Authorization 헤더의 원문 Bearer 토큰
   * @returns 검증된 소유자, 허용 스코프, 고정 카테고리 컨텍스트
   * @throws BusinessException 토큰 형식이 잘못되었거나 DB에 일치하는 키가 없는 경우 401 반환
   */
  @LogTrace({ logArgs: false, logResult: false })
  async verifyBearerToken(rawToken: string): Promise<VerifiedMcpContext> {
    if (!rawToken || !rawToken.startsWith(MCP_KEY_PREFIX)) {
      throw new BusinessException(
        "유효하지 않은 MCP API 키입니다.",
        ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const keyHash = this.hashApiKey(rawToken);
    const record = await this.mcpKeyRepository.findByKeyHash(keyHash);
    if (!record) {
      throw new BusinessException(
        "만료되었거나 존재하지 않는 MCP API 키입니다.",
        ERROR_CODES.AUTH_ALERT_UNAUTHORIZED,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const owner: OwnerIdentity = record.userId
      ? { userId: record.userId }
      : { guestToken: record.guestToken ?? undefined };

    const scopes = record.scopes.filter(
      (scope): scope is McpKeyScope => scope === "READ" || scope === "WRITE",
    );

    void this.mcpKeyRepository.touchLastUsedAt(record.id).catch((err) => {
      this.logger.warn(
        `MCP lastUsedAt 갱신 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    return {
      keyId: record.id,
      owner,
      scopes,
      fixedCategoryName: record.fixedCategoryName,
    };
  }
}
