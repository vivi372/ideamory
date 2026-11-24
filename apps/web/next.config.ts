import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * 모노레포 루트(.env.local -> .env)의 환경변수를 apps/web에서도 단일 관리로 공유합니다.
 * `process.loadEnvFile`은 이미 존재하는 `process.env` 값을 덮어쓰지 않으므로,
 * Vercel/CI 주입 변수 > 루트 .env.local > 루트 .env 순의 우선순위를 자동으로 보장합니다.
 */
const workspaceRoot = path.resolve(__dirname, "../..");
for (const envFileName of [".env.local", ".env"]) {
  const envFilePath = path.join(workspaceRoot, envFileName);
  if (fs.existsSync(envFilePath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envFilePath);
  }
}

/**
 * Android Gradle 설정(`android/app/build.gradle`)의 `versionName`을 읽어
 * `/download` 페이지 APK 버전 표기의 단일 진실 공급원(SSOT)으로 동기화합니다.
 *
 * @returns 추출된 `versionName` 문자열 (파일 미존재 또는 파싱 실패 시 기본 폴백 `"1.0.6"`)
 */
function resolveAndroidApkVersion(): string {
  const gradlePath = path.join(__dirname, "android/app/build.gradle");
  try {
    if (fs.existsSync(gradlePath)) {
      const gradleContent = fs.readFileSync(gradlePath, "utf-8");
      const match = gradleContent.match(/versionName\s+["']([^"']+)["']/);
      if (match?.[1]) {
        return match[1];
      }
    }
  } catch {
    // Gradle 파일 읽기 실패 시 폴백 버전 사용
  }
  return "1.0.6";
}

const isCapacitorExport = process.env.CAPACITOR_EXPORT === "true";
const DEFAULT_CAPACITOR_API_URL =
  "https://p01--ideamory--fyppwr9k8xfj.code.run";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ["@ideamory/api-spec"],
  env: {
    NEXT_PUBLIC_APK_VERSION:
      process.env.NEXT_PUBLIC_APK_VERSION ?? resolveAndroidApkVersion(),
    // Capacitor 정적 앱 빌드 시 루트 .env.local(localhost:3001)이 번들에 박히지 않도록 운영 백엔드를 자동 지정
    ...(isCapacitorExport
      ? {
          NEXT_PUBLIC_API_URL:
            process.env.CAPACITOR_API_URL?.trim() || DEFAULT_CAPACITOR_API_URL,
        }
      : {}),
  },
  ...(isCapacitorExport
    ? {
        distDir: ".next-export",
        output: "export",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
