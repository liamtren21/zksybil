import { BarretenbergSync, Fr } from "@aztec/bb.js";
import { assertCanonicalField } from "./encoding.js";

export type MerkleTree = {
  depth: number;
  leafCount: number;
  leaves: bigint[];
  levels: bigint[][];
  zeroHashes: bigint[];
  root: bigint;
};

export type MerkleProof = {
  root: bigint;
  path: bigint[];
  indices: number[];
};

let api: BarretenbergSync | undefined;

export async function initPoseidon(): Promise<void> {
  api ??= await BarretenbergSync.initSingleton();
}

export async function closePoseidon(): Promise<void> {
  // BarretenbergSync is a process-wide singleton and has no destroy method.
}

function getApi(): BarretenbergSync {
  if (!api) {
    throw new Error("Poseidon2 is not initialized; call initPoseidon first");
  }
  return api;
}

function frToBigInt(value: Fr): bigint {
  return BigInt(value.toString());
}

export function poseidon2Hash(inputs: readonly bigint[]): bigint {
  if (inputs.length === 0) {
    throw new RangeError("Poseidon2 requires at least one input");
  }
  return frToBigInt(
    getApi().poseidon2Hash(inputs.map((value) => new Fr(assertCanonicalField(value)))),
  );
}

export function identityCommitment(
  identitySecret: bigint,
  identityTrapdoor: bigint,
): bigint {
  return poseidon2Hash([identitySecret, identityTrapdoor]);
}

export function buildTree(
  leaves: readonly bigint[],
  depth: number,
): MerkleTree {
  if (!Number.isInteger(depth) || depth < 1 || depth > 30) {
    throw new RangeError("depth must be an integer between 1 and 30");
  }
  if (leaves.length > 2 ** depth) {
    throw new RangeError("too many leaves for Merkle tree depth");
  }

  const canonicalLeaves = leaves.map(assertCanonicalField);
  if (new Set(canonicalLeaves).size !== canonicalLeaves.length) {
    throw new Error("duplicate commitment");
  }

  const zeroHashes = [0n];
  for (let level = 0; level < depth; level += 1) {
    zeroHashes.push(
      poseidon2Hash([zeroHashes[level], zeroHashes[level]]),
    );
  }

  const levels: bigint[][] = [canonicalLeaves.slice()];
  for (let level = 0; level < depth; level += 1) {
    const current = levels[level];
    const next: bigint[] = [];
    for (let index = 0; index < current.length; index += 2) {
      next.push(
        poseidon2Hash([
          current[index],
          current[index + 1] ?? zeroHashes[level],
        ]),
      );
    }
    levels.push(next);
  }

  return {
    depth,
    leafCount: canonicalLeaves.length,
    leaves: canonicalLeaves,
    levels,
    zeroHashes,
    root: levels[depth][0] ?? zeroHashes[depth],
  };
}

export function appendLeaf(tree: MerkleTree, leaf: bigint): MerkleTree {
  return buildTree([...tree.leaves, leaf], tree.depth);
}

export function merkleProof(tree: MerkleTree, index: number): MerkleProof {
  if (!Number.isInteger(index) || index < 0 || index >= tree.leafCount) {
    throw new RangeError("Merkle proof index is outside registered leaves");
  }

  const path: bigint[] = [];
  const indices: number[] = [];
  let cursor = index;
  for (let level = 0; level < tree.depth; level += 1) {
    const isRight = cursor & 1;
    const sibling = isRight ? cursor - 1 : cursor + 1;
    path.push(tree.levels[level][sibling] ?? tree.zeroHashes[level]);
    indices.push(isRight);
    cursor = Math.floor(cursor / 2);
  }
  return { root: tree.root, path, indices };
}

export function verifyPath(
  leaf: bigint,
  path: readonly bigint[],
  indices: readonly number[],
  expectedRoot: bigint,
): boolean {
  if (path.length !== indices.length) {
    throw new RangeError("path and indices lengths differ");
  }
  let current = assertCanonicalField(leaf);
  for (let level = 0; level < path.length; level += 1) {
    if (indices[level] !== 0 && indices[level] !== 1) {
      throw new RangeError("path index must be 0 or 1");
    }
    current =
      indices[level] === 0
        ? poseidon2Hash([current, path[level]])
        : poseidon2Hash([path[level], current]);
  }
  return current === expectedRoot;
}

