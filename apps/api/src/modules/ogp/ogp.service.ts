import { Injectable, Logger, HttpStatus } from "@nestjs/common";
import { v7 as uuidv7 } from "uuid";
import ogs from "open-graph-scraper";
import { ERROR_CODES, type OgpResponseDto } from "@ideamory/api-spec";
import { type OgpCache } from "@ideamory/db";
import { BusinessException } from "../../common/exceptions/business.exception";
import { OgpRepository } from "./ogp.repository";

/** OGP 캐시 기본 TTL (14일, 밀리초 단위) */
const OGP_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** OGP 크롤러 HTTP 요청 타임아웃 (초 단위) */
const OGP_SCRAPE_TIMEOUT_SECONDS = 5;

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
    const match = text.match(/https?:\/\/[^\s<>"')]+/i);
    if (!match) {
      return null;
    }
    // 문장 끝 구두점(.,!?)이 URL 끝에 붙은 경우 정리
    return match[0].replace(/[.,!?;:]+$/, "");
  }

  /**
   * SSRF(Server-Side Request Forgery) 공격 방어를 위해 외부 URL의 프로토콜과 호스트를 검증합니다.
   *
   * @param rawUrl 검증할 원본 URL 문자열
   * @returns 파싱 및 검증이 완료된 URL 객체
   * @throws BusinessException 허용되지 않는 프로토콜 또는 내부망 주소인 경우 400 발생
   */
  public validateSafeExternalUrl(rawUrl: string): URL {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BusinessException(
        "올바른 URL 형식이 아닙니다.",
        ERROR_CODES.COMMON_FIELD_FORMAT,
        HttpStatus.BAD_REQUEST
      );
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new BusinessException(
        "http 또는 https 프로토콜만 지원합니다.",
        ERROR_CODES.COMMON_FIELD_FORMAT,
        HttpStatus.BAD_REQUEST
      );
    }

    const hostname = parsed.hostname.toLowerCase();
    const isPrivateOrLoopback =
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.startsWith("fc00:") ||
      hostname.startsWith("fe80:") ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^0\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

    if (isPrivateOrLoopback) {
      throw new BusinessException(
        "내부 네트워크 또는 허용되지 않은 호스트로의 접근은 차단됩니다.",
        ERROR_CODES.OGP_ERROR_PARSE_FAILED,
        HttpStatus.BAD_REQUEST
      );
    }

    return parsed;
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
      const { error, result } = await ogs({
        url: targetUrl,
        timeout: OGP_SCRAPE_TIMEOUT_SECONDS,
      });

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
        thumbnailUrl: rawThumbnail,
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
   */
  public toOgpResponseDto(record: OgpCache): OgpResponseDto {
    return {
      id: record.id,
      targetUrl: record.targetUrl,
      title: record.title,
      thumbnailUrl: record.thumbnailUrl,
      description: record.description,
      expiresAt: record.expiresAt.toISOString(),
      fetchedAt: record.fetchedAt.toISOString(),
    };
  }

  /**
   * URL에 대한 유효 OGP 캐시를 조회하고, 미존재·만료 시 크롤링 후 14일 TTL로 저장하여 반환합니다.
   *
   * @param rawUrl 파싱할 대상 URL
   * @returns 캐싱 또는 신규 크롤링된 OGP 응답 DTO
   */
  async parseAndCacheOgp(rawUrl: string): Promise<OgpResponseDto> {
    const validatedUrl = this.validateSafeExternalUrl(rawUrl).toString();
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
  async cleanupExpiredCaches(): Promise<number> {
    const deleted = await this.ogpRepository.deleteExpiredOgpCaches(new Date());
    return deleted.length;
  }
}

