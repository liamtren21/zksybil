import { describe, expect, it } from "vitest";
import { assertNetwork, submitVote } from "./stellar.js";

describe("stellar client helpers", () => {
  it("rejects wallet/network mismatch", () => {
    expect(() => assertNetwork("local", "testnet")).toThrow(/network mismatch/i);
  });

  it("surfaces transaction failure", async () => {
    await expect(
      submitVote({ castVote: async () => ({ ok: false, error: "budget exceeded" }) }, {}),
    ).rejects.toThrow(/budget exceeded/i);
  });
});
