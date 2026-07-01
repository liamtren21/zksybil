#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export PATH="$PATH:/home/enzo95/.local/bin"

: "${STELLAR_NETWORK:=testnet}"
: "${STELLAR_SOURCE:?Set STELLAR_SOURCE}"
: "${REGISTRY_ID:?Set REGISTRY_ID}"
: "${APPGATE_ID:?Set APPGATE_ID}"
: "${NETWORK_DOMAIN:?Set NETWORK_DOMAIN}"
: "${APPGATE_DOMAIN:?Set APPGATE_DOMAIN}"
: "${ADMIN_ADDRESS:?Set ADMIN_ADDRESS}"

JQ_BIN="$ROOT_DIR/../tools/bin/jq"
if [[ ! -x "$JQ_BIN" ]]; then
  mkdir -p "$(dirname "$JQ_BIN")"
  curl -L --fail \
    https://github.com/jqlang/jq/releases/download/jq-1.7.1/jq-linux-amd64 \
    -o "$JQ_BIN"
  chmod +x "$JQ_BIN"
fi

FIXTURE_JSON="artifacts/fixture/metadata.json"
COMMITMENT_HEX="$("$JQ_BIN" -r '.commitmentHex' "$FIXTURE_JSON")"
ROOT_HEX="$("$JQ_BIN" -r '.merkleRootHex' "$FIXTURE_JSON")"
NULLIFIER_HEX="$("$JQ_BIN" -r '.nullifierHex' "$FIXTURE_JSON")"
SCOPE_HEX="$("$JQ_BIN" -r '.scopeHex' "$FIXTURE_JSON")"
SCOPE_DOMAIN_HEX="$("$JQ_BIN" -r '.scopeDomainHex' "$FIXTURE_JSON")"
SIGNAL_HASH_HEX="$("$JQ_BIN" -r '.signalHashHex' "$FIXTURE_JSON")"

mkdir -p evidence

invoke_read() {
  stellar contract invoke \
    --network "$STELLAR_NETWORK" \
    --source "$STELLAR_SOURCE" \
    --id "$1" \
    --send no \
    -- "${@:2}"
}

run_invoke() {
  local label="$1"
  shift
  echo "$label..."
  local log_file="/tmp/${label// /_}.log"
  stellar contract invoke \
    --network "$STELLAR_NETWORK" \
    --source "$STELLAR_SOURCE" \
    "$@" > "$log_file" 2>&1
  local status=$?
  local tx_hash=""
  if grep -q "Signing transaction:" "$log_file"; then
    tx_hash=$(grep "Signing transaction:" "$log_file" | awk '{print $NF}')
  fi
  if [[ "$status" -ne 0 ]]; then
    echo "FAILED: $label"
    cat "$log_file"
    return 1
  fi
  echo "SUCCESS. TX: $tx_hash"
  echo "$tx_hash" > "/tmp/${label// /_}_tx.txt"
  return 0
}

echo "Contract Registry: $REGISTRY_ID"
echo "Contract AppGate: $APPGATE_ID"
echo "Root: $ROOT_HEX"
echo "Nullifier: $NULLIFIER_HEX"

run_invoke "Adding_identity_to_Registry" \
  --id "$REGISTRY_ID" \
  -- add_identity \
  --issuer "$ADMIN_ADDRESS" \
  --commitment "$COMMITMENT_HEX"
REGISTRY_ADD_TX=$(cat /tmp/Adding_identity_to_Registry_tx.txt 2>/dev/null || echo "")

run_invoke "Updating_root_on_Registry" \
  --id "$REGISTRY_ID" \
  -- update_root \
  --issuer "$ADMIN_ADDRESS" \
  --new_root "$ROOT_HEX"
REGISTRY_ROOT_TX=$(cat /tmp/Updating_root_on_Registry_tx.txt 2>/dev/null || echo "")

run_invoke "Opening_scope_on_AppGate" \
  --id "$APPGATE_ID" \
  -- open_scope \
  --scope "$SCOPE_HEX" \
  --root "$ROOT_HEX" \
  --scope_domain "$SCOPE_DOMAIN_HEX" \
  --expected_signal "$SIGNAL_HASH_HEX" \
  --claim_amount 1000
APPGATE_SCOPE_TX=$(cat /tmp/Opening_scope_on_AppGate_tx.txt 2>/dev/null || echo "")

echo "Submitting claim (Airdrop)..."
set +e
stellar contract invoke \
  --network "$STELLAR_NETWORK" \
  --source "$STELLAR_SOURCE" \
  --id "$APPGATE_ID" \
  --instruction-leeway 100000000 \
  -- claim \
  --scope "$SCOPE_HEX" \
  --proof_blob-file-path artifacts/fixture/proof/proof \
  --nullifier "$NULLIFIER_HEX" \
  --signal_hash "$SIGNAL_HASH_HEX" \
  --root "$ROOT_HEX" > evidence/claim_failure.log 2>&1
CLAIM_STATUS=$?
set -e
CLAIM_TX=$(grep "Signing transaction:" evidence/claim_failure.log | awk '{print $NF}' | tail -n 1 || true)
REPLAY_ERROR_CODE=""
REPLAY_ERROR_NAME=""

if [[ "$CLAIM_STATUS" -ne 0 ]]; then
  if grep -q "Error(Contract, #9)" evidence/claim_failure.log; then
    echo "Claim submission failed. Detected Error(Contract, #9) which is VkParseError (BLOCKED_VK_PARSE_ERROR)."
  else
    echo "Claim submission failed. See evidence/claim_failure.log for details."
  fi
  cat evidence/claim_failure.log
  CLAIM_DIAGNOSTICS=$(cat evidence/claim_failure.log | grep -i "error" | head -n 5 || echo "See claim_failure.log")
  REPLAY_STATUS=-1
  REPLAY_REJECTED="false"
  REPLAY_ATTEMPTED="false"
else
  echo "Claim succeeded on-chain."
  CLAIM_DIAGNOSTICS=""
  echo "Attempting replay attack..."
  set +e
  stellar contract invoke \
    --network "$STELLAR_NETWORK" \
    --source "$STELLAR_SOURCE" \
    --id "$APPGATE_ID" \
    -- claim \
    --scope "$SCOPE_HEX" \
    --proof_blob-file-path artifacts/fixture/proof/proof \
    --nullifier "$NULLIFIER_HEX" \
    --signal_hash "$SIGNAL_HASH_HEX" \
    --root "$ROOT_HEX" > evidence/replay.log 2>&1
  REPLAY_STATUS=$?
  set -e

  REPLAY_ATTEMPTED="true"
  if [[ "$REPLAY_STATUS" -ne 0 ]]; then
    if grep -q "Error(Contract, #4)" evidence/replay.log; then
      echo "Replay correctly rejected with AlreadyClaimed."
      REPLAY_REJECTED="true"
      REPLAY_ERROR_CODE=4
      REPLAY_ERROR_NAME="AlreadyClaimed"
    else
      echo "Replay failed for an unexpected reason."
      REPLAY_REJECTED="false"
    fi
  else
    echo "Replay unexpectedly succeeded."
    REPLAY_REJECTED="false"
  fi
fi

# Verification checks
echo "Verifying Registry Root..."
READ_ROOT=$(invoke_read "$REGISTRY_ID" get_root)
echo "Read Root: $READ_ROOT"

echo "Verifying Scope Open..."
HAS_SCOPE=$(invoke_read "$APPGATE_ID" get_scope --scope "$SCOPE_HEX")
echo "Scope Config: $HAS_SCOPE"

echo "Verifying Claim Status..."
HAS_CLAIMED=$(invoke_read "$APPGATE_ID" has_claimed --scope "$SCOPE_HEX" --nullifier "$NULLIFIER_HEX")
echo "Has Claimed: $HAS_CLAIMED"

if [[ "$CLAIM_STATUS" -ne 0 ]]; then
  if echo "$CLAIM_DIAGNOSTICS" | grep -q "Error(Contract, #9)"; then
    FINAL_STATUS="BLOCKED_VK_PARSE_ERROR"
  else
    FINAL_STATUS="BLOCKED_UNKNOWN"
  fi
else
  FINAL_STATUS="SUCCESS"
fi

VK_BYTES_LEN=$(stat -c%s artifacts/fixture/vk/vk 2>/dev/null || stat -f%z artifacts/fixture/vk/vk)
VK_SHA256=$(sha256sum artifacts/fixture/vk/vk | awk '{print $1}')
PROOF_SHA256=$(sha256sum artifacts/fixture/proof/proof | awk '{print $1}')
PI_SHA256=$(sha256sum artifacts/fixture/proof/public_inputs | awk '{print $1}')
CLAIM_ERROR_CODE=""
CLAIM_ERROR_NAME=""
if [[ "$FINAL_STATUS" == "BLOCKED_VK_PARSE_ERROR" ]]; then
  CLAIM_ERROR_CODE=9
  CLAIM_ERROR_NAME="VkParseError"
fi

"$JQ_BIN" -n \
  --arg status "$FINAL_STATUS" \
  --arg network "$STELLAR_NETWORK" \
  --arg deployer "$ADMIN_ADDRESS" \
  --arg registryId "$REGISTRY_ID" \
  --arg appGateId "$APPGATE_ID" \
  --arg registryAddTx "$REGISTRY_ADD_TX" \
  --arg registryRootTx "$REGISTRY_ROOT_TX" \
  --arg appGateScopeTx "$APPGATE_SCOPE_TX" \
  --arg claimTx "$CLAIM_TX" \
  --arg commitmentHex "$COMMITMENT_HEX" \
  --arg merkleRootHex "$ROOT_HEX" \
  --arg scopeHex "$SCOPE_HEX" \
  --arg scopeDomainHex "$SCOPE_DOMAIN_HEX" \
  --arg nullifierHex "$NULLIFIER_HEX" \
  --arg signalHashHex "$SIGNAL_HASH_HEX" \
  --argjson claimStatus "$CLAIM_STATUS" \
  --arg claimDiagnostics "$CLAIM_DIAGNOSTICS" \
  --argjson replayAttempted "$REPLAY_ATTEMPTED" \
  --argjson replayRejected "$REPLAY_REJECTED" \
  --argjson replayErrorCode "${REPLAY_ERROR_CODE:-null}" \
  --arg replayErrorName "$REPLAY_ERROR_NAME" \
  --arg root "$READ_ROOT" \
  --arg hasScope "$HAS_SCOPE" \
  --arg hasClaimed "$HAS_CLAIMED" \
  --argjson vkBytes "$VK_BYTES_LEN" \
  --argjson expectedVerifierVkBytes 1760 \
  --arg vkSha256 "$VK_SHA256" \
  --arg proofSha256 "$PROOF_SHA256" \
  --arg publicInputsSha256 "$PI_SHA256" \
  --argjson claimErrorCode "${CLAIM_ERROR_CODE:-null}" \
  --arg claimErrorName "$CLAIM_ERROR_NAME" \
  '{
    status: $status,
    network: $network,
    deployer: $deployer,
    registryId: $registryId,
    appGateId: $appGateId,
    registryAddTx: $registryAddTx,
    registryRootTx: $registryRootTx,
    appGateScopeTx: $appGateScopeTx,
    claimTx: $claimTx,
    commitmentHex: $commitmentHex,
    merkleRootHex: $merkleRootHex,
    scopeHex: $scopeHex,
    scopeDomainHex: $scopeDomainHex,
    nullifierHex: $nullifierHex,
    signalHashHex: $signalHashHex,
    claimStatus: $claimStatus,
    claimDiagnostics: $claimDiagnostics,
    replayAttempted: $replayAttempted,
    replayRejected: $replayRejected,
    replayErrorCode: $replayErrorCode,
    replayErrorName: $replayErrorName,
    vkBytes: $vkBytes,
    expectedVerifierVkBytes: $expectedVerifierVkBytes,
    vkSha256: $vkSha256,
    proofSha256: $proofSha256,
    publicInputsSha256: $publicInputsSha256,
    claimErrorCode: $claimErrorCode,
    claimErrorName: $claimErrorName,
    readBack: {
      root: $root,
      hasScope: $hasScope,
      hasClaimed: $hasClaimed
    }
  }' > evidence/testnet-latest.json

cp evidence/testnet-latest.json web/src/evidence.json
echo "Evidence written to evidence/testnet-latest.json"
