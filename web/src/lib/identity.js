const STORAGE_KEY = "zksybil.identity.v1";

function randomFieldHex(randomBytes) {
  const bytes = randomBytes ?? crypto.getRandomValues(new Uint8Array(32));
  if (bytes.length !== 32) {
    throw new Error("Identity randomness must be exactly 32 bytes");
  }
  const canonical = Uint8Array.from(bytes);
  canonical[0] = 0;
  return Array.from(canonical, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createIdentity(randomBytes) {
  return {
    identitySecret: randomFieldHex(randomBytes?.secret),
    identityTrapdoor: randomFieldHex(randomBytes?.trapdoor),
    createdAt: new Date(0).toISOString(),
  };
}

export function saveIdentity(storage, identity) {
  storage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function loadIdentity(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function getOrCreateIdentity(storage, randomBytes) {
  const existing = loadIdentity(storage);
  if (existing) return existing;
  const identity = createIdentity(randomBytes);
  saveIdentity(storage, identity);
  return identity;
}

export function createRecoveryPayload(identity) {
  return JSON.stringify(
    {
      version: 1,
      warning: "Keep this recovery file private. Anyone with it can use your private claim identity.",
      identity,
    },
    null,
    2,
  );
}

export { STORAGE_KEY };
