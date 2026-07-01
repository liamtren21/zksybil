global TREE_DEPTH: u32 = 20;

use dep::poseidon::poseidon2::Poseidon2;

fn hash1(a: Field) -> Field {
    Poseidon2::hash([a], 1)
}

fn hash2(left: Field, right: Field) -> Field {
    Poseidon2::hash([left, right], 2)
}

fn hash3(a: Field, b: Field, c: Field) -> Field {
    Poseidon2::hash([a, b, c], 3)
}

fn compute_root(
    leaf: Field,
    merkle_path: [Field; TREE_DEPTH],
    path_indices: [u1; TREE_DEPTH],
) -> Field {
    let mut current = leaf;
    for level in 0..TREE_DEPTH {
        if path_indices[level] == 0 {
            current = hash2(current, merkle_path[level]);
        } else {
            current = hash2(merkle_path[level], current);
        }
    }
    current
}

fn sybil(
    identity_secret: Field,
    identity_trapdoor: Field,
    merkle_path: [Field; TREE_DEPTH],
    path_indices: [u1; TREE_DEPTH],
    merkle_root: Field,
    scope_domain: Field,
    nullifier: Field,
    signal_hash: Field,
    signal_action: Field,
) {
    let commitment = hash2(identity_secret, identity_trapdoor);
    assert(compute_root(commitment, merkle_path, path_indices) == merkle_root);

    let expected_n = hash2(identity_secret, scope_domain);
    assert(nullifier == expected_n);
    
    // Bind signal_hash to the specific action (and recipient if encoded together)
    // The user passes signal_action privately, we hash it and assert it matches the public signal_hash
    let expected_signal_hash = hash1(signal_action);
    assert(signal_hash == expected_signal_hash);
}

fn fixture() -> (Field, Field, [Field; TREE_DEPTH], [u1; TREE_DEPTH], Field, Field, Field, Field, Field, Field) {
    let secret = 111;
    let trapdoor = 222;
    let path = [0; TREE_DEPTH];
    let indices = [0 as u1; TREE_DEPTH];
    let commitment = hash2(secret, trapdoor);
    let root = compute_root(commitment, path, indices);
    
    let signal_action = 12345;
    let signal_hash = hash1(signal_action);
    let scope_domain = hash3(1001, 2002, 3003);
    (secret, trapdoor, path, indices, root, scope_domain, 0, 0, signal_action, signal_hash)
}

fn expected_scope_domain(network: Field, app_gate: Field, scope: Field) -> Field {
    hash3(network, app_gate, scope)
}

fn expected_nullifier(secret: Field, scope_domain: Field) -> Field {
    hash2(secret, scope_domain)
}

#[test]
fn accepts_valid_claim() {
    let (secret, trapdoor, path, indices, root, scope_domain, _, _, signal_action, signal_hash) = fixture();
    let nullifier = expected_nullifier(secret, scope_domain);
    sybil(secret, trapdoor, path, indices, root, scope_domain, nullifier, signal_hash, signal_action);
}

#[test(should_fail)]
fn rejects_wrong_root() {
    let (secret, trapdoor, path, indices, root, scope_domain, _, _, signal_action, signal_hash) = fixture();
    let nullifier = expected_nullifier(secret, scope_domain);
    sybil(secret, trapdoor, path, indices, root + 1, scope_domain, nullifier, signal_hash, signal_action);
}

#[test(should_fail)]
fn rejects_wrong_nullifier() {
    let (secret, trapdoor, path, indices, root, scope_domain, _, _, signal_action, signal_hash) = fixture();
    let nullifier = expected_nullifier(secret, scope_domain);
    sybil(secret, trapdoor, path, indices, root, scope_domain, nullifier + 1, signal_hash, signal_action);
}

#[test(should_fail)]
fn rejects_wrong_scope() {
    let (secret, trapdoor, path, indices, root, scope_domain, _, _, signal_action, signal_hash) = fixture();
    let nullifier = expected_nullifier(secret, scope_domain);
    sybil(secret, trapdoor, path, indices, root, scope_domain + 1, nullifier, signal_hash, signal_action);
}

#[test]
fn test_scoped_nullifier_unlinkable() {
    let (secret, _, _, _, _, _, _, _, _, _) = fixture();
    let network = 1001;
    let app_gate = 2002;
    let scope_a = 3003;
    let scope_b = scope_a + 1;
    let nullifier_a = expected_nullifier(secret, expected_scope_domain(network, app_gate, scope_a));
    let nullifier_b = expected_nullifier(secret, expected_scope_domain(network, app_gate, scope_b));
    assert(nullifier_a != nullifier_b);
}

#[test(should_fail)]
fn rejects_wrong_signal() {
    let (secret, trapdoor, path, indices, root, scope_domain, _, _, signal_action, signal_hash) = fixture();
    let nullifier = expected_nullifier(secret, scope_domain);
    
    // Mutated signal_hash fails through the circuit entry point directly!
    let wrong_signal_hash = signal_hash + 1;
    sybil(secret, trapdoor, path, indices, root, scope_domain, nullifier, wrong_signal_hash, signal_action);
}

fn main(
    identity_secret: Field,
    identity_trapdoor: Field,
    merkle_path: [Field; TREE_DEPTH],
    path_indices: [u1; TREE_DEPTH],
    merkle_root: pub Field,
    scope_domain: pub Field,
    nullifier: pub Field,
    signal_hash: pub Field,
    signal_action: Field,
) {
    sybil(
        identity_secret,
        identity_trapdoor,
        merkle_path,
        path_indices,
        merkle_root,
        scope_domain,
        nullifier,
        signal_hash,
        signal_action,
    );
}
