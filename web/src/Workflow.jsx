import { useState } from "react";

const steps = ["Connect", "Identity", "Prove", "Claim"];

function short(value, head = 12, tail = 8) {
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function StepBody({ step, evidence, explorer, setStep }) {
  if (step === 0) {
    return (
      <>
        <span className="step-number">01</span>
        <h2>Load verified deployment</h2>
        <p>Start from the Registry and AppGate addresses recorded in the successful testnet run.</p>
        <div className="data-row"><span>AppGate</span><code>{short(evidence.appGateId)}</code></div>
        <button className="button primary" onClick={() => setStep(1)}>Load testnet session</button>
      </>
    );
  }

  if (step === 1) {
    return (
      <>
        <span className="step-number">02</span>
        <h2>Keep the witness private</h2>
        <p>The identity secret, trapdoor, and Merkle path stay local. Only the root is public.</p>
        <div className="data-row"><span>Merkle root</span><code>{short(evidence.merkleRootHex)}</code></div>
        <button className="button primary" onClick={() => setStep(2)}>Continue with private witness</button>
      </>
    );
  }

  if (step === 2) {
    return (
      <>
        <span className="step-number">03</span>
        <h2>Verify the UltraHonk proof</h2>
        <p>The proof binds membership, scope domain, scoped nullifier, and claim signal.</p>
        <div className="data-row"><span>Proof SHA-256</span><code>{short(evidence.proofSha256)}</code></div>
        <button className="button primary" onClick={() => setStep(3)}>Load verified proof result</button>
      </>
    );
  }

  return (
    <>
      <span className="step-number">04</span>
      <h2>Claim accepted, replay rejected</h2>
      <p>The on-chain claim succeeded and the same scoped nullifier cannot be used again.</p>
      <div className="success-note">Claim transaction verified. hasClaimed = true.</div>
      <a className="button primary" href={`${explorer}/tx/${evidence.claimTx}`} target="_blank" rel="noreferrer">
        Open claim transaction
      </a>
      <button className="button secondary" onClick={() => setStep(0)}>Restart walkthrough</button>
    </>
  );
}

export default function Workflow({ evidence, explorer }) {
  const [step, setStep] = useState(0);

  return (
    <section id="claim" className="claim-workspace" aria-labelledby="workflow-title">
      <div className="workflow-panel">
        <header className="workflow-header">
          <div>
            <span className="eyebrow">Guided artifact</span>
            <h2 id="workflow-title">Replay the verified claim lifecycle</h2>
          </div>
          <span className="status-chip success">Testnet</span>
        </header>

        <ol className="step-list" aria-label="Claim workflow progress">
          {steps.map((label, index) => (
            <li className={index === step ? "current" : index < step ? "done" : ""} key={label}>
              <span>{index + 1}</span>
              {label}
            </li>
          ))}
        </ol>

        <div className="stage-card" key={step} aria-live="polite">
          <StepBody step={step} evidence={evidence} explorer={explorer} setStep={setStep} />
        </div>

        <p className="workflow-note">
          Controls replay public evidence only. They do not sign or send a transaction.
        </p>
      </div>

      <aside className="protocol-panel" aria-label="Protocol boundary">
        <span className="eyebrow">Protocol boundary</span>
        <div className="boundary-step">
          <strong>Private witness</strong>
          <span>Identity secret, trapdoor, Merkle path</span>
        </div>
        <div className="connector" aria-hidden="true" />
        <div className="boundary-step public">
          <strong>Public inputs</strong>
          <span>Root, scope domain, nullifier, signal hash</span>
        </div>
        <dl className="mini-facts">
          <div><dt>Proof</dt><dd>UltraHonk</dd></div>
          <div><dt>Verifier</dt><dd>Nethermind</dd></div>
          <div><dt>Tree depth</dt><dd>20</dd></div>
          <div><dt>Replay</dt><dd>Rejected</dd></div>
        </dl>
      </aside>
    </section>
  );
}
