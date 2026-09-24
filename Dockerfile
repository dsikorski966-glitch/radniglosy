FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Pełny install (razem z dev) — Tailwind/PostCSS są potrzebne do builda
RUN npm install

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* next.config.js ./
# Na runtime wystarczą dependencies (bez dev)
RUN npm install --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/db ./db
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/lib ./lib
COPY --from=build /app/pages ./pages
COPY --from=build /app/components ./components
COPY --from=build /app/styles ./styles
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.js && ./node_modules/.bin/next start -p 3000"]
