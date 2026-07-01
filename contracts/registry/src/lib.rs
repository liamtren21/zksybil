#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env};

#[contract]
pub struct IdentityRegistry;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Root,
    Identity(BytesN<32>),
}

#[contractimpl]
impl IdentityRegistry {
    pub fn init(env: Env, admin: Address) {
        assert!(!env.storage().instance().has(&DataKey::Admin), "Already initialized");
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn update_root(env: Env, issuer: Address, new_root: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(issuer == admin, "Not authorized");
        issuer.require_auth();
        env.storage().instance().set(&DataKey::Root, &new_root);
    }

    pub fn get_root(env: Env) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&DataKey::Root)
            .unwrap_or_else(|| BytesN::from_array(&env, &[0u8; 32]))
    }

    pub fn add_identity(env: Env, issuer: Address, commitment: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        assert!(issuer == admin, "Not authorized");
        issuer.require_auth();
        
        env.storage().persistent().set(&DataKey::Identity(commitment.clone()), &true);
        // We do not compute the root on-chain to save compute, the issuer must call update_root separately.
    }
    
    pub fn has_identity(env: Env, commitment: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Identity(commitment))
    }
}

mod test;
