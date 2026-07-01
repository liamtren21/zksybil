#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

#[test]
fn test_issuer_adds_identity() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register(IdentityRegistry, ());
    let client = IdentityRegistryClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    client.init(&admin);
    
    let commitment = BytesN::from_array(&env, &[7u8; 32]);
    client.add_identity(&admin, &commitment);
    
    assert!(client.has_identity(&commitment));
}

#[test]
fn test_update_root() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register(IdentityRegistry, ());
    let client = IdentityRegistryClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    client.init(&admin);
    
    let new_root = BytesN::from_array(&env, &[9u8; 32]);
    client.update_root(&admin, &new_root);
    
    let root = client.get_root();
    assert_eq!(root, new_root);
}
#[test]
#[should_panic(expected = "Not authorized")]
fn test_unauthorized_update() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register(IdentityRegistry, ());
    let client = IdentityRegistryClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    client.init(&admin);
    
    let fake_admin = Address::generate(&env);
    let new_root = BytesN::from_array(&env, &[9u8; 32]);
    client.update_root(&fake_admin, &new_root);
}
