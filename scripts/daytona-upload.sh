#!/usr/bin/env bash
# Upload a directory to a Daytona sandbox via base64-encoded tar over stdin.
# This avoids needing rsync or ssh.
#
# Usage: bash scripts/daytona-upload.sh <sandbox-name> <local-path>
set -euo pipefail

SANDBOX="${1:-pterodactyl-backend}"
SRC="${2:-backend}"

export PATH="/home/z/.local/bin:$PATH"

echo "=== Packaging $SRC into a base64-encoded tarball ==="
TMP_TAR=$(mktemp /tmp/daytona-upload.XXXXXX.tar.gz)
tar -czf "$TMP_TAR" \
  --exclude='vendor' \
  --exclude='node_modules' \
  --exclude='storage/logs/*' \
  --exclude='storage/framework/*' \
  --exclude='.env' \
  -C "$(dirname "$SRC")" "$(basename "$SRC")"
SIZE=$(stat -c%s "$TMP_TAR")
echo "  Packaged: $(du -h "$TMP_TAR" | cut -f1) ($SIZE bytes)"

echo ""
echo "=== Uploading to $SANDBOX via stdin ==="

# Stream the tarball through base64 → daytona exec stdin → decode + extract in the sandbox
# This avoids command-line length limits entirely.
< "$TMP_TAR" base64 | daytona exec "$SANDBOX" "
  cat > /tmp/upload.b64
  base64 -d /tmp/upload.b64 > /tmp/upload.tar.gz
  rm /tmp/upload.b64
  ls -la /tmp/upload.tar.gz
  cd ~
  # Remove existing dir if present
  rm -rf $(basename "$SRC")
  tar -xzf /tmp/upload.tar.gz
  rm /tmp/upload.tar.gz
  echo '---'
  ls $(basename "$SRC") | head -10
  echo '✓ Extracted'
"

rm -f "$TMP_TAR"
echo ""
echo "✓ Upload complete"
