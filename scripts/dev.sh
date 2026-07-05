#!/usr/bin/env bash
# Convenience wrapper for common dev tasks.
# Reference: docs/10-LocalDevGuide.md
set -euo pipefail

cmd="${1:-help}"
cd "$(dirname "$0")/.."

case "$cmd" in
  install)
    echo "→ Installing frontend deps..."
    (cd frontend && npm install)
    ;;

  dev:frontend)
    echo "→ Starting Vite dev server on http://localhost:5173"
    (cd frontend && npm run dev)
    ;;

  dev:backend)
    echo "→ Starting backend stack via docker compose..."
    docker compose up -d database redis
    echo "→ Starting php artisan serve on http://localhost:8000"
    (cd backend && php artisan serve)
    ;;

  dev:wings)
    echo "→ Starting Wings stub on http://localhost:8080"
    node scripts/wings-stub.mjs
    ;;

  build:frontend)
    (cd frontend && npm run build)
    ;;

  typecheck)
    (cd frontend && npx tsc --noEmit)
    ;;

  lint)
    (cd frontend && npm run lint)
    ;;

  db:migrate)
    (cd backend && php artisan migrate --force)
    ;;

  db:seed)
    (cd backend && php artisan db:seed --force)
    ;;

  db:fresh)
    (cd backend && php artisan migrate:fresh --seed --force)
    ;;

  *)
    cat <<EOF
Usage: scripts/dev.sh <command>

Commands:
  install          Install frontend npm dependencies
  dev:frontend     Start the Vite dev server (http://localhost:5173)
  dev:backend      Start the Laravel backend (http://localhost:8000) + MySQL + Redis via Docker
  dev:wings        Start the Wings stub (http://localhost:8080) for local console testing
  build:frontend   Production build the frontend
  typecheck        Run TypeScript strict checks
  lint             Run ESLint
  db:migrate       Run pending migrations
  db:seed          Seed the database
  db:fresh         Drop + migrate + seed
EOF
    ;;
esac
