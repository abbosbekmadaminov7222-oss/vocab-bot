# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src

RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/i18n/locales ./dist/i18n/locales
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

EXPOSE 3000

CMD ["node", "dist/index.js"]
