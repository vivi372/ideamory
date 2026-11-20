# Ideamory NestJS API (`@ideamory/api`) Northflank 프로덕션 멀티스테이지 Dockerfile
# 빌드 컨텍스트: 모노레포 루트 (.)

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@12.18.0 --activate
WORKDIR /app

# 1단계: API 및 워크스페이스 의존성(@ideamory/api-spec, @ideamory/db) 설치 및 빌드
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/api-spec/package.json ./packages/api-spec/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/tsconfig/package.json ./packages/tsconfig/package.json

RUN pnpm install --frozen-lockfile --filter @ideamory/api...

COPY packages/tsconfig ./packages/tsconfig
COPY packages/api-spec ./packages/api-spec
COPY packages/db ./packages/db
COPY apps/api ./apps/api

RUN pnpm turbo build --filter=@ideamory/api

# 2단계: 프로덕션 런타임 이미지
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api-spec/package.json ./packages/api-spec/package.json
COPY --from=builder /app/packages/api-spec/dist ./packages/api-spec/dist
COPY --from=builder /app/packages/api-spec/node_modules ./packages/api-spec/node_modules
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
