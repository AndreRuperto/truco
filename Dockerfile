# syntax=docker/dockerfile:1
# Monorepo pnpm (node-linker=hoisted). O server roda TypeScript com tsx; o web é build estático
# servido pelo próprio server (mesma origem). Se a imagem node:26 não existir, use
# `--build-arg NODE_VERSION=24` (Node 24 LTS).
ARG NODE_VERSION=26

FROM node:${NODE_VERSION}-slim AS base
# Node 25+ não traz mais o corepack: instala o pnpm do packageManager direto do npm.
RUN npm install -g pnpm@9.12.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @truco/web build

FROM base AS producao
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/engine/package.json packages/engine/
RUN pnpm install --frozen-lockfile --prod && pnpm store prune
COPY tsconfig.base.json ./
COPY packages/engine/src packages/engine/src
COPY apps/server/tsconfig.json apps/server/
COPY apps/server/src apps/server/src
COPY apps/server/drizzle apps/server/drizzle
COPY --from=build /app/apps/web/dist apps/web/dist
# Só usado sem DATABASE_URL (PGlite em disco); com Postgres fica vazio.
RUN mkdir -p apps/server/.dados && chown node:node apps/server/.dados
USER node
WORKDIR /app/apps/server
EXPOSE 8080
# node direto (sem pnpm no meio) para o SIGTERM do Railway chegar ao Colyseus (desligamento gracioso).
# O tsx resolve os aliases (@truco/engine) pelo tsconfig desta pasta.
CMD ["node", "--import", "tsx", "src/main.ts"]
