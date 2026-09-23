/**
 * The claim this project makes is: "the receipt you read is the receipt the
 * chain can prove you were shown." This test is that claim, end to end.
 *
 * It builds the real transaction, then rebuilds the receipt the way the
 * verifier does — from the compiled transaction alone, with no memory of how
 * it was built — and checks the two hashes agree.
 */

import { describe, expect, test } from 'vitest';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';

import { buildBadge, tokenAccountLen, toRawInstructions } from '../src/lib/badge';
import { decodeAll, type RawInstruction } from '../src/lib/decode';
import { buildReceipt, canonicalReceipt } from '../src/lib/receipt';
import { sha256Hex } from '../src/lib/canonical';
import { findMemoClaim, findMint, parseMemo } from '../src/lib/verify';
import { tasteById } from '../src/lib/tastes';

const BLOCKHASH = 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k';
const FEE = 10_000;
const MINT_RENT = 3_246_000;
const TOKEN_ACCOUNT_RENT = 2_074_080;

/** Just enough of a Connection for the builder — no network, no cluster. */
function stubConnection(): Connection {
  return {
    getMinimumBalanceForRentExemption: async (space: number) =>
      space === tokenAccountLen() ? TOKEN_ACCOUNT_RENT : MINT_RENT,
    getLatestBlockhash: async () => ({ blockhash: BLOCKHASH, lastValidBlockHeight: 1 }),
    getFeeForMessage: async () => ({ context: { slot: 1 }, value: FEE }),
  } as unknown as Connection;
}

/** Re-read a compiled transaction the way the verifier reads one off the chain. */
function rawFromTransaction(transaction: { message: any }): RawInstruction[] {
  const keys = transaction.message.getAccountKeys();
  return transaction.message.compiledInstructions.map((ix: any) => ({
    programId: keys.get(ix.programIdIndex).toBase58(),
    accounts: ix.accountKeyIndexes.map((i: number) => keys.get(i).toBase58()),
    data: new Uint8Array(ix.data),
  }));
}

async function buildOne(tasteId = 'editorial') {
  const payer = Keypair.generate().publicKey;
  const mintKeypair = Keypair.generate();
  const built = await buildBadge(stubConnection(), payer, mintKeypair, tasteById(tasteId), 'devnet');
  return { built, payer, mintKeypair };
}

describe('build then verify, with nothing shared but the transaction', () => {
  test('the hash rebuilt from the compiled transaction matches the one inside it', async () => {
    // Arrange
    const { built } = await buildOne();
    const raw = rawFromTransaction(built.transaction);

    // Act: this is exactly what the verifier does with a fetched transaction.
    const claim = findMemoClaim(raw)!;
    const mint = findMint(raw)!;
    const rebuilt = buildReceipt(decodeAll(raw), {
      cluster: 'devnet',
      action: 'mint-taste-badge',
      taste: claim.taste,
      signer: built.transaction.message.getAccountKeys().get(0)!.toBase58(),
      mint,
      blockhash: built.transaction.message.recentBlockhash,
      feeLamports: FEE,
      tokenAccountRentLamports: TOKEN_ACCOUNT_RENT,
    });
    const rebuiltHash = await sha256Hex(canonicalReceipt(rebuilt));

    // Assert
    expect(claim.hash).toBe(built.receiptHash);
    expect(rebuiltHash).toBe(built.receiptHash);
    expect(canonicalReceipt(rebuilt)).toBe(canonicalReceipt(built.receipt));
  });

  test('the mint the verifier finds is the mint the user was told about', async () => {
    const { built, mintKeypair } = await buildOne('terminal');
    expect(findMint(rawFromTransaction(built.transaction))).toBe(mintKeypair.publicKey.toBase58());
    expect(built.receipt.mint).toBe(mintKeypair.publicKey.toBase58());
  });

  test('a tampered fee makes the rebuilt hash disagree — the check has teeth', async () => {
    const { built } = await buildOne();
    const raw = rawFromTransaction(built.transaction);
    const tampered = buildReceipt(decodeAll(raw), {
      cluster: 'devnet',
      action: 'mint-taste-badge',
      taste: 'editorial',
      signer: built.transaction.message.getAccountKeys().get(0)!.toBase58(),
      mint: findMint(raw)!,
      blockhash: built.transaction.message.recentBlockhash,
      feeLamports: FEE + 1,
      tokenAccountRentLamports: TOKEN_ACCOUNT_RENT,
    });
    await expect(sha256Hex(canonicalReceipt(tampered))).resolves.not.toBe(built.receiptHash);
  });

  test('the transaction is pre-signed by the mint only — the user still has to sign', async () => {
    const { built } = await buildOne();
    const signatures = built.transaction.signatures;
    expect(signatures).toHaveLength(2);
    expect(signatures[0].every((b) => b === 0)).toBe(true); // payer slot still empty
    expect(signatures[1].some((b) => b !== 0)).toBe(true); // mint already signed
  });

  test('the receipt names devnet and the mint that does not exist yet', async () => {
    const { built } = await buildOne('swiss');
    expect(built.receipt.cluster).toBe('devnet');
    expect(built.receipt.blocked).toBe(false);
    expect(built.receipt.youGet.join(' ')).toContain('Swiss');
  });
});

describe('memo parsing', () => {
  test('accepts the receipt memo this app writes', () => {
    expect(parseMemo(`taste-receipt/1 ${'a'.repeat(64)} swiss`)).toEqual({
      hash: 'a'.repeat(64),
      taste: 'swiss',
    });
  });

  test('rejects a memo with a hash that is not a sha-256', () => {
    expect(parseMemo('taste-receipt/1 deadbeef swiss')).toBeNull();
  });

  test('rejects someone else’s memo', () => {
    expect(parseMemo('gm')).toBeNull();
    expect(parseMemo(`other/1 ${'a'.repeat(64)} swiss`)).toBeNull();
  });

  test('findMint returns null when no account was created', () => {
    expect(findMint([{ programId: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr', accounts: [], data: new Uint8Array() }])).toBeNull();
  });

  test('findMemoClaim ignores memos that are not receipts', () => {
    const raw = toRawInstructions([]);
    expect(findMemoClaim(raw)).toBeNull();
  });
});

describe('addresses', () => {
  test('the stub payer is a real public key, so the builder is exercised for real', async () => {
    const { payer } = await buildOne();
    expect(() => new PublicKey(payer.toBase58())).not.toThrow();
  });
});

describe('balance comparison', () => {
  test('subtracts ordinary balances', async () => {
    const { balanceDelta } = await import('../src/lib/verify');
    expect(balanceDelta(2_000_000_000, 1_993_649_400)).toBe(6_350_600);
  });

  test('refuses to subtract balances beyond exact JavaScript integers', async () => {
    const { balanceDelta } = await import('../src/lib/verify');
    expect(balanceDelta(500_000_000_000_000_000, 499_999_999_993_649_400)).toBeNull();
  });
});
