export function assertNetwork(expected, actual) {
  if (expected !== actual) {
    throw new Error(`Wallet network mismatch: expected ${expected}, got ${actual}`);
  }
}

export async function submitVote(client, args) {
  const result = await client.castVote(args);
  if (!result?.ok) {
    throw new Error(result?.error ?? "Transaction failed");
  }
  return result;
}
