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
    (ogpService as any).lookupHostIps = async () => ["93.184.216.34"];
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

  it("시나리오 6: validateSafeExternalUrlWithDns는 사설/루프백/IPv4-mapped IPv6로 해석되는 DNS 우회 도메인을 차단해야 한다", async () => {
    (ogpService as any).lookupHostIps = async (hostname: string) => {
      if (hostname === "rebind.example.com") {
        return ["127.0.0.1"];
      }
      if (hostname === "v6mapped.example.com") {
        return ["::ffff:169.254.169.254"];
      }
      return ["93.184.216.34"];
    };

    for (const url of [
      "https://rebind.example.com/secret",
      "https://v6mapped.example.com/latest/meta-data",
    ]) {
      await assert.rejects(
        () => ogpService.validateSafeExternalUrlWithDns(url),
        (err: any) => {
          assert.ok(err instanceof BusinessException);
          assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
          return true;
        }
      );
    }
  });

  it("시나리오 7: fetchSafeHtml은 HTTP 302 리다이렉트가 내부망으로 향하면 차단하고, 안전한 외부 리다이렉트만 허용해야 한다", async () => {
    (ogpService as any).performHttpGet = async (url: string) => {
      if (url === "https://public.example.com/redirect-internal") {
        return new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data" },
        });
      }
      if (url === "https://public.example.com/redirect-safe") {
        return new Response(null, {
          status: 301,
          headers: { location: "https://www.example.com/article" },
        });
      }
      if (url === "https://www.example.com/article") {
        return new Response("<html><head><title>Safe</title></head></html>", {
          status: 200,
        });
      }
      return new Response(null, { status: 404 });
    };

    await assert.rejects(
      () =>
        (ogpService as any).fetchSafeHtml(
          "https://public.example.com/redirect-internal"
        ),
      (err: any) => {
        assert.ok(err instanceof BusinessException);
        assert.equal(err.getStatus(), HttpStatus.BAD_REQUEST);
        return true;
      }
    );

    const { html, finalUrl } = await (ogpService as any).fetchSafeHtml(
      "https://public.example.com/redirect-safe"
    );
    assert.ok(html.includes("<title>Safe</title>"));
    assert.equal(finalUrl, "https://www.example.com/article");
  });

  it("시나리오 8: scrapeUrlMetadata는 리다이렉트된 최종 URL 기준으로 상대 경로 og:image를 절대 경로로 변환해야 한다", async () => {
    (ogpService as any).performHttpGet = async (url: string) => {
      if (url === "https://short.example.com/p/1") {
        return new Response(null, {
          status: 301,
          headers: { location: "https://blog.example.com/posts/hello" },
        });
      }
      if (url === "https://blog.example.com/posts/hello") {
        return new Response(
          `<html><head>
            <meta property="og:title" content="Relative OG Test" />
            <meta property="og:image" content="/assets/og-thumb.png" />
          </head></html>`,
          { status: 200 }
        );
      }
      return new Response(null, { status: 404 });
    };

    const meta = await (ogpService as any).scrapeUrlMetadata(
      "https://short.example.com/p/1"
    );
    assert.equal(meta.title, "Relative OG Test");
    assert.equal(
      meta.thumbnailUrl,
      "https://blog.example.com/assets/og-thumb.png"
    );
  });

  it("시나리오 9: fetchSafeHtml은 Content-Length 또는 스트림 본문이 2MB 상한을 초과하면 즉시 차단해야 한다", async () => {
    (ogpService as any).performHttpGet = async (url: string) => {
      if (url === "https://cdn.example.com/huge-header") {
        return new Response("ok", {
          status: 200,
          headers: { "content-length": String(3 * 1024 * 1024) },
        });
      }
      if (url === "https://cdn.example.com/huge-stream") {
        const oversizedChunk = new Uint8Array(2 * 1024 * 1024 + 1024);
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(oversizedChunk);
            controller.close();
          },
        });
        return new Response(stream, { status: 200 });
      }
      return new Response(null, { status: 404 });
    };

    for (const url of [
      "https://cdn.example.com/huge-header",
      "https://cdn.example.com/huge-stream",
    ]) {
      await assert.rejects(
        () => (ogpService as any).fetchSafeHtml(url),
        (err: any) => {
          assert.ok(err instanceof BusinessException);
          assert.equal(err.getStatus(), HttpStatus.BAD_GATEWAY);
          return true;
        }
      );
    }
  });
});

