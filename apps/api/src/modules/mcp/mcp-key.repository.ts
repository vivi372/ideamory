import { Injectable } from "@nestjs/common";
import { db, eq, mcpApiKeys, type McpApiKey } from "@ideamory/db";
import type { McpKeyScope } from "@ideamory/api-spec";
import type { OwnerIdentity } from "../../common/types/owner.type";

/**
 * `mcp_api_keys` 테이블 전용 Drizzle ORM 데이터 접근 리포지토리입니다.
 * 소유자(소셜 유저 또는 게스트)별 단일 활성 키 조회, 원자적 발급/갱신, 해시 조회 및 폐기를 담당합니다.
 */
@Injectable()
export class McpKeyRepository {
  /**
   * 요청 주체(소셜 `userId` 또는 `guestToken`)의 현재 활성 MCP 키 레코드를 조회합니다.
   *
   * @param owner 요청 주체 식별자
   * @returns 활성 MCP 키 레코드 또는 null
   */
  async findByOwner(owner: OwnerIdentity): Promise<McpApiKey | null> {
    const condition = owner.userId
      ? eq(mcpApiKeys.userId, owner.userId)
      : eq(mcpApiKeys.guestToken, owner.guestToken!);

    const rows = await db.select().from(mcpApiKeys).where(condition).limit(1);
    return rows[0] ?? null;
  }

  /**
   * SHA-256 해시값으로 MCP API 키 레코드를 조회합니다.
   *
   * @param keyHash 원문 키의 SHA-256 64자리 Hex 해시
   * @returns 일치하는 MCP 키 레코드 또는 null
   */
  async findByKeyHash(keyHash: string): Promise<McpApiKey | null> {
    const rows = await db
      .select()
      .from(mcpApiKeys)
      .where(eq(mcpApiKeys.keyHash, keyHash))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * 소유자당 최대 1개의 활성 키 원칙에 따라 트랜잭션 내에서 기존 키를 갱신하거나 신규 키를 삽입합니다.
   *
   * @param params 선발급 UUID v7, 소유자, SHA-256 해시, 접두어, 권한 배열, 고정 카테고리명
   * @returns 저장된 MCP 키 레코드
   */
  async upsertKeyForOwner(params: {
    id: string;
    owner: OwnerIdentity;
    keyHash: string;
    keyPrefix: string;
    scopes: McpKeyScope[];
    fixedCategoryName: string | null;
  }): Promise<McpApiKey> {
    return db.transaction(async (tx) => {
      const condition = params.owner.userId
        ? eq(mcpApiKeys.userId, params.owner.userId)
        : eq(mcpApiKeys.guestToken, params.owner.guestToken!);

      const existing = await tx
        .select()
        .from(mcpApiKeys)
        .where(condition)
        .limit(1);

      const now = new Date();
      if (existing[0]) {
        const [updated] = await tx
          .update(mcpApiKeys)
          .set({
            keyHash: params.keyHash,
            keyPrefix: params.keyPrefix,
            scopes: params.scopes,
            fixedCategoryName: params.fixedCategoryName,
            lastUsedAt: null,
            createdAt: now,
            updatedAt: now,
          })
          .where(eq(mcpApiKeys.id, existing[0].id))
          .returning();
        return updated!;
      }

      const [inserted] = await tx
        .insert(mcpApiKeys)
        .values({
          id: params.id,
          userId: params.owner.userId ?? null,
          guestToken: params.owner.userId ? null : params.owner.guestToken!,
          keyHash: params.keyHash,
          keyPrefix: params.keyPrefix,
          scopes: params.scopes,
          fixedCategoryName: params.fixedCategoryName,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return inserted!;
    });
  }

  /**
   * 소유자의 활성 MCP API 키를 즉시 삭제(폐기)합니다.
   *
   * @param owner 요청 주체 식별자
   * @returns 삭제된 행 수
   */
  async deleteByOwner(owner: OwnerIdentity): Promise<number> {
    const condition = owner.userId
      ? eq(mcpApiKeys.userId, owner.userId)
      : eq(mcpApiKeys.guestToken, owner.guestToken!);

    const deleted = await db
      .delete(mcpApiKeys)
      .where(condition)
      .returning({ id: mcpApiKeys.id });
    return deleted.length;
  }

  /**
   * MCP 도구 호출 시 해당 키의 마지막 사용 시각(`last_used_at`)을 갱신합니다.
   *
   * @param id MCP 키 레코드 UUID
   */
  async touchLastUsedAt(id: string): Promise<void> {
    await db
      .update(mcpApiKeys)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(mcpApiKeys.id, id));
  }
}
