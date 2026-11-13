import { Injectable } from "@nestjs/common";
import {
  db,
  eq,
  and,
  gt,
  lte,
  ogpCaches,
  type OgpCache,
  type DbExecutor,
} from "@ideamory/db";

/**
 * OGP 메타데이터 캐시 데이터 접근(Repository) 계층
 * 14일 TTL 기반 URL 캐시 조회, 멱등 업서트 및 만료 캐시 정리를 담당합니다.
 */
@Injectable()
export class OgpRepository {
  /**
   * 대상 URL에 대해 아직 만료되지 않은(expires_at > NOW()) 유효 OGP 캐시를 조회합니다.
   *
   * @param targetUrl 조회할 대상 URL
   * @param now 기준 시각 (기본값: 현재 시각)
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 유효한 OGP 캐시 레코드 또는 null
   */
  async findValidOgpCacheByUrl(
    targetUrl: string,
    now: Date = new Date(),
    tx: DbExecutor = db
  ): Promise<OgpCache | null> {
    const rows = await tx
      .select()
      .from(ogpCaches)
      .where(
        and(eq(ogpCaches.targetUrl, targetUrl), gt(ogpCaches.expiresAt, now))
      )
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * 크롤링한 OGP 메타데이터를 저장하거나, 만료된 동일 URL 캐시가 이미 존재할 경우 최신 정보로 갱신합니다.
   *
   * @param params 신규 UUID v7, targetUrl, title, thumbnailUrl, description, fetchedAt, expiresAt
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 저장/갱신된 OGP 캐시 레코드
   */
  async upsertOgpCache(
    params: {
      id: string;
      targetUrl: string;
      title: string | null;
      thumbnailUrl: string | null;
      description: string | null;
      fetchedAt: Date;
      expiresAt: Date;
    },
    tx: DbExecutor = db
  ): Promise<OgpCache> {
    const rows = await tx
      .insert(ogpCaches)
      .values({
        id: params.id,
        targetUrl: params.targetUrl,
        title: params.title,
        thumbnailUrl: params.thumbnailUrl,
        description: params.description,
        fetchedAt: params.fetchedAt,
        expiresAt: params.expiresAt,
      })
      .onConflictDoUpdate({
        target: ogpCaches.targetUrl,
        set: {
          title: params.title,
          thumbnailUrl: params.thumbnailUrl,
          description: params.description,
          fetchedAt: params.fetchedAt,
          expiresAt: params.expiresAt,
        },
      })
      .returning();

    return rows[0];
  }

  /**
   * 만료 시각(expires_at <= now)이 지난 OGP 캐시를 일괄 영구 삭제합니다.
   * (100년 TTL이 설정된 온보딩 가이드 캐시는 만료되지 않으므로 안전하게 보존됩니다.)
   *
   * @param now 만료 기준 시각 (기본값: 현재 시각)
   * @param tx 트랜잭션 컨텍스트 (기본값: db)
   * @returns 삭제된 캐시 레코드 ID 목록
   */
  async deleteExpiredOgpCaches(
    now: Date = new Date(),
    tx: DbExecutor = db
  ): Promise<Array<{ id: string }>> {
    return tx
      .delete(ogpCaches)
      .where(lte(ogpCaches.expiresAt, now))
      .returning({ id: ogpCaches.id });
  }
}

