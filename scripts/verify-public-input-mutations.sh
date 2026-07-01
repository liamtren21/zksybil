#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CARGO_BUILD_JOBS=1 cargo test \
  --manifest-path "$ROOT_DIR/contracts/appgate/Cargo.toml" \
  --test real_verifier \
  mutated_public_inputs_are_rejected \
  -- --nocapture

echo "All 4 independent public-input mutations were rejected by the Soroban verifier."
