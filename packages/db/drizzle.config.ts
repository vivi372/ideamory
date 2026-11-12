import { defineConfig } from "drizzle-kit";

/**
 * Ideamory Drizzle Kit 마이그레이션 및 스키마 관리 설정
 */
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  verbose: true,
  strict: true,
});

