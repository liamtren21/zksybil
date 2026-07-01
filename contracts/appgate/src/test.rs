#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Bytes, BytesN, Env};

#[test]
fn test_claim_success() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(AppGate, ());
    let client = AppGateClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let network_domain = BytesN::from_array(&env, &[1; 32]);
    let app_gate_domain = BytesN::from_array(&env, &[2; 32]);
    let registry_id = Address::generate(&env);
    let vk_bytes = Bytes::new(&env);
    
    client.init(&admin, &network_domain, &app_gate_domain, &registry_id, &vk_bytes);

    let scope = BytesN::from_array(&env, &[3; 32]);
    let root = BytesN::from_array(&env, &[4; 32]);
    let scope_domain = BytesN::from_array(&env, &[7; 32]);
    let signal = BytesN::from_array(&env, &[5; 32]);

    client.open_scope(&scope, &root, &scope_domain, &signal, &100);

    let nullifier = BytesN::from_array(&env, &[6; 32]);
    let proof = Bytes::from_array(&env, &[1, 2, 3]);

    client.claim(&scope, &proof, &nullifier, &signal, &root);
}

#[test]
#[should_panic(expected = "Error(Contract, #3)")]
fn test_claim_stale_root() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AppGate, ());
    let client = AppGateClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin, &BytesN::from_array(&env, &[1; 32]), &BytesN::from_array(&env, &[2; 32]), &Address::generate(&env), &Bytes::new(&env));

    let scope = BytesN::from_array(&env, &[3; 32]);
    let root = BytesN::from_array(&env, &[4; 32]);
    let scope_domain = BytesN::from_array(&env, &[7; 32]);
    let signal = BytesN::from_array(&env, &[5; 32]);

    client.open_scope(&scope, &root, &scope_domain, &signal, &100);

    let nullifier = BytesN::from_array(&env, &[6; 32]);
    let proof = Bytes::from_array(&env, &[1, 2, 3]);
    let wrong_root = BytesN::from_array(&env, &[9; 32]);

    client.claim(&scope, &proof, &nullifier, &signal, &wrong_root);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_double_claim_fails() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AppGate, ());
    let client = AppGateClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin, &BytesN::from_array(&env, &[1; 32]), &BytesN::from_array(&env, &[2; 32]), &Address::generate(&env), &Bytes::new(&env));

    let scope = BytesN::from_array(&env, &[3; 32]);
    let root = BytesN::from_array(&env, &[4; 32]);
    let scope_domain = BytesN::from_array(&env, &[7; 32]);
    let signal = BytesN::from_array(&env, &[5; 32]);

    client.open_scope(&scope, &root, &scope_domain, &signal, &100);

    let nullifier = BytesN::from_array(&env, &[6; 32]);
    let proof = Bytes::from_array(&env, &[1, 2, 3]);

    client.claim(&scope, &proof, &nullifier, &signal, &root);
    // double claim
    client.claim(&scope, &proof, &nullifier, &signal, &root);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_wrong_signal() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AppGate, ());
    let client = AppGateClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin, &BytesN::from_array(&env, &[1; 32]), &BytesN::from_array(&env, &[2; 32]), &Address::generate(&env), &Bytes::new(&env));

    let scope = BytesN::from_array(&env, &[3; 32]);
    let root = BytesN::from_array(&env, &[4; 32]);
    let scope_domain = BytesN::from_array(&env, &[7; 32]);
    let signal = BytesN::from_array(&env, &[5; 32]);
    let wrong_signal = BytesN::from_array(&env, &[9; 32]);

    client.open_scope(&scope, &root, &scope_domain, &signal, &100);

    let nullifier = BytesN::from_array(&env, &[6; 32]);
    let proof = Bytes::from_array(&env, &[1, 2, 3]);

    client.claim(&scope, &proof, &nullifier, &wrong_signal, &root);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_unopened_scope() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(AppGate, ());
    let client = AppGateClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.init(&admin, &BytesN::from_array(&env, &[1; 32]), &BytesN::from_array(&env, &[2; 32]), &Address::generate(&env), &Bytes::new(&env));

    let scope = BytesN::from_array(&env, &[3; 32]);
    let root = BytesN::from_array(&env, &[4; 32]);
    let signal = BytesN::from_array(&env, &[5; 32]);

    let nullifier = BytesN::from_array(&env, &[6; 32]);
    let proof = Bytes::from_array(&env, &[1, 2, 3]);

    client.claim(&scope, &proof, &nullifier, &signal, &root);
}

#[test]
#[should_panic(expected = "Error(Auth, InvalidAction)")]
fn test_admin_only_open_scope() {
    let env = Env::default();
    let contract_id = env.register(AppGate, ());
    let client = AppGateClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    
    // We don't use mock_all_auths here to ensure that `open_scope` enforces authorization
    
    env.mock_all_auths(); // temporarily mock to init
    client.init(&admin, &BytesN::from_array(&env, &[1; 32]), &BytesN::from_array(&env, &[2; 32]), &Address::generate(&env), &Bytes::new(&env));
    
    // reset auths
    env.mock_auths(&[]); // This clears the mock, so subsequent calls will enforce actual auth
    
    let scope = BytesN::from_array(&env, &[3; 32]);
    let root = BytesN::from_array(&env, &[4; 32]);
    let scope_domain = BytesN::from_array(&env, &[7; 32]);
    let signal = BytesN::from_array(&env, &[5; 32]);

    // This should panic because `open_scope` calls `admin.require_auth()`
    client.open_scope(&scope, &root, &scope_domain, &signal, &100);
}
