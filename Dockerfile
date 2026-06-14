# syntax=docker/dockerfile:1.7
# Multi-stage build for TanStack Start app
# Builds a Node server image you can run anywhere (EC2, ECS, bare metal).

ARG NODE_VERSION=20

# -------- deps --------
FROM oven/bun:1.2 AS deps
WORKDIR /app
COPY package.json bun.lock* package-lock.json* ./
RUN bun install --frozen-lockfile || bun install

# -------- build --------
FROM oven/bun:1.2 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build with the Node server preset so the app runs as a regular Node process
ENV NITRO_PRESET=node-server
ENV NODE_ENV=production
# VITE_* env vars are inlined at build time — pass them via --build-arg
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
ENV VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID}
RUN bun run build

# -------- runtime --------
FROM node:${NODE_VERSION}-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
# Nitro node-server output lives in .output/
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
