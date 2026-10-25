FROM node:24-bookworm-slim AS deps
WORKDIR /app
# Narzedzia kompilacji: fallback dla better-sqlite3, gdy brak gotowego binarium (np. ARM64 na Oracle A1).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends rclone \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json ./
COPY src ./src
COPY --from=builder /app/migrations ./migrations
EXPOSE 3000
CMD ["sh", "-c", "if [ -z \"$SESSION_SECRET\" ] || [ \"$SESSION_SECRET\" = change-me-before-use ]; then echo 'SESSION_SECRET is missing or still the example value' >&2; exit 1; fi; npm run db:migrate && npm run start"]
