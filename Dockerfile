FROM node:24.16.0 AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
# Use the pnpm version pinned by package.json; retry transient registry/DNS failures.
RUN set -eu; \
    for attempt in 1 2 3; do \
      if pnpm install --frozen-lockfile; then exit 0; fi; \
      if [ "$attempt" -eq 3 ]; then exit 1; fi; \
      echo "pnpm install failed (attempt $attempt/3); retrying..." >&2; \
      sleep "$((attempt * 10))"; \
    done

COPY . .

ARG VITE_API_URL
ARG VITE_APP_NAME=DholeSystem
ARG VITE_FRONTEND_DOMAIN

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_FRONTEND_DOMAIN=${VITE_FRONTEND_DOMAIN}

RUN pnpm run build

FROM nginx:alpine AS final

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
