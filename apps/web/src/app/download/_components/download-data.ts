/**
 * Ideamory Android APK 배포 버전 및 다운로드 경로 단일 진실 공급원(SSOT)
 * `next.config.ts`가 `android/app/build.gradle`의 `versionName`을 읽어 `NEXT_PUBLIC_APK_VERSION`으로 주입하므로,
 * Gradle 버전업 시 `/download` 페이지 표기 버전과 다운로드 링크가 자동으로 동기화됩니다.
 */
export const APK_VERSION = process.env.NEXT_PUBLIC_APK_VERSION || "1.0.6";
export const APK_FILE_NAME = `ideamory-android-v${APK_VERSION}.apk`;
export const APK_DOWNLOAD_HREF = `/downloads/${APK_FILE_NAME}`;

export interface DownloadHighlightFeature {
  id: "share-intent" | "zero-splash" | "offline-and-back";
  title: string;
  description: string;
}

/**
 * `/download` 페이지 하단에 표시되는 Android 네이티브 앱 3대 핵심 기능 안내 데이터
 */
export const DOWNLOAD_HIGHLIGHT_FEATURES: readonly DownloadHighlightFeature[] = [
  {
    id: "share-intent",
    title: "Share Intent 즉시 캡처",
    description:
      "외부 앱에서 공유하기 ➔ Ideamory를 선택하면 하단 썸존 입력창에 텍스트와 링크가 0ms로 자동 주입됩니다.",
  },
  {
    id: "zero-splash",
    title: "0ms 조건부 스플래시",
    description:
      "정상 네트워크에서는 1~2초 고정 대기 없이 썸존으로 직행하며, 백엔드 지연 시에만 부드러운 로딩 스플래시를 표시합니다.",
  },
  {
    id: "offline-and-back",
    title: "브랜드 오프라인 & 뒤로가기",
    description:
      "열린 드로어·시트·필터를 역순으로 닫은 뒤 2초 내 2회 뒤로가기 시 안전하게 종료되며, 오프라인 시 재시도 안내 뷰를 제공합니다.",
  },
] as const;
