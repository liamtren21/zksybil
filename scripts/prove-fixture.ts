import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { UltraHonkBackend } from "@aztec/bb.js";

const rootDir = join(import.meta.dirname, "..");
const targetDir = join(rootDir, "circuits", "sybil", "target");
const fixtureDir = join(rootDir, "artifacts", "fixture");
const circuit = JSON.parse(readFileSync(join(targetDir, "sybil.json"), "utf8"));
const witness = readFileSync(join(targetDir, "sybil.gz"));

function fieldToBytes(value: string): Buffer {
  const hex = value.startsWith("0x") ? value.slice(2) : BigInt(value).toString(16);
  return Buffer.from(hex.padStart(64, "0"), "hex");
}

function normalizeVerifierKey(rawVk: Uint8Array): Buffer {
  const vk = Buffer.from(rawVk);
  if (vk.length === 1760) {
    return vk;
  }
  if (vk.length === 1764 && vk.readUInt32BE(32) === 4) {
    return Buffer.concat([vk.subarray(0, 32), vk.subarray(36)]);
  }
  throw new Error(
    `unexpected BB 0.87 VK layout: length=${vk.length}, offset32=${vk.subarray(32, 36).toString("hex")}`,
  );
}

const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });
try {
  const proofData = await backend.generateProof(witness, { keccak: true });
  if (!(await backend.verifyProof(proofData, { keccak: true }))) {
    throw new Error("bb.js rejected its generated Keccak UltraHonk proof");
  }

  const rawVk = await backend.getVerificationKey({ keccak: true });
  const vk = normalizeVerifierKey(rawVk);
  const publicInputs = Buffer.concat(proofData.publicInputs.map(fieldToBytes));

  if (vk.length !== 1760 || proofData.proof.length !== 14592 || publicInputs.length !== 128) {
    throw new Error(
      `unexpected verifier artifacts: vk=${vk.length}, proof=${proofData.proof.length}, publicInputs=${publicInputs.length}`,
    );
  }

  mkdirSync(join(fixtureDir, "vk"), { recursive: true });
  mkdirSync(join(fixtureDir, "proof"), { recursive: true });
  writeFileSync(join(fixtureDir, "vk", "vk"), vk);
  writeFileSync(join(fixtureDir, "vk", "vk.raw"), rawVk);
  writeFileSync(join(fixtureDir, "proof", "proof"), proofData.proof);
  writeFileSync(join(fixtureDir, "proof", "public_inputs"), publicInputs);
  writeFileSync(join(fixtureDir, "sybil.json"), JSON.stringify(circuit));

  console.log(
    `Generated and verified Keccak UltraHonk artifacts: vk=${vk.length}, proof=${proofData.proof.length}, publicInputs=${publicInputs.length}`,
  );
} finally {
  await backend.destroy();
}
