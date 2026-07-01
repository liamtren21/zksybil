#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Bytes, BytesN, Env,
};

#[cfg(all(not(test), feature = "nethermind-verifier"))]
use ultrahonk_soroban_verifier::UltraHonkVerifier as NethermindUltraHonkVerifier;

#[cfg(all(feature = "static-vk", not(test)))]
const STATIC_VK: &[u8] = include_bytes!("../../../artifacts/fixture/vk/vk");

#[contract]
pub struct AppGate;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ScopeConfig {
    pub root: BytesN<32>,
    pub scope_domain: BytesN<32>,
    pub expected_signal: BytesN<32>,
    pub claim_amount: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
enum DataKey {
    Admin,
    NetworkDomain,
    AppGateDomain,
    RegistryId,
    VerifyingKey,
    Scope(BytesN<32>),
    Nullifier(BytesN<32>, BytesN<32>),
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    StaleRoot = 3,
    AlreadyClaimed = 4,
    SignalMismatch = 5,
    EmptyProof = 6,
    VerificationFailed = 7,
    ScopeNotFound = 8,
    VkParseError = 9,
}

#[contractimpl]
impl AppGate {
    pub fn init(
        env: Env,
        admin: Address,
        network_domain: BytesN<32>,
        app_gate_domain: BytesN<32>,
        registry_id: Address,
        vk_bytes: Bytes,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::NetworkDomain, &network_domain);
        env.storage()
            .instance()
            .set(&DataKey::AppGateDomain, &app_gate_domain);
        env.storage()
            .instance()
            .set(&DataKey::RegistryId, &registry_id);
        env.storage()
            .instance()
            .set(&DataKey::VerifyingKey, &vk_bytes);
    }

    pub fn open_scope(
        env: Env,
        scope: BytesN<32>,
        root: BytesN<32>,
        scope_domain: BytesN<32>,
        expected_signal: BytesN<32>,
        claim_amount: i128,
    ) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let cfg = ScopeConfig {
            root,
            scope_domain,
            expected_signal,
            claim_amount,
        };
        env.storage().persistent().set(&DataKey::Scope(scope), &cfg);
    }

    pub fn get_scope(env: Env, scope: BytesN<32>) -> Result<ScopeConfig, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Scope(scope))
            .ok_or(Error::ScopeNotFound)
    }

    pub fn has_claimed(env: Env, scope: BytesN<32>, nullifier: BytesN<32>) -> bool {
        let key = DataKey::Nullifier(scope, nullifier);
        env.storage().persistent().has(&key)
    }

    pub fn claim(
        env: Env,
        scope: BytesN<32>,
        proof_blob: Bytes,
        nullifier: BytesN<32>,
        signal_hash: BytesN<32>,
        root: BytesN<32>,
    ) -> Result<(), Error> {
        let cfg: ScopeConfig = env
            .storage()
            .persistent()
            .get(&DataKey::Scope(scope.clone()))
            .ok_or(Error::ScopeNotFound)?;

        if root != cfg.root {
            return Err(Error::StaleRoot);
        }

        let key = DataKey::Nullifier(scope.clone(), nullifier.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyClaimed);
        }

        if signal_hash != cfg.expected_signal {
            return Err(Error::SignalMismatch);
        }

        let public_inputs = Self::pack_public_inputs(
            &env,
            &root,
            &cfg.scope_domain,
            &nullifier,
            &signal_hash,
        )?;

        Self::verify_ultrahonk(&env, &public_inputs, &proof_blob)?;

        env.storage().persistent().set(&key, &true);

        // Self::distribute(&env, &scope);
        // E.g. mint token or transfer

        Ok(())
    }

    fn pack_public_inputs(
        env: &Env,
        root: &BytesN<32>,
        scope_domain: &BytesN<32>,
        nullifier: &BytesN<32>,
        signal_hash: &BytesN<32>,
    ) -> Result<Bytes, Error> {
        let mut out = Bytes::new(env);
        out.append(&Bytes::from(root.clone()));
        out.append(&Bytes::from(scope_domain.clone()));
        out.append(&Bytes::from(nullifier.clone()));
        out.append(&Bytes::from(signal_hash.clone()));
        Ok(out)
    }

    #[cfg(not(test))]
    fn verify_ultrahonk(env: &Env, public_inputs: &Bytes, proof: &Bytes) -> Result<(), Error> {
        #[cfg(feature = "static-vk")]
        let vk_bytes = Bytes::from_slice(env, STATIC_VK);

        #[cfg(not(feature = "static-vk"))]
        let vk_bytes: Bytes = env
            .storage()
            .instance()
            .get(&DataKey::VerifyingKey)
            .ok_or(Error::NotInitialized)?;
            
        #[cfg(feature = "nethermind-verifier")]
        {
            let verifier =
                NethermindUltraHonkVerifier::new(env, &vk_bytes).map_err(|_| Error::VkParseError)?;
            verifier
                .verify(env, proof, public_inputs)
                .map_err(|_| Error::VerificationFailed)?;
            return Ok(());
        }
    }

    #[cfg(test)]
    fn verify_ultrahonk(_env: &Env, _public_inputs: &Bytes, proof: &Bytes) -> Result<(), Error> {
        if proof.is_empty() {
            return Err(Error::EmptyProof);
        }
        if proof.get(0) == Some(0) {
            return Err(Error::VerificationFailed);
        }
        Ok(())
    }
}

mod test;
