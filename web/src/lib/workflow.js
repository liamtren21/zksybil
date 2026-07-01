export const initialWorkflowState = {
  step: "connect",
  wallet: null,
  identity: null,
  scope: null,
  proof: { status: "idle" },
  result: null,
  error: null,
};

export function workflowReducer(state, action) {
  switch (action.type) {
    case "reset":
      return initialWorkflowState;
    case "wallet.connected":
      return {
        ...state,
        step: "register",
        wallet: { address: action.address, network: action.network },
        error: null,
      };
    case "identity.created":
      if (!state.wallet) throw new Error("Connect a wallet first");
      return {
        ...state,
        identity: { commitment: action.commitment, registered: false },
        error: null,
      };
    case "identity.registered":
      if (!state.identity) throw new Error("Create an identity first");
      return {
        ...state,
        step: "scope",
        identity: { ...state.identity, registered: true, tx: action.tx },
        error: null,
      };
    case "scope.opened":
      if (!state.identity?.registered) throw new Error("Register an identity first");
      if (!action.scopeDomain || !action.signalHash) {
        throw new Error("Scope domain and signal hash are required");
      }
      return {
        ...state,
        scope: {
          domain: action.scopeDomain,
          signalHash: action.signalHash,
          tx: action.tx,
        },
        proof: { status: "idle" },
        error: null,
      };
    case "proof.generating":
      return { ...state, proof: { status: "generating" }, error: null };
    case "proof.generated":
      if (!state.identity?.registered || !state.scope) {
        throw new Error("Register an identity and open a claim scope first");
      }
      return {
        ...state,
        proof: {
          status: "verified",
          proofId: action.proofId,
          nullifier: action.nullifier,
        },
        error: null,
      };
    case "proof.failed":
      return {
        ...state,
        proof: { status: "failed" },
        error: action.error,
      };
    case "claim.submitted":
      if (state.proof.status !== "verified") throw new Error("Generate a proof first");
      return {
        ...state,
        step: "results",
        result: {
          tx: action.tx,
          hasClaimed: action.hasClaimed,
          replayRejected: action.replayRejected,
        },
        error: null,
      };
    case "claim.failed":
      return { ...state, error: action.error };
    default:
      return state;
  }
}
