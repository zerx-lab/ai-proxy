#!/usr/bin/env bash
# One-click self-host: build the Encore backend image + run it with Postgres.
# Migrations auto-apply at app startup (Encore runs drizzle migrations on boot).
#
# Usage:  ./deploy/selfhost.sh            # build image + bring stack up
#         ./deploy/selfhost.sh down       # stop the stack
#         ./deploy/selfhost.sh logs       # tail app logs
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
COMPOSE="deploy/docker-compose.yml"
ENV_FILE="deploy/.env"
IMAGE="ai-proxy:latest"

cmd="${1:-up}"

require() { command -v "$1" >/dev/null 2>&1 || { echo "error: '$1' is required but not installed." >&2; exit 1; }; }

case "$cmd" in
  down)
    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" down
    exit 0 ;;
  logs)
    docker compose -f "$COMPOSE" --env-file "$ENV_FILE" logs -f app frontend
    exit 0 ;;
esac

require docker
require encore

# 1. Ensure secrets exist (generated once, reused on subsequent runs).
if [ ! -f "$ENV_FILE" ]; then
  echo "==> generating $ENV_FILE with fresh secrets"
  {
    echo "DB_PASSWORD=$(encore rand bytes 24 -f hex 2>/dev/null || openssl rand -hex 24)"
    echo "JWT_SECRET=$(encore rand bytes 32 -f hex 2>/dev/null || openssl rand -hex 32)"
    echo "APP_PORT=8080"
    echo "FRONTEND_PORT=3000"
    # Backend URL the browser calls. For remote/production, change to your
    # public address, e.g. https://gateway.example.com (or your host IP:port).
    echo "BACKEND_URL=http://localhost:8080"
  } > "$ENV_FILE"
  echo "    (keep $ENV_FILE safe; it holds your DB password + JWT signing key)"
fi

# 2. Regenerate drizzle migration SQL from the current schema (idempotent).
echo "==> generating drizzle migrations from schema"
npx drizzle-kit generate

# 3. Build the portable Encore Docker image with the self-host infra config.
echo "==> building $IMAGE"
encore build docker --config deploy/infra-config.json "$IMAGE"

# 4. Bring up Postgres, run migrations (one-shot), then start the app.
echo "==> starting stack"
docker compose -f "$COMPOSE" --env-file "$ENV_FILE" up -d --build

PORT="$(grep -E '^APP_PORT=' "$ENV_FILE" | cut -d= -f2)"
FPORT="$(grep -E '^FRONTEND_PORT=' "$ENV_FILE" | cut -d= -f2)"
echo
echo "Backend  on http://localhost:${PORT:-8080}"
echo "  health:  curl http://localhost:${PORT:-8080}/healthz"
echo "Frontend on http://localhost:${FPORT:-3000}"
echo "  first signup at /auth/signup becomes the admin account."
echo
echo "Remote deploy: set BACKEND_URL in $ENV_FILE to your public address,"
echo "then re-run: docker compose -f $COMPOSE --env-file $ENV_FILE up -d"
echo "Tail logs with: ./deploy/selfhost.sh logs"
