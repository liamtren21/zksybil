import { describe, expect, it } from "vitest";
import { packPublicInputFields, proveClaim } from "./prover.js";

describe("prover helpers", () => {
  it("packs public inputs in the contract/circuit order", () => {
    expect(
      packPublicInputFields({
        merkle_root: "root",
        scope_domain: "scope",
        nullifier: "nullifier",
        signal_hash: "signal",
      }),
    ).toEqual(["root", "scope", "nullifier", "signal"]);
  });

  it("surfaces proof generation failure", async () => {
    await expect(proveClaim({ prove: async () => ({}) }, {})).rejects.toThrow(/proof/i);
  });
});
