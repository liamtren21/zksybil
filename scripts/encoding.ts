export const BN254_SCALAR_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const U64_MAX = (1n << 64n) - 1n;

export function assertCanonicalField(value: bigint): bigint {
  if (value < 0n || value >= BN254_SCALAR_MODULUS) {
    throw new RangeError("field value is not canonical");
  }
  return value;
}

export function u64ToField(value: bigint | number): bigint {
  const normalized = BigInt(value);
  if (normalized < 0n || normalized > U64_MAX) {
    throw new RangeError("value is outside u64");
  }
  return normalized;
}

export function fieldToBytes(value: bigint): Uint8Array {
  let remaining = assertCanonicalField(value);
  const bytes = new Uint8Array(32);
  for (let index = 31; index >= 0; index -= 1) {
    bytes[index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

export function bytesToField(bytes: Uint8Array): bigint {
  if (bytes.length !== 32) {
    throw new RangeError("field encoding must be exactly 32 bytes");
  }
  let value = 0n;
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte);
  }
  return assertCanonicalField(value);
}

export function fieldHexToBigInt(hex: string): bigint {
  const normalized = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new RangeError("field hex must contain exactly 64 hexadecimal characters");
  }
  return assertCanonicalField(BigInt(`0x${normalized}`));
}
