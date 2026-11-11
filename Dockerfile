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
ARG VITE_GEOAPIFY_API_KEY
ARG VITE_BUILD_SHA=local
ARG VITE_RELEASE_CHANNEL=local
ARG VITE_DHOLE_REALTIME_ENABLED=false
ARG VITE_DHOLE_REALTIME_NOTIFICATIONS_PILOT=false
ARG VITE_DHOLE_REALTIME_RELEASE=rt-20261107-01

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_FRONTEND_DOMAIN=${VITE_FRONTEND_DOMAIN}
ENV VITE_GEOAPIFY_API_KEY=${VITE_GEOAPIFY_API_KEY}
ENV VITE_BUILD_SHA=${VITE_BUILD_SHA}
ENV VITE_RELEASE_CHANNEL=${VITE_RELEASE_CHANNEL}
ENV VITE_DHOLE_REALTIME_ENABLED=${VITE_DHOLE_REALTIME_ENABLED}
ENV VITE_DHOLE_REALTIME_NOTIFICATIONS_PILOT=${VITE_DHOLE_REALTIME_NOTIFICATIONS_PILOT}
ENV VITE_DHOLE_REALTIME_RELEASE=${VITE_DHOLE_REALTIME_RELEASE}

RUN pnpm run build

FROM nginx:alpine AS final

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
