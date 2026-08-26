#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=/opt/dhole/docker-compose.services.yml

docker version
docker compose version
docker network inspect dhole >/dev/null
test -r /opt/dhole/.env
test -r "$COMPOSE_FILE"
docker compose --env-file /opt/dhole/.env -f "$COMPOSE_FILE" config -q

SHA_TAG="$(git rev-parse --short=12 HEAD)"

read_env() {
  local key="$1"
  local value
  value="$(grep -m1 "^${key}=" /opt/dhole/.env | cut -d= -f2- || true)"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

VITE_API_URL="$(read_env VITE_API_URL)"
VITE_APP_NAME="$(read_env VITE_APP_NAME)"
VITE_FRONTEND_DOMAIN="$(read_env VITE_FRONTEND_DOMAIN)"
: "${VITE_API_URL:?VITE_API_URL is required in /opt/dhole/.env}"
: "${VITE_APP_NAME:?VITE_APP_NAME is required in /opt/dhole/.env}"
: "${VITE_FRONTEND_DOMAIN:?VITE_FRONTEND_DOMAIN is required in /opt/dhole/.env}"

docker build \
  --pull \
  -f Dockerfile \
  --build-arg VITE_API_URL="$VITE_API_URL" \
  --build-arg VITE_APP_NAME="$VITE_APP_NAME" \
  --build-arg VITE_FRONTEND_DOMAIN="$VITE_FRONTEND_DOMAIN" \
  -t dhole/web:latest \
  -t "dhole/web:$SHA_TAG" \
  .

docker run --rm --entrypoint sh dhole/web:latest -ec '
  if grep -R -n -E "https?://(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)" /usr/share/nginx/html; then
    echo "Production bundle contains a private-network URL."
    exit 1
  fi
  if grep -R -n -F ":5209/api/notifications" /usr/share/nginx/html; then
    echo "Production bundle contains a direct Notifications service URL."
    exit 1
  fi
'

docker compose --env-file /opt/dhole/.env -f "$COMPOSE_FILE" up -d --no-deps --force-recreate --pull never dhole-web
docker compose --env-file /opt/dhole/.env -f "$COMPOSE_FILE" ps dhole-web
docker image prune -f
