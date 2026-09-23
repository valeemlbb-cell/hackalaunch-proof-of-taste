/**
 * The verifier.
 *
 * Give it a transaction signature. It pulls the transaction back from the
 * cluster, decodes the instructions with the SAME decoder the app used before
 * signing, rebuilds the receipt with the SAME builder, hashes it, and compares
 * that hash with the one the transaction carries in its memo.
 *
 * Match  -> the screen and the chain agreed.
 * Differ -> the screen lied, or the app changed. Either way you find out.
 */

import type { Connection } from '@solana/web3.js';

import { decodeAll, type DecodedStep, type RawInstruction } from './decode';
import { buildReceipt, type Receipt } from './receipt';
import { canonicalReceipt } from './receipt';
import { sha256Hex } from './canonical';
import { MEMO_PROGRAM, RECEIPT_MEMO_PREFIX, SYSTEM_PROGRAM } from './programs';
import { tokenAccountLen } from './badge';

export interface MemoClaim {
  hash: string;
  taste: string;
}

export interface VerifyResult {
  signature: string;
  found: true;
  /** Hash written into the transaction at signing time. */
  claimedHash: string;
  /** Hash recomputed from what actually landed on chain. */
  rebuiltHash: string;
  matches: boolean;
  receipt: Receipt;
  canonical: string;
  steps: DecodedStep[];
  /** What the receipt said the whole thing would cost. */
  quotedLamports: number;
  /**
   * What the cluster actually took out of the signer's balance, or null when
   * the balances are too large for JavaScript to subtract exactly. This app
   * would rather print nothing than print a number it cannot stand behind.
   */
  chargedLamports: number | null;
  slot: number;
  succeeded: boolean;
}

export interface VerifyMiss {
  signature: string;
  found: false;
  reason: string;
}

/** Pull `taste-receipt/1 <hash> <taste>` out of a memo string. */
export function parseMemo(text: string): MemoClaim | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 3 || parts[0] !== RECEIPT_MEMO_PREFIX) return null;
  if (!/^[0-9a-f]{64}$/.test(parts[1])) return null;
  return { hash: parts[1], taste: parts[2] };
}

export function findMemoClaim(steps: RawInstruction[]): MemoClaim | null {
  for (const ix of steps) {
    if (ix.programId !== MEMO_PROGRAM) continue;
    const claim = parseMemo(new TextDecoder().decode(ix.data));
    if (claim) return claim;
  }
  return null;
}

/** The mint is the account the System Program created inside this transaction. */
export function findMint(raw: RawInstruction[]): string | null {
  for (const ix of raw) {
    if (ix.programId !== SYSTEM_PROGRAM) continue;
    if (ix.data.length >= 4 && ix.data[0] === 0 && ix.data[1] === 0) {
      return ix.accounts[1] ?? null;
    }
  }
  return null;
}

/**
 * Balances arrive from the RPC as JSON numbers. Above 2^53 they are already
 * rounded, so a subtraction would invent a difference that is not there.
 */
export function balanceDelta(pre: number, post: number): number | null {
  if (!Number.isSafeInteger(pre) || !Number.isSafeInteger(post)) return null;
  return pre - post;
}

export async function verifySignature(
  connection: Connection,
  signature: string,
  cluster: string,
): Promise<VerifyResult | VerifyMiss> {
  const trimmed = signature.trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{80,100}$/.test(trimmed)) {
    return { signature: trimmed, found: false, reason: 'That does not look like a transaction signature.' };
  }

  const tx = await connection.getTransaction(trimmed, {
    maxSupportedTransactionVersion: 0,
    commitment: 'confirmed',
  });
  if (!tx || !tx.meta) {
    return {
      signature: trimmed,
      found: false,
      reason: `No confirmed transaction with that signature on ${cluster}.`,
    };
  }

  const keys = tx.transaction.message.getAccountKeys({ accountKeysFromLookups: tx.meta.loadedAddresses });
  const raw: RawInstruction[] = tx.transaction.message.compiledInstructions.map((ix) => ({
    programId: keys.get(ix.programIdIndex)!.toBase58(),
    accounts: ix.accountKeyIndexes.map((i) => keys.get(i)!.toBase58()),
    data: new Uint8Array(ix.data),
  }));

  const claim = findMemoClaim(raw);
  if (!claim) {
    return {
      signature: trimmed,
      found: false,
      reason: 'This transaction carries no Taste receipt memo, so there is nothing to check it against.',
    };
  }

  const mint = findMint(raw);
  if (!mint) {
    return { signature: trimmed, found: false, reason: 'This transaction did not create a mint account.' };
  }

  const tokenAccountRentLamports = await connection.getMinimumBalanceForRentExemption(tokenAccountLen());
  const steps = decodeAll(raw);
  const receipt = buildReceipt(steps, {
    cluster,
    action: 'mint-taste-badge',
    taste: claim.taste,
    signer: keys.get(0)!.toBase58(),
    mint,
    blockhash: tx.transaction.message.recentBlockhash,
    feeLamports: tx.meta.fee,
    tokenAccountRentLamports,
  });
  const canonical = canonicalReceipt(receipt);
  const rebuiltHash = await sha256Hex(canonical);

  return {
    signature: trimmed,
    found: true,
    claimedHash: claim.hash,
    rebuiltHash,
    matches: rebuiltHash === claim.hash,
    receipt,
    canonical,
    steps,
    quotedLamports: receipt.totalLamports,
    chargedLamports: balanceDelta(tx.meta.preBalances[0], tx.meta.postBalances[0]),
    slot: tx.slot,
    succeeded: tx.meta.err === null,
  };
}
