#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY_DIR="$ROOT_DIR/contracts/registry"
APPGATE_DIR="$ROOT_DIR/contracts/appgate"

REGISTRY_WASM="$ROOT_DIR/contracts/target/wasm32v1-none/release/registry.wasm"
APPGATE_WASM="$ROOT_DIR/contracts/target/wasm32v1-none/release/appgate.wasm"

export PATH="$PATH:/home/enzo95/.local/bin"

: "${STELLAR_NETWORK:=testnet}"
: "${STELLAR_SOURCE:=deployer}"

echo "Optimizing IdentityRegistry..."
stellar contract optimize --wasm "$REGISTRY_WASM"
REGISTRY_WASM="$ROOT_DIR/contracts/target/wasm32v1-none/release/registry.optimized.wasm"

echo "Optimizing AppGate..."
stellar contract optimize --wasm "$APPGATE_WASM"
APPGATE_WASM="$ROOT_DIR/contracts/target/wasm32v1-none/release/appgate.optimized.wasm"

echo "Deploying IdentityRegistry..."
REGISTRY_ID=$(stellar contract deploy \
  --network "$STELLAR_NETWORK" \
  --source "$STELLAR_SOURCE" \
  --wasm "$REGISTRY_WASM")
echo "IdentityRegistry deployed at: $REGISTRY_ID"

echo "Deploying AppGate..."
APPGATE_ID=$(stellar contract deploy \
  --network "$STELLAR_NETWORK" \
  --source "$STELLAR_SOURCE" \
  --wasm "$APPGATE_WASM")
echo "AppGate deployed at: $APPGATE_ID"

ADMIN_ADDRESS=$(stellar keys address "$STELLAR_SOURCE")

echo "Initializing IdentityRegistry..."
stellar contract invoke \
  --network "$STELLAR_NETWORK" \
  --source "$STELLAR_SOURCE" \
  --id "$REGISTRY_ID" \
  -- init \
  --admin "$ADMIN_ADDRESS"

NETWORK_DOMAIN="0000000000000000000000000000000000000000000000000000000000000001"
APPGATE_DOMAIN="0000000000000000000000000000000000000000000000000000000000000002"

echo "Initializing AppGate..."
stellar contract invoke \
  --network "$STELLAR_NETWORK" \
  --source "$STELLAR_SOURCE" \
  --id "$APPGATE_ID" \
  -- init \
  --admin "$ADMIN_ADDRESS" \
  --network_domain "$NETWORK_DOMAIN" \
  --app_gate_domain "$APPGATE_DOMAIN" \
  --registry_id "$REGISTRY_ID" \
  --vk_bytes-file-path "$ROOT_DIR/artifacts/fixture/vk/vk"

echo "Deployment complete."
echo "REGISTRY_ID=$REGISTRY_ID" > "$ROOT_DIR/.env"
echo "APPGATE_ID=$APPGATE_ID" >> "$ROOT_DIR/.env"
echo "NETWORK_DOMAIN=$NETWORK_DOMAIN" >> "$ROOT_DIR/.env"
echo "APPGATE_DOMAIN=$APPGATE_DOMAIN" >> "$ROOT_DIR/.env"
echo "STELLAR_NETWORK=$STELLAR_NETWORK" >> "$ROOT_DIR/.env"
echo "STELLAR_SOURCE=$STELLAR_SOURCE" >> "$ROOT_DIR/.env"
echo "ADMIN_ADDRESS=$ADMIN_ADDRESS" >> "$ROOT_DIR/.env"

echo "Wrote configuration to .env"
