import { describe, expect, it } from "vitest";
import {
  initialWorkflowState,
  workflowReducer,
} from "./workflow.js";

function reduce(actions) {
  return actions.reduce(workflowReducer, initialWorkflowState);
}

describe("interactive zkSybil claim workflow", () => {
  it("advances from wallet connection through registration, proof, and claim result", () => {
    const state = reduce([
      { type: "wallet.connected", address: "GABC", network: "TESTNET" },
      { type: "identity.created", commitment: "0xcommitment" },
      { type: "identity.registered", tx: "register-tx" },
      {
        type: "scope.opened",
        scopeDomain: "0xscope",
        signalHash: "0xsignal",
        tx: "scope-tx",
      },
      { type: "proof.generated", proofId: "proof-1", nullifier: "0xnullifier" },
      {
        type: "claim.submitted",
        tx: "claim-tx",
        hasClaimed: true,
        replayRejected: true,
      },
    ]);

    expect(state.step).toBe("results");
    expect(state.wallet.address).toBe("GABC");
    expect(state.identity.registered).toBe(true);
    expect(state.scope).toEqual({
      domain: "0xscope",
      signalHash: "0xsignal",
      tx: "scope-tx",
    });
    expect(state.proof.status).toBe("verified");
    expect(state.result).toEqual({
      tx: "claim-tx",
      hasClaimed: true,
      replayRejected: true,
    });
  });

  it("does not generate a proof before registration and claim scope creation", () => {
    expect(() =>
      workflowReducer(initialWorkflowState, {
        type: "proof.generated",
        proofId: "proof-1",
        nullifier: "0xnullifier",
      }),
    ).toThrow(/register.*scope/i);
  });

  it("surfaces proof and transaction failures without advancing", () => {
    const ready = reduce([
      { type: "wallet.connected", address: "GABC", network: "TESTNET" },
      { type: "identity.created", commitment: "0xcommitment" },
      { type: "identity.registered", tx: "register-tx" },
      {
        type: "scope.opened",
        scopeDomain: "0xscope",
        signalHash: "0xsignal",
        tx: "scope-tx",
      },
    ]);
    const proofFailure = workflowReducer(ready, {
      type: "proof.failed",
      error: "witness rejected",
    });
    expect(proofFailure.step).toBe("scope");
    expect(proofFailure.error).toMatch(/witness rejected/);

    const proved = workflowReducer(ready, {
      type: "proof.generated",
      proofId: "proof-1",
      nullifier: "0xnullifier",
    });
    const txFailure = workflowReducer(proved, {
      type: "claim.failed",
      error: "AlreadyClaimed (#4)",
    });
    expect(txFailure.step).toBe("scope");
    expect(txFailure.error).toMatch(/AlreadyClaimed/);
  });
});
