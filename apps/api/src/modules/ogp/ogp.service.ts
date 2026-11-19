import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { v7 as uuidv7 } from "uuid";
import ogs from "open-graph-scraper";
import { ERROR_CODES, type OgpResponseDto } from "@ideamory/api-spec";
import { type OgpCache } from "@ideamory/db";
import { BusinessException } from "../../common/exceptions/business.exception";
import { LogTrace } from "../../common/decorators/log-trace.decorator";
import {
  extractFirstUrlFromText,
  isPrivateOrReservedIpAddress,
  MAX_OGP_HTML_BYTES,
  MAX_OGP_REDIRECTS,
  OGP_SCRAPE_TIMEOUT_SECONDS,
  OGP_TTL_MS,
  resolveOgpThumbnailUrl,
  serializeOgpCacheToDto,
  validateSafeExternalUrlFormat,
} from "./ogp.helper";
import { OgpRepository } from "./ogp.repository";

/**
 * URL 메타데이터(Open Graph) 크롤링 및 14일 TTL 캐싱 서비스
 *
 * [보안 및 성능 가드레일]
 * 1. SSRF 방어: http/https 이외의 스킴 및 사설망·루프백·클라우드 메타데이터 IP(169.254.x.x 등) 접근을 원천 차단합니다.
 * 2. 1개 URL 원칙: 메모 본문에 여러 URL이 포함되어도 첫 번째 URL 1개만 추출하여 크롤링합니다.
 * 3. 14일 캐시 재사용: 유효 기간이 남은 캐시가 있으면 외부 HTTP 요청 없이 즉시 DB 캐시를 반환합니다.
 */
@Injectable()
export class OgpService {
  private readonly logger = new Logger(OgpService.name);

  constructor(private readonly ogpRepository: OgpRepository) {}

  /**
   * 본문 텍스트에서 첫 번째 http(s) URL 1개만 추출합니다.
   *
   * @param text 메모 본문 텍스트
   * @returns 추출된 첫 번째 URL 문자열 또는 미포함 시 null
   */
  public extractFirstUrl(text: string): string | null {
    return extractFirstUrlFromText(text);
  }

  /**
   * SSRF(Server-Side Request Forgery) 공격 방어를 위해 외부 URL의 프로토콜과 호스트를 검증합니다.
   *
   * @param rawUrl 검증할 원본 URL 문자열
   * @returns 파싱 및 검증이 완료된 URL 객체
   * @throws BusinessException 허용되지 않는 프로토콜 또는 내부망 주소인 경우 400 발생
   */
  public validateSafeExternalUrl(rawUrl: string): URL {
    return validateSafeExternalUrlFormat(rawUrl);
  }

  /**
   * IPv4/IPv6 주소가 사설망, 루프백, 링크로컬(클라우드 메타데이터), 예약 대역인지 판별합니다.
   * IPv4-mapped IPv6(::ffff:127.0.0.1 등) 우회 주소도 함께 차단합니다.
   *
   * @param rawIp 검사할 IP 주소 문자열
   * @returns 내부망 또는 예약 대역 여부
   */
  public isPrivateOrReservedIp(rawIp: string): boolean {
    return isPrivateOrReservedIpAddress(rawIp);
  }

  /**
   * 호스트명의 실제 DNS A/AAAA 레코드를 조회합니다 (테스트 대역 주입 가능).
   *
   * @param hostname DNS 조회 대상 호스트명
   * @returns 해석된 IP 주소 배열
   */
  protected async lookupHostIps(hostname: string): Promise<string[]> {
    const records = await lookup(hostname, { all: true });
    return records.map((record) => record.address);
  }

  /**
   * URL 형식/프로토콜 검증과 함께 실제 DNS 해석 IP가 내부망이 아닌지 비동기로 검증합니다.
   *
   * @param rawUrl 검증할 외부 URL 문자열
   * @returns 검증 완료된 URL 객체
   * @throws BusinessException DNS 해석 실패 또는 내부망 IP로 해석될 경우 400 Bad Request 발생
   */
  public async validateSafeExternalUrlWithDns(rawUrl: string): Promise<URL> {
    const parsed = this.validateSafeExternalUrl(rawUrl);
    const rawHostname = parsed.hostname.toLowerCase();
    const hostname =
      rawHostname.startsWith("[") && rawHostname.endsWith("]")
        ? rawHostname.slice(1, -1)
        : rawHostname;

    if (isIP(hostname) === 0) {
      let resolvedIps: string[];
      try {
        resolvedIps = await this.lookupHostIps(hostname);
      } catch {
        throw new BusinessException(
          "대상 호스트의 DNS 정보를 확인할 수 없습니다.",
          ERROR_CODES.OGP_ERROR_PARSE_FAILED,
          HttpStatus.BAD_REQUEST
        );
      }

      if (
        resolvedIps.length === 0 ||
        resolvedIps.some((ip) => this.isPrivateOrReservedIp(ip))
      ) {
        throw new BusinessException(
          "내부 네트워크 또는 허용되지 않은 호스트로의 접근은 차단됩니다.",
          ERROR_CODES.OGP_ERROR_PARSE_FAILED,
          HttpStatus.BAD_REQUEST
        );
      }
    }

    return parsed;
  }

  /**
   * HTTP 요청을 수행합니다 (단위 테스트에서 리다이렉트 응답 모킹 가능).
   *
   * @param url 요청 대상 URL
   * @param signal 타임아웃 AbortSignal
   * @returns Fetch Response 객체
   */
  protected async performHttpGet(
    url: string,
    signal: AbortSignal
  ): Promise<Response> {
    return fetch(url, {
      method: "GET",
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": "IdeamoryOgpBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });
  }

  /**
   * 응답 본문을 최대 허용 바이트 상한(maxBytes) 내에서 스트림으로 안전하게 읽습니다.
   *
   * @param response HTTP 응답 객체
   * @param maxBytes 허용 최대 바이트 수 (기본값: 2MB)
   * @returns UTF-8 디코딩된 HTML 문자열
   * @throws BusinessException 본문 크기가 상한을 초과한 경우 502 Bad Gateway 발생
   */
  protected async readResponseTextWithLimit(
    response: Response,
    maxBytes: number = MAX_OGP_HTML_BYTES
  ): Promise<string> {
    const contentLengthHeader = response.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        await response.body?.cancel().catch(() => undefined);
        throw new BusinessException(
          "응답 본문 크기가 허용 범위를 초과했습니다.",
          ERROR_CODES.OGP_ERROR_PARSE_FAILED,
          HttpStatus.BAD_GATEWAY
        );
      }
    }

    if (!response.body) {
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > maxBytes) {
        throw new BusinessException(
          "응답 본문 크기가 허용 범위를 초과했습니다.",
          ERROR_CODES.OGP_ERROR_PARSE_FAILED,
          HttpStatus.BAD_GATEWAY
        );
      }
      return text;
    }

    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            await reader.cancel().catch(() => undefined);
            throw new BusinessException(
              "응답 본문 크기가 허용 범위를 초과했습니다.",
              ERROR_CODES.OGP_ERROR_PARSE_FAILED,
              HttpStatus.BAD_GATEWAY
            );
          }
          chunks.push(Buffer.from(value));
        }
      }
    } finally {
      reader.releaseLock();
    }

    return Buffer.concat(chunks).toString("utf-8");
  }

  /**
   * 상대 경로 또는 프로토콜 생략(`//`) 썸네일 URL을 최종 페이지 URL 기준 절대 http(s) URL로 변환합니다.
   *
   * @param rawThumbnail 추출된 원본 썸네일 URL
   * @param baseUrl 최종 페이지 URL
   * @returns 절대 http(s) URL 또는 null
   */
  public resolveThumbnailUrl(
    rawThumbnail: string | null,
    baseUrl: string
  ): string | null {
    return resolveOgpThumbnailUrl(rawThumbnail, baseUrl);
  }

  /**
   * 리다이렉트(3xx) 매 홉마다 SSRF 검증을 수행하며 안전하게 HTML 본문과 최종 URL을 가져옵니다.
   *
   * @param targetUrl 최초 요청 URL
   * @returns HTML 문자열과 리다이렉트가 반영된 최종 URL
   */
  protected async fetchSafeHtml(
    targetUrl: string
  ): Promise<{ html: string; finalUrl: string }> {
    let currentUrl = (
      await this.validateSafeExternalUrlWithDns(targetUrl)
    ).toString();
    const signal = AbortSignal.timeout(OGP_SCRAPE_TIMEOUT_SECONDS * 1000);

    for (let hop = 0; hop <= MAX_OGP_REDIRECTS; hop++) {
      const response = await this.performHttpGet(currentUrl, signal);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new BusinessException(
            "유효하지 않은 리다이렉트 응답입니다.",
            ERROR_CODES.OGP_ERROR_PARSE_FAILED,
            HttpStatus.BAD_GATEWAY
          );
        }
        if (hop >= MAX_OGP_REDIRECTS) {
          throw new BusinessException(
            "허용된 리다이렉트 횟수를 초과했습니다.",
            ERROR_CODES.OGP_ERROR_PARSE_FAILED,
            HttpStatus.BAD_GATEWAY
          );
        }

        const resolvedRedirectUrl = new URL(location, currentUrl).toString();
        currentUrl = (
          await this.validateSafeExternalUrlWithDns(resolvedRedirectUrl)
        ).toString();
        continue;
      }

      if (!response.ok) {
        throw new BusinessException(
          "URL 메타데이터를 추출할 수 없습니다.",
          ERROR_CODES.OGP_ERROR_PARSE_FAILED,
          HttpStatus.BAD_GATEWAY
        );
      }

      const html = await this.readResponseTextWithLimit(
        response,
        MAX_OGP_HTML_BYTES
      );
      return { html, finalUrl: currentUrl };
    }

    throw new BusinessException(
      "허용된 리다이렉트 횟수를 초과했습니다.",
      ERROR_CODES.OGP_ERROR_PARSE_FAILED,
      HttpStatus.BAD_GATEWAY
    );
  }

  /**
   * open-graph-scraper를 이용해 외부 웹 페이지의 OGP 메타데이터를 크롤링합니다.
   *
   * @param targetUrl 검증된 외부 URL
   * @returns 추출된 제목, 썸네일 URL, 설명
   * @throws BusinessException 크롤링 타임아웃 또는 파싱 실패 시 예외 발생
   */
  protected async scrapeUrlMetadata(targetUrl: string): Promise<{
    title: string | null;
    thumbnailUrl: string | null;
    description: string | null;
  }> {
    try {
      const { html, finalUrl } = await this.fetchSafeHtml(targetUrl);
      const { error, result } = await ogs({ html });

      if (error || !result.success) {
        throw new BusinessException(
          "URL 메타데이터를 추출할 수 없습니다.",
          ERROR_CODES.OGP_ERROR_PARSE_FAILED,
          HttpStatus.BAD_GATEWAY
        );
      }

      const rawThumbnail = result.ogImage?.[0]?.url ?? null;

      return {
        title: result.ogTitle?.trim() || result.twitterTitle?.trim() || null,
        thumbnailUrl: this.resolveThumbnailUrl(rawThumbnail, finalUrl),
        description:
          result.ogDescription?.trim() ||
          result.twitterDescription?.trim() ||
          null,
      };
    } catch (err: any) {
      if (err instanceof BusinessException) {
        throw err;
      }
      const isTimeout =
        err?.name === "AbortError" ||
        err?.name === "TimeoutError" ||
        String(err?.message || "").toLowerCase().includes("timeout");
      this.logger.warn(`OGP 크롤링 실패 (${targetUrl}): ${err?.message || err}`);
      throw new BusinessException(
        isTimeout
          ? "대상 사이트 응답 시간이 초과되었습니다."
          : "URL 메타데이터 파싱 중 오류가 발생했습니다.",
        isTimeout
          ? ERROR_CODES.OGP_WARN_TIMEOUT
          : ERROR_CODES.OGP_ERROR_PARSE_FAILED,
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  /**
   * DB OgpCache 엔티티를 API 응답 규격(OgpResponseDto)으로 직렬화합니다.
   *
   * @param record OgpCache 엔티티
   * @returns OgpResponseDto
   */
  public toOgpResponseDto(record: OgpCache): OgpResponseDto {
    return serializeOgpCacheToDto(record);
  }

  /**
   * URL에 대한 유효 OGP 캐시를 조회하고, 미존재·만료 시 크롤링 후 14일 TTL로 저장하여 반환합니다.
   *
   * @param rawUrl 파싱할 대상 URL
   * @returns 캐싱 또는 신규 크롤링된 OGP 응답 DTO
   */
  @LogTrace()
  async parseAndCacheOgp(rawUrl: string): Promise<OgpResponseDto> {
    const validatedUrl = (
      await this.validateSafeExternalUrlWithDns(rawUrl)
    ).toString();
    const now = new Date();

    // 1. 유효 기간이 남은 캐시 우선 조회
    const cached = await this.ogpRepository.findValidOgpCacheByUrl(
      validatedUrl,
      now
    );
    if (cached) {
      return this.toOgpResponseDto(cached);
    }

    // 2. 외부 페이지 OGP 메타데이터 크롤링 및 14일 TTL 업서트
    const scraped = await this.scrapeUrlMetadata(validatedUrl);
    const expiresAt = new Date(now.getTime() + OGP_TTL_MS);

    const saved = await this.ogpRepository.upsertOgpCache({
      id: uuidv7(),
      targetUrl: validatedUrl,
      title: scraped.title,
      thumbnailUrl: scraped.thumbnailUrl,
      description: scraped.description,
      fetchedAt: now,
      expiresAt,
    });

    return this.toOgpResponseDto(saved);
  }

  /**
   * 만료된 OGP 캐시 레코드를 일괄 삭제합니다 (크론 스케줄러 호출용).
   *
   * @returns 삭제된 레코드 수
   */
  @LogTrace()
  async cleanupExpiredCaches(): Promise<number> {
    const deleted = await this.ogpRepository.deleteExpiredOgpCaches(new Date());
    return deleted.length;
  }
}
