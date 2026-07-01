#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CIRCUIT_DIR="$ROOT_DIR/circuits/sybil"
FIXTURE_DIR="$ROOT_DIR/artifacts/fixture"

NARGO_BIN="$HOME/.nargo/bin/nargo"

mkdir -p "$FIXTURE_DIR"

cd "$CIRCUIT_DIR"
"$NARGO_BIN" execute
cd "$ROOT_DIR"
npx tsx scripts/prove-fixture.ts

echo "Generated proof and vk at $FIXTURE_DIR"
