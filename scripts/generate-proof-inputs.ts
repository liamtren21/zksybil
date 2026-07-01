import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fieldHexToBigInt, fieldToBytes, u64ToField } from "./encoding.js";
import {
  buildTree,
  identityCommitment,
  initPoseidon,
  merkleProof,
  poseidon2Hash,
  verifyPath,
} from "./merkle.js";

const TREE_DEPTH = Number(process.env.TREE_DEPTH ?? "20");

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const circuitDir = join(rootDir, "circuits", "sybil");
const fixtureDirInput = process.env.FIXTURE_DIR ?? "artifacts/fixture";
const outDir = isAbsolute(fixtureDirInput)
  ? fixtureDirInput
  : join(rootDir, fixtureDirInput);

function field(value: bigint): string {
  return `"${value.toString()}"`;
}

function fieldArray(values: readonly bigint[]): string {
  return `[${values.map(field).join(", ")}]`;
}

function u1Array(values: readonly number[]): string {
  return `[${values.join(", ")}]`;
}

function concatBytes(fields: readonly bigint[]): Uint8Array {
  const out = new Uint8Array(fields.length * 32);
  fields.forEach((value, index) => out.set(fieldToBytes(value), index * 32));
  return out;
}

function fieldHex(value: bigint): string {
  return Buffer.from(fieldToBytes(value)).toString("hex");
}

await initPoseidon();

function parseBigIntList(name: string, fallback: readonly bigint[]): bigint[] {
  const raw = process.env[name];
  if (!raw) return [...fallback];
  return raw.split(",").map((value) => BigInt(value.trim()));
}

const identitySecrets = parseBigIntList("IDENTITY_SECRETS", [111n]);
const identityTrapdoors = parseBigIntList("IDENTITY_TRAPDOORS", [222n]);
if (identitySecrets.length !== identityTrapdoors.length) {
  throw new Error("IDENTITY_SECRETS and IDENTITY_TRAPDOORS must have the same length");
}

const proverIndex = Number(process.env.PROVER_INDEX ?? "0");
if (!Number.isInteger(proverIndex) || proverIndex < 0 || proverIndex >= identitySecrets.length) {
  throw new Error("PROVER_INDEX is outside the identity list");
}

const identitySecret = identitySecrets[proverIndex];
const identityTrapdoor = identityTrapdoors[proverIndex];

const networkDomain = BigInt("1");
const appGateDomain = BigInt("2");
const scope = BigInt("3003");
const signalAction = BigInt("12345");
const signalHash = poseidon2Hash([signalAction]);

const commitments = identitySecrets.map((secret, index) =>
  identityCommitment(secret, identityTrapdoors[index]),
);
const commitment = commitments[proverIndex];
const tree = buildTree(commitments, TREE_DEPTH);
const proof = merkleProof(tree, proverIndex);

if (!verifyPath(commitment, proof.path, proof.indices, proof.root)) {
  throw new Error("generated Merkle proof is invalid");
}

const scopeDomain = poseidon2Hash([
  networkDomain,
  appGateDomain,
  scope,
]);
const nullifier = poseidon2Hash([identitySecret, scopeDomain]);
const publicInputs = [proof.root, scopeDomain, nullifier, signalHash];

mkdirSync(circuitDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

writeFileSync(
  join(circuitDir, "Prover.toml"),
  [
    `identity_secret = ${field(identitySecret)}`,
    `identity_trapdoor = ${field(identityTrapdoor)}`,
    `merkle_path = ${fieldArray(proof.path)}`,
    `path_indices = ${u1Array(proof.indices)}`,
    `merkle_root = ${field(proof.root)}`,
    `scope_domain = ${field(scopeDomain)}`,
    `nullifier = ${field(nullifier)}`,
    `signal_hash = ${field(signalHash)}`,
    `signal_action = ${field(signalAction)}`,
    "",
  ].join("\n"),
);

writeFileSync(join(outDir, "expected_public_inputs"), concatBytes(publicInputs));
writeFileSync(
  join(outDir, "metadata.json"),
  JSON.stringify(
    {
      treeDepth: TREE_DEPTH,
      proverIndex,
      identityCount: identitySecrets.length,
      identitySecret: identitySecret.toString(),
      identityTrapdoor: identityTrapdoor.toString(),
      commitment: commitment.toString(),
      commitmentHex: fieldHex(commitment),
      commitments: commitments.map((value) => value.toString()),
      commitmentsHex: commitments.map(fieldHex),
      merkleRoot: proof.root.toString(),
      merkleRootHex: fieldHex(proof.root),
      networkDomain: networkDomain.toString(),
      appGateDomain: appGateDomain.toString(),
      scope: scope.toString(),
      scopeHex: fieldHex(scope),
      scopeDomain: scopeDomain.toString(),
      scopeDomainHex: fieldHex(scopeDomain),
      nullifier: nullifier.toString(),
      nullifierHex: fieldHex(nullifier),
      signalAction: signalAction.toString(),
      signalHash: signalHash.toString(),
      signalHashHex: fieldHex(signalHash),
      publicInputs: publicInputs.map((value) => value.toString()),
      publicInputsHex: publicInputs.map(fieldHex),
    },
    null,
    2,
  ),
);
console.log(`Wrote ${join(circuitDir, "Prover.toml")}`);
console.log(`Wrote ${join(outDir, "metadata.json")}`);
