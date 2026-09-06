#!/usr/bin/env bash
# Full benchmark sweep. Ran from the client VM against the server VM's CSS.
#
# first run the correctness suites, so a broken invariant aborts before
# the long latency sweeps.
set -euo pipefail

# Samples per data point. 1000 is this thesis target.
BASE_URL="${1:?usage: run-full-sweep.sh <base-url>}"
REPEATS="${REPEATS:-1000}"
# Stop climbing the load/grid ladders once a level's timeout share hits this %.
# A saturated level is an expected end state, not an error.
ABORT_PCT="${ABORT_PCT:-100}"
LOG_DIR="bench/results/logs"
mkdir -p "$LOG_DIR"

# Stamp every raw file with the commit under test, for dataset provenance.
export BENCH_COMMIT="${BENCH_COMMIT:-$(git rev-parse HEAD 2>/dev/null || echo unknown)}"
echo "commit under test: $BENCH_COMMIT"

# Run only the named suites.
ONLY="${ONLY:-}"

run() {
  local name="$1"; shift
  if [ -n "$ONLY" ] && [[ ",$ONLY," != *",$name,"* ]]; then
    echo "=== $name (skipped: ONLY=$ONLY) ==="; echo
    return 0
  fi
  local log="$LOG_DIR/${name}-$(date +%s).log"
  echo "=== $name ==="
  echo "    $* 2>&1 | tee $log"
  local start=$(date +%s)
  "$@" 2>&1 | tee "$log"
  echo "    ${name} done in $(($(date +%s) - start))s"
  echo
}

# Correctness gates: must pass before spending sweep time on latency/overhead or load/saturation.
run correctness npx vite-node bench/suites/correctness/runner.ts -- --base-url "$BASE_URL"
# inject a failure at each soft-delete step; the file must stay recoverable
run failure-atomicity npx vite-node bench/suites/failure-atomicity/runner.ts -- --base-url "$BASE_URL"
# ACLs survive a delete+restore, triple-for-triple
run acl-preservation npx vite-node bench/suites/acl-preservation/runner.ts  -- --base-url "$BASE_URL"

# --- Latency / overhead sweeps ---
# Base HTTP ops on their own (GET/PUT/PATCH/DELETE + ACL-vs-binary delete), so any
# anomaly in the composed processes below points to the process, not a base op.
run basic-ops npx vite-node bench/suites/basic-ops/runner.ts -- \
  --base-url "$BASE_URL" --sizes-kb 1,16,256,4096,8192,16384 --repeats "$REPEATS"

# soft vs hard delete: latency, requests, and bytes, across file size and trash size
run soft-delete    npx vite-node bench/suites/soft-delete/runner.ts -- \
  --base-url "$BASE_URL" --sizes-kb 16,256,4096,8192,16384 --trash-sizes 0,64,512 \
  --arms soft,hard --repeats "$REPEATS"

# restore a trashed file vs an ordinary read, across file size
run restore npx vite-node bench/suites/restore/runner.ts -- \
  --base-url "$BASE_URL" --sizes-kb 16,256,4096,8192,16384 --arms restore,read \
  --repeats "$REPEATS"

# bytes kept per soft-deleted file: the payload once, plus fixed metadata overhead
run storage npx vite-node bench/suites/storage/runner.ts -- \
  --base-url "$BASE_URL" --sizes-kb 16,256,4096,8192,16384 --repeats "$REPEATS"

# cost of opening the trash as it fills: one catalog read + one tombstone per item
run trash-listing npx vite-node bench/suites/trash-listing/runner.ts -- \
  --base-url "$BASE_URL" --item-counts 5,20,50,100 --repeats "$REPEATS"

# PUT vs N3 Patch for one catalog append, across catalog size, single client.
run write-method  bash -c \
  "NODE_OPTIONS=--max-old-space-size=8192 npx tsx bench/suites/write-method/runner.ts \
    --base-url '$BASE_URL' --catalog-sizes 8,16,32,64,128,256,512,1024,2048,4096,8192,16384 
    --levels 1 --repeats $REPEATS"

# --- Load / saturation ladder ---
# Concurrent 1-byte creates into one container, the concurrency climbing until
# timeouts dominate (30 s = failure). 
# Reports mean latency of the successful requests plus the timeout share per level.
run load npx vite-node bench/suites/load/runner.ts -- \
  --base-url "$BASE_URL" --levels 8,16,24,32,40,48,56,64,96,128,192,256 --deadline-ms 30000 --repeats "$REPEATS" --abort-pct "$ABORT_PCT"

# --- Scaling grid: catalog size x clients (heaviest step, run last) ---
# Measures the whole plane once; the thesis plots both orientations from it plus
# timeout-share bars. Mean over successful requests only. Big heap: up to 64 seeded
# 16384-entry catalogs per cell. Validate cheap first (RUNS_PER_CELL=20, trimmed grid).
GRID_CATALOGS="${GRID_CATALOGS:-8,16,32,64,128,256,512,1024,2048,4096,8192,16384}"
GRID_CLIENTS="${GRID_CLIENTS:-8,16,24,32,40,48,56,64,96,128,192,256}"
RUNS_PER_CELL="${RUNS_PER_CELL:-$REPEATS}"
run scaling-grid  bash -c \
  "NODE_OPTIONS=--max-old-space-size=8192 npx tsx bench/suites/scaling-grid/runner.ts \
    --base-url '$BASE_URL' --catalog-sizes '$GRID_CATALOGS' --client-levels '$GRID_CLIENTS' \
    --methods put --runs-per-cell $RUNS_PER_CELL --deadline-ms 30000 --abort-pct $ABORT_PCT"

echo "All suites complete. Results in bench/results/ (raw data in bench/results/raw/), logs in $LOG_DIR/."
