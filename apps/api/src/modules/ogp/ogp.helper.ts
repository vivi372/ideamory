import { HttpStatus } from "@nestjs/common";
import { isIP } from "node:net";
import { ERROR_CODES, type OgpResponseDto } from "@ideamory/api-spec";
import type { OgpCache } from "@ideamory/db";
import { BusinessException } from "../../common/exceptions/business.exception";

/** OGP 캐시 기본 TTL (14일, 밀리초 단위) */
export const OGP_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** OGP 크롤러 HTTP 요청 타임아웃 (초 단위) */
export const OGP_SCRAPE_TIMEOUT_SECONDS = 5;

/** OGP 크롤링 시 허용하는 최대 HTTP 리다이렉트 횟수 */
export const MAX_OGP_REDIRECTS = 3;

/** OGP HTML 응답 본문 최대 허용 크기 (2MB) */
export const MAX_OGP_HTML_BYTES = 2 * 1024 * 1024;

/**
 * 메모 본문 텍스트에서 첫 번째 http(s) URL 1개만 추출합니다.
 *
 * [설계 원칙]
 * 메모 1건당 대표 링크 1개의 OGP 카드만 렌더링하므로, 본문 내 여러 URL이 존재해도
 * 가장 먼저 등장하는 첫 번째 URL만 추출하고 문장 끝 구두점(`.,!?;:`)을 제거합니다.
 *
 * @param text 메모 본문 텍스트
 * @returns 추출된 첫 번째 URL 문자열 또는 URL이 없을 경우 null
 */
export function extractFirstUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"')]+/i);
  if (!match) {
    return null;
  }
  // 문장 끝 구두점(.,!?;:)이 URL 끝에 붙은 경우 안전하게 제거
  return match[0].replace(/[.,!?;:]+$/, "");
}

/**
 * IPv4 주소가 사설망, 루프백, 링크로컬(클라우드 메타데이터 169.254.x.x), 멀티캐스트 또는 예약 대역인지 판별합니다.
 *
 * @param ipv4 점(.)으로 구분된 IPv4 주소 문자열
 * @returns 내부망 또는 예약 대역이면 true, 공인 IPv4 주소이면 false
 */
export function isPrivateOrReservedIpv4Address(ipv4: string): boolean {
  const octets = ipv4.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => Number.isNaN(o))) {
    return true;
  }
  const [a, b] = octets;

  return (
    a === 0 || // 0.0.0.0/8 (Current network)
    a === 10 || // 10.0.0.0/8 (Private Class A)
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (Carrier-Grade NAT)
    a === 127 || // 127.0.0.0/8 (Loopback)
    (a === 169 && b === 254) || // 169.254.0.0/16 (Link-local / Cloud Metadata)
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 (Private Class B)
    (a === 192 && b === 0 && octets[2] === 0) || // 192.0.0.0/24 (IETF Protocol Assignments)
    (a === 192 && b === 168) || // 192.168.0.0/16 (Private Class C)
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 (Benchmarking)
    a >= 224 // 224.0.0.0/4 이상 (Multicast & Reserved)
  );
}

/**
 * IPv4/IPv6 주소가 사설망, 루프백, 링크로컬(클라우드 메타데이터), 예약 대역인지 판별합니다.
 * IPv4-mapped IPv6(`::ffff:127.0.0.1` 등) 우회 주소도 함께 차단합니다.
 *
 * @param rawIp 검사할 IPv4 또는 IPv6 주소 문자열
 * @returns 차단 대상(내부망/예약 대역)이면 true, 안전한 공인 IP이면 false
 */
export function isPrivateOrReservedIpAddress(rawIp: string): boolean {
  const ip = rawIp.toLowerCase().trim();

  // 1. IPv4-mapped IPv6 우회 표기(::ffff:a.b.c.d) 추출 및 검증
  if (ip.startsWith("::ffff:")) {
    const mappedIpv4 = ip.slice("::ffff:".length);
    if (isIP(mappedIpv4) === 4) {
      return isPrivateOrReservedIpv4Address(mappedIpv4);
    }
  }

  // 2. 표준 IPv4 대역 검증
  if (isIP(ip) === 4) {
    return isPrivateOrReservedIpv4Address(ip);
  }

  // 3. 표준 IPv6 루프백(::1), 미지정(::), ULA(fc00::/7), 링크로컬(fe80::/10), 멀티캐스트(ff00::/8) 검증
  if (isIP(ip) === 6) {
    return (
      ip === "::" ||
      ip === "::1" ||
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      /^fe[89ab]/.test(ip) ||
      ip.startsWith("ff")
    );
  }

  return true;
}

/**
 * SSRF(Server-Side Request Forgery) 공격 방어를 위해 외부 URL의 프로토콜과 호스트명을 동기 검증합니다.
 *
 * @param rawUrl 검증할 원본 URL 문자열
 * @returns 파싱 및 1차 호스트 검증이 완료된 URL 객체
 * @throws BusinessException 허용되지 않는 프로토콜(http/https 외) 또는 내부망 호스트인 경우 400 Bad Request 발생
 */
export function validateSafeExternalUrlFormat(rawUrl: string): URL {
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

  const rawHostname = parsed.hostname.toLowerCase();
  const hostname =
    rawHostname.startsWith("[") && rawHostname.endsWith("]")
      ? rawHostname.slice(1, -1)
      : rawHostname;

  const isBlockedHostname =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    (isIP(hostname) !== 0 && isPrivateOrReservedIpAddress(hostname));

  if (isBlockedHostname) {
    throw new BusinessException(
      "내부 네트워크 또는 허용되지 않은 호스트로의 접근은 차단됩니다.",
      ERROR_CODES.OGP_ERROR_PARSE_FAILED,
      HttpStatus.BAD_REQUEST
    );
  }

  return parsed;
}

/**
 * 상대 경로 또는 프로토콜 생략(`//`) 썸네일 URL을 최종 페이지 URL 기준 절대 http(s) URL로 변환합니다.
 *
 * @param rawThumbnail HTML 메타 태그에서 추출한 원본 썸네일 URL
 * @param baseUrl 기준이 되는 최종 도착 페이지 URL
 * @returns 절대 http(s) URL 문자열 또는 유효하지 않은 경우 null
 */
export function resolveOgpThumbnailUrl(
  rawThumbnail: string | null,
  baseUrl: string
): string | null {
  const trimmed = rawThumbnail?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const resolved = new URL(trimmed, baseUrl);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

/**
 * DB `ogp_caches` 엔티티 레코드를 API 응답 규격(`OgpResponseDto`)으로 직렬화합니다.
 *
 * @param record Drizzle ORM `OgpCache` 엔티티 레코드
 * @returns ISO 타임스탬프 문자열이 적용된 `OgpResponseDto`
 */
export function serializeOgpCacheToDto(record: OgpCache): OgpResponseDto {
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
