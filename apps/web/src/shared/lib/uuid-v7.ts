/**
 * RFC 9562 규격의 UUID v7 식별자를 생성합니다.
 *
 * 상위 48비트에 현재 밀리초(ms) 타임스탬프를 배치하여 시간순 정렬(B-Tree 인덱스 최적화)이
 * 가능하며, 백엔드 `GuestInitSchema` 및 `UuidV7Schema` 정규식 검증을 100% 통과합니다.
 *
 * @returns 소문자 하이픈 포함 UUID v7 문자열 (예: `01931f6e-7000-7c3e-8f23-8c4c7a5b3e10`)
 */
export function generateUuidV7(): string {
  const bytes = new Uint8Array(16);

  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  ) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < 16; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  // 상위 48비트(0~5바이트): Unix Epoch 밀리초 타임스탬프 (Big-Endian)
  const timestamp = BigInt(Date.now());
  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);

  // Version 7 비트 마스킹 (6번째 바이트 상위 4비트를 0111로 고정)
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;

  // Variant 10xx 비트 마스킹 (8번째 바이트 상위 2비트를 10으로 고정)
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
