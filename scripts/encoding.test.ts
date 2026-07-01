import { describe, expect, it } from "vitest";
import {
  BN254_SCALAR_MODULUS,
  bytesToField,
  fieldHexToBigInt,
  fieldToBytes,
  u64ToField,
} from "./encoding.js";

describe("canonical BN254 field encoding", () => {
  it("encodes u64 as a 32-byte big-endian field", () => {
    const encoded = fieldToBytes(u64ToField(0x0102n));
    expect(encoded).toHaveLength(32);
    expect([...encoded.slice(0, 30)]).toEqual(Array(30).fill(0));
    expect([...encoded.slice(30)]).toEqual([1, 2]);
  });

  it("round-trips canonical field values", () => {
    const value = BN254_SCALAR_MODULUS - 1n;
    expect(bytesToField(fieldToBytes(value))).toBe(value);
  });

  it("rejects non-canonical field values", () => {
    expect(() => fieldToBytes(BN254_SCALAR_MODULUS)).toThrow(/canonical/i);
  });

  it("rejects byte arrays with the wrong length", () => {
    expect(() => bytesToField(new Uint8Array(31))).toThrow(/32 bytes/i);
  });

  it("rejects values outside u64", () => {
    expect(() => u64ToField(-1n)).toThrow(/u64/i);
    expect(() => u64ToField(1n << 64n)).toThrow(/u64/i);
  });

  it("parses a canonical 32-byte field hex value", () => {
    const hex = `00${"ab".repeat(31)}`;
    expect(fieldHexToBigInt(hex)).toBe(BigInt(`0x${hex}`));
  });

  it("rejects field hex values with the wrong length or modulus", () => {
    expect(() => fieldHexToBigInt("ab")).toThrow(/64 hexadecimal/i);
    expect(() =>
      fieldHexToBigInt(BN254_SCALAR_MODULUS.toString(16).padStart(64, "0")),
    ).toThrow(/canonical/i);
  });
});
