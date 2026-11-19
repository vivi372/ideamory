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

const isCapacitorExport = process.env.CAPACITOR_EXPORT === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ["@ideamory/api-spec"],
  ...(isCapacitorExport
    ? {
        output: "export",
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
