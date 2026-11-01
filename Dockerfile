FROM node:24-bookworm-slim AS deps
WORKDIR /app
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
# Cache danych jezykowych OCR (tesseract.js) poza katalogiem aplikacji.
ENV TESSERACT_CACHE_DIR=/app/.cache/tesseract
RUN apt-get update \
  && apt-get install -y --no-install-recommends rclone \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY package.json ./
COPY src ./src
COPY --from=builder /app/migrations ./migrations
# Kod aplikacji nalezy do roota (tylko do odczytu dla procesu); zapisywalne sa
# wylacznie katalogi danych, backupu i cache. Proces dziala jako `node` (uid 1000).
RUN mkdir -p /app/data /app/backups /app/.next/cache /app/.cache/tesseract \
  && chown -R node:node /app/data /app/backups /app/.next/cache /app/.cache
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run db:migrate && npm run start"]
