#!/usr/bin/env bash
# Runs php-solid-server's subset of the benchmark: the correctness tests and the
# single-client latency suites, against a pre-seeded Bearer token that
# podSession.ts reads from the environment.
#
#   BENCH_AUTH_SCHEME=Bearer BENCH_ACCESS_TOKEN=... BENCH_POD=... BENCH_WEBID=... \
#     ./bench/run-second-server.sh https://<php-host>/
#
# Setup and token: bench/servers/php/README.adoc. load and scaling-grid are
# excluded because mod_php runs one process per request, so they saturate at the
# worker limit rather than scaling.
set -euo pipefail

BASE_URL="${1:-${SUT:?usage: run-second-server.sh <base-url>, or export SUT}}"
# 50 validates stability cheaply; set REPEATS=1000 for the single-client dataset.
REPEATS="${REPEATS:-50}"
# Label the raw files as their own environment, kept apart from the Community
# Solid Server (CSS) runs.
export BENCH_LABEL="${BENCH_LABEL:-php-solid-server}"
export BENCH_COMMIT="${BENCH_COMMIT:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
LOG_DIR="bench/results/logs"
mkdir -p "$LOG_DIR"

# The seeded token has to be in the env; podSession.ts uses it directly.
: "${BENCH_ACCESS_TOKEN:?set BENCH_ACCESS_TOKEN (see bench/servers/php/README.adoc)}"
: "${BENCH_POD:?set BENCH_POD (the pod root for peach)}"
: "${BENCH_WEBID:?set BENCH_WEBID}"
# Only the DPoP seeded-token path binds the token to a key. Bearer mode sends the
# token as-is and never imports the JWK, so it is not required there.
if [ "${BENCH_AUTH_SCHEME:-}" != "Bearer" ]; then
  : "${BENCH_DPOP_JWK:?set BENCH_DPOP_JWK (the private JWK for the token)}"
fi

echo "server   $BASE_URL"
echo "label    $BENCH_LABEL   commit $BENCH_COMMIT   repeats $REPEATS"
echo

# pdsinterop doesn't overwrite a workspace the way CSS does, so a rerun collides
# with the w0/w1/... a previous run left behind. Each suite is its own process that
# restarts the workspace counter at 0, so every suite needs its own fresh pod.
POD_ROOT="$BENCH_POD"

mint_pod() {
  local uri="${POD_ROOT}$1-$(date +%s)-${RANDOM}/"
  local code
  code=$(curl -sk -o /dev/null -w "%{http_code}" -X PUT \
    -H "Authorization: Bearer $BENCH_ACCESS_TOKEN" \
    -H 'Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"' \
    -H "Content-Type: text/turtle" --data-raw "" "$uri")
  case "$code" in 200|201|205|409) ;; *) echo "mint $uri -> HTTP $code" >&2; return 1 ;; esac
  printf '%s' "$uri"
}

# SUITES limits the run to named suites, e.g. SUITES="soft-delete restore" (or a
# comma list), for iterating on one server without repeating the ones that pass.
SUITES="${SUITES:-}"

run() {
  local name="$1"; shift
  if [ -n "$SUITES" ] && ! printf ' %s ' "${SUITES//,/ }" | grep -q " $name "; then
    return 0
  fi
  local log="$LOG_DIR/${name}-$(date +%s).log"
  echo "=== $name ==="
  if [ "${BENCH_AUTH_SCHEME:-}" = "Bearer" ]; then
    BENCH_POD="$(mint_pod "$name")"
    export BENCH_POD
    echo "    pod $BENCH_POD"
  fi
  local start=$(date +%s)
  "$@" 2>&1 | tee "$log"
  echo "    ${name} done in $(($(date +%s) - start))s"
  echo
}

# --- Correctness tests: must pass before any latency number means anything ---
run correctness       npx vite-node bench/suites/correctness/runner.ts       -- --base-url "$BASE_URL"
run failure-atomicity npx vite-node bench/suites/failure-atomicity/runner.ts -- --base-url "$BASE_URL"
run acl-preservation  npx vite-node bench/suites/acl-preservation/runner.ts  -- --base-url "$BASE_URL"

# --- Single-client latency suites (fair on PHP; concurrency suites excluded) ---
# soft-delete and restore keep their default methods (soft,hard and restore,read).
# PATCH left out: this server rejects N3 Patch, same as write-method.
run basic-ops    npx vite-node bench/suites/basic-ops/runner.ts -- \
  --base-url "$BASE_URL" --sizes-kb 1,16,256,4096,8192,16384 --repeats "$REPEATS" \
  --ops get,put,delete,acl-delete

run soft-delete  npx vite-node bench/suites/soft-delete/runner.ts -- \
  --base-url "$BASE_URL" --sizes-kb 16,256,4096,8192,16384 --trash-sizes 0,64,512 --repeats "$REPEATS"

run restore      npx vite-node bench/suites/restore/runner.ts -- \
  --base-url "$BASE_URL" --sizes-kb 16,256,4096,8192,16384 --repeats "$REPEATS"

run storage      npx vite-node bench/suites/storage/runner.ts -- \
  --base-url "$BASE_URL" --sizes-kb 16,256,4096,8192,16384 --repeats "$REPEATS"

run trash-listing npx vite-node bench/suites/trash-listing/runner.ts -- \
  --base-url "$BASE_URL" --item-counts 5,20,50,100 --repeats "$REPEATS"

# write-method: PUT only. This server does SPARQL Update, not N3 Patch.
run write-method bash -c \
  "NODE_OPTIONS=--max-old-space-size=8192 npx tsx bench/suites/write-method/runner.ts \
    --base-url '$BASE_URL' --catalog-sizes 8,16,32,64,128,256,512,1024,2048,4096,8192,16384 \
    --levels 1 --methods put --repeats $REPEATS"

echo "Done. Raw pairs in bench/results/raw/ (label $BENCH_LABEL), logs in $LOG_DIR/."
