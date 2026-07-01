#!/usr/bin/env bash
set -e
export PATH="$PATH:/home/enzo95/.local/bin"
source ~/.cargo/env
stellar contract build --manifest-path contracts/registry/Cargo.toml
stellar contract build --manifest-path contracts/appgate/Cargo.toml
bash scripts/prove-fixture.sh
bash scripts/verify-public-input-mutations.sh
