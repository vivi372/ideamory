import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { HttpStatus } from "@nestjs/common";
import { ERROR_CODES } from "@ideamory/api-spec";
import { BusinessException } from "../../common/exceptions/business.exception";
import { OgpService } from "./ogp.service";
import { OgpRepository } from "./ogp.repository";
import { OgpScheduler } from "./ogp.scheduler";

describe("OgpService & OgpScheduler (1개 URL 추출, SSRF 방어, 14일 TTL 캐싱 및 만료 정리)", () => {
  let ogpService: OgpService;
  let mockCachedRecord: any;
  let upsertedPayloads: any[];
  let scrapeCalledCount: number;
  let deletedExpiredCount: number;

  beforeEach(() => {
    mockCachedRecord = null;
    upsertedPayloads = [];
    scrapeCalledCount = 0;
    deletedExpiredCount = 0;

    const mockRepo: Partial<OgpRepository> = {
      findValidOgpCacheByUrl: async () => mockCachedRecord,
      upsertOgpCache: async (params) => {
        upsertedPayloads.push(params);
        return {
          ...params,
          fetchedAt: params.fetchedAt,
        };
      },
      deleteExpiredOgpCaches: async () => {
        deletedExpiredCount = 3;
        return [{ id: "1" }, { id: "2" }, { id: "3" }];
      },
    };

    ogpService = new OgpService(mockRepo as OgpRepository);
  });

  it("시나리오 1: extractFirstUrl은 본문에 복수의 URL이 있어도 반드시 첫 번째 URL 1개만 추출해야 한다", () => {
    const first = ogpService.extractFirstUrl(
      "참고 자료 https://nextjs.org/docs, 그리고 https://nestjs.com 도 보세요."
    );

    assert.equal(first, "https://nextjs.org/docs");
  });

  it("시나리오 2: validateSafeExternalUrl은 localhost, 사설 IP, 클라우드 메타데이터 IP 등 SSRF 위험 대상을 차단해야 한다", () => {
    const blockedUrls = [
      "http://localhost:3000/admin",
      "http://127.0.0.1:8080/secret",
      "http://10.0.0.1/internal",
      "http://192.168.0.10/router",
      "http://169.254.169.254/latest/meta-data",
      "ftp://example.com/file",
    ];

    for (const url of blockedUrls) {
      assert.throws(
        () => ogpService.validateSafeExternalUrl(url),
        (err: any) => {
          assert.ok(err instanceof BusinessException);
          assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
          return true;
        }
      );
    }
  });

  it("시나리오 3: parseAndCacheOgp는 유효한 OGP 캐시가 존재하면 외부 크롤링 없이 캐시 결과를 즉시 반환해야 한다", async () => {
    const now = new Date();
    mockCachedRecord = {
      id: "018d0000-0000-7000-8000-000000000099",
      targetUrl: "https://nextjs.org/",
      title: "Next.js",
      thumbnailUrl: "https://nextjs.org/og.png",
      description: "React Framework",
      fetchedAt: now,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    };

    (ogpService as any).scrapeUrlMetadata = async () => {
      scrapeCalledCount++;
      return { title: "Should not run", thumbnailUrl: null, description: null };
    };

    const result = await ogpService.parseAndCacheOgp("https://nextjs.org");
    assert.equal(scrapeCalledCount, 0);
    assert.equal(result.id, mockCachedRecord.id);
    assert.equal(result.title, "Next.js");
  });

  it("시나리오 4: parseAndCacheOgp는 캐시가 없거나 만료되면 크롤링 후 14일 TTL로 저장해야 한다", async () => {
    (ogpService as any).scrapeUrlMetadata = async () => {
      scrapeCalledCount++;
      return {
        title: "NestJS",
        thumbnailUrl: "https://nestjs.com/og.png",
        description: "Progressive Node.js framework",
      };
    };

    const result = await ogpService.parseAndCacheOgp("https://nestjs.com");

    assert.equal(scrapeCalledCount, 1);
    assert.equal(upsertedPayloads.length, 1);
    const saved = upsertedPayloads[0];
    const diffDays =
      (saved.expiresAt.getTime() - saved.fetchedAt.getTime()) /
      (24 * 60 * 60 * 1000);
    assert.equal(Math.round(diffDays), 14);
    assert.equal(result.title, "NestJS");
  });

  it("시나리오 5: OgpScheduler는 만료 OGP 캐시 일괄 정리를 정상 실행해야 한다", async () => {
    const scheduler = new OgpScheduler(ogpService);
    await scheduler.handleExpiredOgpCleanup();

    assert.equal(deletedExpiredCount, 3);
    assert.equal(ERROR_CODES.OGP_ERROR_PARSE_FAILED, "OGP_ERROR_PARSE_FAILED");
  });
});

