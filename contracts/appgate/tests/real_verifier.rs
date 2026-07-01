use soroban_sdk::{Bytes, Env};
use ultrahonk_soroban_verifier::UltraHonkVerifier;

fn fixture(env: &Env) -> (UltraHonkVerifier, Bytes, [u8; 128]) {
    let vk = Bytes::from_slice(env, include_bytes!("../../../artifacts/fixture/vk/vk"));
    let proof = Bytes::from_slice(env, include_bytes!("../../../artifacts/fixture/proof/proof"));
    let public_inputs = *include_bytes!("../../../artifacts/fixture/proof/public_inputs");
    let verifier = UltraHonkVerifier::new(env, &vk).expect("vk parses");
    (verifier, proof, public_inputs)
}

#[test]
fn generated_fixture_verifies_with_dependency() {
    let env = Env::default();
    let (verifier, proof, public_inputs) = fixture(&env);
    verifier
        .verify(&env, &proof, &Bytes::from_slice(&env, &public_inputs))
        .expect("proof verifies");
}

#[test]
fn mutated_public_inputs_are_rejected() {
    for field_index in 0..4 {
        let env = Env::default();
        let (verifier, proof, mut public_inputs) = fixture(&env);
        public_inputs[field_index * 32 + 31] ^= 1;
        assert!(
            verifier
                .verify(&env, &proof, &Bytes::from_slice(&env, &public_inputs))
                .is_err(),
            "mutated public input {field_index} unexpectedly verified"
        );
    }
}
