/**
 * Canonical serialisation + hashing.
 *
 * The receipt shown on screen is turned into ONE canonical string and hashed.
 * That hash is written into the transaction itself (memo + token metadata), so
 * anybody can later prove which words were on the screen at signing time.
 *
 * Rules that make this work:
 *  - object keys are emitted in sorted order, always
 *  - no floats, no dates, no locale-dependent formatting
 *  - the same function runs in the browser (build time) and in the verifier
 */

import { toHex } from './format';

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Deterministic JSON: sorted keys, no whitespace, integers only. */
export function canonicalJson(value: Json): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error(`canonicalJson: non-integer number (${value}) would not be stable`);
    }
    return String(value);
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k] as Json)}`);
  return `{${body.join(',')}}`;
}

/** SHA-256 of a UTF-8 string, lowercase hex. WebCrypto: browser + Node 18+. */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(new Uint8Array(digest));
}
