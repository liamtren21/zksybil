import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  appendLeaf,
  buildTree,
  closePoseidon,
  identityCommitment,
  initPoseidon,
  merkleProof,
  verifyPath,
} from "./merkle.js";

describe("Poseidon2 Merkle tree", () => {
  beforeAll(initPoseidon);
  afterAll(closePoseidon);

  it("builds deterministic roots and verifies first, middle, and last proofs", () => {
    const leaves = [1n, 2n, 3n].map((secret) =>
      identityCommitment(secret, 0n),
    );
    const first = buildTree(leaves, 20);
    const second = buildTree(leaves, 20);

    expect(first.root).toBe(second.root);
    for (const index of [0, 1, 2]) {
      const proof = merkleProof(first, index);
      expect(
        verifyPath(leaves[index], proof.path, proof.indices, proof.root),
      ).toBe(true);
    }
  });

  it("changes the root when a leaf is appended", () => {
    const first = buildTree([identityCommitment(1n, 2n)], 20);
    const next = appendLeaf(first, identityCommitment(3n, 4n));
    expect(next.root).not.toBe(first.root);
    expect(next.leafCount).toBe(2);
  });

  it("rejects duplicate commitments", () => {
    const leaf = identityCommitment(1n, 2n);
    expect(() => buildTree([leaf, leaf], 20)).toThrow(/duplicate/i);
  });

  it("rejects proof indices outside the registered leaves", () => {
    const tree = buildTree([identityCommitment(1n, 2n)], 20);
    expect(() => merkleProof(tree, 1)).toThrow(/index/i);
  });
});

