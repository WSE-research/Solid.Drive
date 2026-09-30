#!/usr/bin/env bash
# Clones pdsinterop/php-solid-server at the pinned commit into ./server and
# applies the one source change the benchmark needs (disabling the
# publish-subscribe service). The Dockerfile and zz-benchmark-tuning.ini in this
# directory carry the rest. Safe to re-run; it re-clones from scratch.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
COMMIT=e8d265cd45c59ef0f02146ad44d52dc5a9cf71f0
SRC="$HERE/server"

rm -rf "$SRC"
git clone https://github.com/pdsinterop/php-solid-server "$SRC"
git -C "$SRC" -c advice.detachedHead=false checkout "$COMMIT"

# Build with the benchmark Dockerfile (opcache, the host IP in the certificate,
# and an optional longer token lifetime).
cp "$HERE/Dockerfile" "$SRC/Dockerfile"

# Without a publish-subscribe server the default URL points to an endpoint that
# does not exist, so every write returns HTTP 500. An empty URL makes the server
# skip the notification.
sed -i 's/\$server->setPubSubUrl(\$pubsub);/$server->setPubSubUrl("");/' "$SRC/web/index.php"

echo "patched ./server at ${COMMIT:0:12}. Next: docker compose up -d --build"
