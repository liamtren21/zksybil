import "./styles.css";
import { PUBLIC_INPUT_ORDER } from "./lib/prover.js";
import evidence from "./evidence.json";
import Workflow from "./Workflow.jsx";

const EXPLORER = "https://stellar.expert/explorer/testnet";

const lifecycle = [
  ["Register identity commitment", "successful", evidence.registryAddTx],
  ["Publish Merkle root", "successful", evidence.registryRootTx],
  ["Open airdrop scope", "successful", evidence.appGateScopeTx],
  ["Claim with UltraHonk proof", "successful", evidence.claimTx],
];

const proofFacts = [
  ["Circuit", "Noir Sybil membership"],
  ["Proof", "UltraHonk, Keccak transcript"],
  ["Verifier", "Nethermind Soroban"],
  ["VK bytes", `${evidence.vkBytes} / ${evidence.expectedVerifierVkBytes}`],
  ["Proof SHA-256", evidence.proofSha256],
  ["Public inputs SHA-256", evidence.publicInputsSha256],
];

const commands = [
  "npm test",
  "nargo test --program-dir circuits/sybil",
  "bash scripts/prove-fixture.sh",
  "bash scripts/verify-public-input-mutations.sh",
  "cargo test --manifest-path contracts/appgate/Cargo.toml",
  "bash scripts/testnet-e2e.sh",
];

function shortHash(hash, head = 12, tail = 10) {
  return `${hash.slice(0, head)}...${hash.slice(-tail)}`;
}

function TxLink({ tx }) {
  return (
    <a className="hash-link" href={`${EXPLORER}/tx/${tx}`} target="_blank" rel="noreferrer">
      {shortHash(tx)}
    </a>
  );
}

function CodeValue({ children }) {
  return <code className="code-value">{children}</code>;
}

function PanelTitle({ title, copy }) {
  return (
    <header className="panel-title">
      <h2>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </header>
  );
}

function StatusChip({ children, tone = "default" }) {
  return <span className={`status-chip ${tone}`}>{children}</span>;
}

export default function App() {
  return (
    <div className="app-shell">
      <aside className="workspace-rail" aria-label="zkSybil workspace">
        <a className="rail-logo" href="#claim" aria-label="zkSybil home">
          <img src="/logo-generated-wordmark.png" alt="zkSybil" />
        </a>
        <div className="rail-copy">
          <span>Evidence workspace</span>
        </div>
        <nav className="rail-nav" aria-label="Demo navigation">
          <a href="#claim">Claim</a>
          <a href="#evidence">Evidence</a>
          <a href="#proof">Proof</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <div className="rail-card">
          <span className="eyebrow">Testnet status</span>
          <strong>PASS</strong>
          <p>Claim accepted. Replay rejected.</p>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <span className="eyebrow">Stellar testnet artifact</span>
            <h1>Private one-person claim, verified on Stellar testnet.</h1>
          </div>
          <div className="topbar-actions">
            <StatusChip tone="success">Horizon verified</StatusChip>
            <a className="button secondary" href={`${EXPLORER}/contract/${evidence.appGateId}`} target="_blank" rel="noreferrer">
              Open AppGate
            </a>
          </div>
        </header>

        <section className="overview-grid" aria-label="Verified deployment summary">
          <article className="summary-card wide">
            <span className="eyebrow">AppGate contract</span>
            <CodeValue>{evidence.appGateId}</CodeValue>
          </article>
          <article className="summary-card">
            <span className="eyebrow">Claim</span>
            <strong>Success</strong>
            <p>Transaction finalized on testnet.</p>
          </article>
          <article className="summary-card">
            <span className="eyebrow">Replay</span>
            <strong>Rejected</strong>
            <p>{evidence.replayErrorName} #{evidence.replayErrorCode}</p>
          </article>
          <article className="summary-card">
            <span className="eyebrow">Read-back</span>
            <strong>hasClaimed</strong>
            <p>{evidence.readBack.hasClaimed}</p>
          </article>
        </section>

        <Workflow evidence={evidence} explorer={EXPLORER} />

        <section id="evidence" className="panel">
          <PanelTitle
            title="On-chain evidence trail"
            copy="Each row links to the public Stellar testnet transaction used in the verified lifecycle."
          />
          <div className="evidence-table" role="table" aria-label="Stellar testnet transaction trail">
            {lifecycle.map(([label, status, tx], index) => (
              <div className="evidence-row" role="row" key={tx}>
                <span className="row-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{label}</h3>
                  <StatusChip tone="success">{status}</StatusChip>
                </div>
                <TxLink tx={tx} />
              </div>
            ))}
          </div>
        </section>

        <section id="proof" className="workspace-grid two">
          <article className="panel">
            <PanelTitle title="Public input order" copy="AppGate reconstructs these four values before verifier invocation." />
            <ol className="input-list">
              {PUBLIC_INPUT_ORDER.map((key) => (
                <li key={key}>
                  <CodeValue>{key}</CodeValue>
                </li>
              ))}
            </ol>
          </article>

          <article className="panel">
            <PanelTitle title="Verifier facts" copy="Concrete artifacts from the successful Keccak UltraHonk run." />
            <div className="fact-list">
              {proofFacts.map(([label, value]) => (
                <div className="fact-row" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="workspace-grid two">
          <article className="panel">
            <PanelTitle title="Reproduce locally" copy="The same project commands regenerate proof artifacts and verify contract behavior." />
            <pre className="command-block">{commands.map((cmd) => `$ ${cmd}`).join("\n")}</pre>
          </article>

          <article id="privacy" className="panel">
            <PanelTitle title="Honest privacy boundary" copy="The proof hides membership details; it does not prove legal identity." />
            <div className="boundary-list">
              <div>
                <h3>Hidden</h3>
                <p>Identity secret, trapdoor, Merkle path, and which registered leaf claimed.</p>
              </div>
              <div>
                <h3>Public</h3>
                <p>Merkle root, scope domain, nullifier, signal hash, and claimed state.</p>
              </div>
              <div>
                <h3>Issuer trust</h3>
                <p>Eligibility and one-human policy remain the issuer's off-chain responsibility.</p>
              </div>
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
