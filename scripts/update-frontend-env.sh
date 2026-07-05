#!/usr/bin/env bash
# =============================================================================
# Update the Vercel project's VITE_API_URL + VITE_APP_NAME env vars
# and trigger a production redeploy. Use after you deploy the backend and
# have a real API URL.
#
# Usage:
#   bash scripts/update-frontend-env.sh <api-url> <vercel-token> [app-name]
#
# Example:
#   bash scripts/update-frontend-env.sh https://api.yourdomain.com vcp_xxx "DeathLegion Panel"
# =============================================================================

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <api-url> <vercel-token> [app-name]"
  echo "Example: $0 https://api.yourdomain.com vcp_xxx \"DeathLegion Panel\""
  exit 1
fi

API_URL="$1"
VERCEL_TOKEN="$2"
APP_NAME="${3:-DeathLegion Panel}"

cd "$(dirname "$0")/.."

echo "=== Removing old env vars (if any) ==="
for VAR in VITE_API_URL VITE_APP_NAME; do
  EXISTING=$(vercel env ls "$VAR" environment production --token "$VERCEL_TOKEN" 2>/dev/null | grep -c "$VAR" || true)
  if [ "$EXISTING" -gt 0 ]; then
    vercel env rm "$VAR" production --yes --token "$VERCEL_TOKEN" 2>&1 | tail -2
  fi
done

echo ""
echo "=== Setting new env vars ==="
echo "$API_URL"   | vercel env add VITE_API_URL  production --token "$VERCEL_TOKEN" 2>&1 | tail -2
echo "$APP_NAME"  | vercel env add VITE_APP_NAME production --token "$VERCEL_TOKEN" 2>&1 | tail -2

echo ""
echo "=== Triggering production redeploy ==="
DEPLOY_URL=$(vercel deploy --prod --yes --token "$VERCEL_TOKEN" 2>&1 | grep -E "^https.*vercel\.app$" | head -1)
echo ""
echo "✓ Done."
echo "  Production URL: $DEPLOY_URL"
echo "  API URL set to: $API_URL"
echo ""
echo "  Note: it takes ~30s for the build to finish. Visit the URL above to verify."
