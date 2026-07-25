# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim AS build
WORKDIR /app

ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_META_APP_ID

ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_META_APP_ID=$VITE_META_APP_ID

COPY package.json package-lock.json ./
# Coolify injects NODE_ENV=production at build time; vite/tsc live in devDependencies.
ENV NODE_ENV=development
RUN npm ci

COPY index.html vite.config.ts tsconfig*.json ./
COPY src ./src
COPY public ./public

RUN test -n "$VITE_SUPABASE_URL" -a -n "$VITE_SUPABASE_ANON_KEY" -a -n "$VITE_API_URL" || \
  (echo "ERROR: Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_API_URL as Coolify build args" >&2; exit 1)

RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache wget
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
