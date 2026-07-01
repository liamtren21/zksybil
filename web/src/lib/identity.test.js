import { describe, expect, it } from "vitest";
import {
  createIdentity,
  createRecoveryPayload,
  getOrCreateIdentity,
  loadIdentity,
  saveIdentity,
} from "./identity.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

describe("identity persistence", () => {
  it("creates and persists a local identity without logging secrets", () => {
    const storage = memoryStorage();
    const identity = getOrCreateIdentity(storage, {
      secret: new Uint8Array(32).fill(1),
      trapdoor: new Uint8Array(32).fill(2),
    });

    expect(identity.identitySecret).toBe(`00${"01".repeat(31)}`);
    expect(identity.identityTrapdoor).toBe(`00${"02".repeat(31)}`);
    expect(loadIdentity(storage)).toEqual(identity);
  });

  it("forces generated identity fields into the canonical 31-byte range", () => {
    const identity = createIdentity({
      secret: new Uint8Array(32).fill(255),
      trapdoor: new Uint8Array(32).fill(254),
    });

    expect(identity.identitySecret).toBe(`00${"ff".repeat(31)}`);
    expect(identity.identityTrapdoor).toBe(`00${"fe".repeat(31)}`);
  });

  it("exports a versioned recovery payload with an explicit warning", () => {
    const payload = JSON.parse(
      createRecoveryPayload({
        identitySecret: "00secret",
        identityTrapdoor: "00trapdoor",
        createdAt: "now",
      }),
    );

    expect(payload.version).toBe(1);
    expect(payload.warning).toMatch(/keep.*private/i);
    expect(payload.identity.identitySecret).toBe("00secret");
  });

  it("loads an existing identity instead of replacing it", () => {
    const storage = memoryStorage();
    const identity = { identitySecret: "a", identityTrapdoor: "b", createdAt: "now" };
    saveIdentity(storage, identity);

    expect(getOrCreateIdentity(storage)).toEqual(identity);
  });
});
