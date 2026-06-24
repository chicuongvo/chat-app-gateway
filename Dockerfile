# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:22-alpine AS production
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodeuser

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

RUN chown -R nodeuser:nodejs /app
USER nodeuser

ENV NODE_ENV=production
ENV GATEWAY_PORT=4000
ENV OTEL_SERVICE_NAME=api-gateway

EXPOSE 4000
EXPOSE 9464

CMD ["node", "--import", "./dist/tracing.js", "dist/index.js"]
