/**
 * Number / string formatting used by the receipt and the UI.
 * Everything that ends up inside the hashed receipt must be deterministic,
 * so these helpers never depend on locale or on the current time.
 */

export const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Lamports -> a fixed 9-decimal SOL string, trailing zeros trimmed but never
 * shorter than 4 decimals. Deterministic: no Intl, no locale.
 */
export function solString(lamports: number): string {
  if (!Number.isFinite(lamports)) throw new Error('solString: not a finite number');
  const negative = lamports < 0;
  const abs = Math.abs(Math.trunc(lamports));
  const whole = Math.floor(abs / LAMPORTS_PER_SOL);
  const frac = String(abs % LAMPORTS_PER_SOL).padStart(9, '0');
  const trimmed = frac.replace(/0+$/, '').padEnd(4, '0');
  return `${negative ? '-' : ''}${whole}.${trimmed}`;
}

/** "0.0034 SOL" */
export function sol(lamports: number): string {
  return `${solString(lamports)} SOL`;
}

/** Shorten a base58 address for display only — never for hashing. */
export function shortAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** Bytes -> lowercase hex. */
export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** Read a little-endian unsigned integer of `len` bytes as a JS number. */
export function readUIntLE(data: Uint8Array, offset: number, len: number): number {
  if (offset + len > data.length) throw new Error('readUIntLE: out of range');
  let value = 0n;
  for (let i = len - 1; i >= 0; i--) value = (value << 8n) | BigInt(data[offset + i]);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('readUIntLE: value exceeds safe integer range');
  }
  return Number(value);
}
