import { describe, expect, test } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

import { instructionsFor, toRawInstructions } from '../src/lib/badge';
import { decodeAll } from '../src/lib/decode';
import { buildReceipt, canonicalReceipt, hashReceipt, type ReceiptContext } from '../src/lib/receipt';
import { tasteById } from '../src/lib/tastes';

const PAYER = new PublicKey('6dNVEMKAAoCxL1LhcLtLPSvJeZCBQEBqjPyNvnPRbNWJ');
const MINT = new PublicKey('3wjKW6rLcWNWKNVTBvUhFGqM2Vd8YG4Zt9jjJcnN2dSq');
const TOKEN_ACCOUNT = getAssociatedTokenAddressSync(MINT, PAYER, false, TOKEN_2022_PROGRAM_ID);
const TASTE = tasteById('brutal');
const MINT_RENT = 3_000_000;

const CTX: ReceiptContext = {
  cluster: 'devnet',
  action: 'mint-taste-badge',
  taste: TASTE.id,
  signer: PAYER.toBase58(),
  mint: MINT.toBase58(),
  blockhash: 'EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k',
  feeLamports: 10_000,
  tokenAccountRentLamports: 2_074_080,
};

function receiptFor(hash: string) {
  const steps = decodeAll(toRawInstructions(instructionsFor(PAYER, MINT, TOKEN_ACCOUNT, TASTE, hash, MINT_RENT)));
  return buildReceipt(steps, CTX);
}

describe('the hashed receipt', () => {
  test('is identical no matter which hash the transaction carries', async () => {
    // Arrange: the receipt describes a transaction that contains the receipt's
    // own hash. The self-referential parts must be redacted before hashing, or
    // the hash could never be computed at all.
    const first = receiptFor('a'.repeat(64));
    const second = receiptFor('b'.repeat(64));

    // Act / Assert
    expect(canonicalReceipt(first)).toBe(canonicalReceipt(second));
    await expect(hashReceipt(first)).resolves.toBe(await hashReceipt(second));
  });

  test('redacts the hash but keeps every other word of the memo', () => {
    const memo = receiptFor('c'.repeat(64)).steps.find((s) => s.action === 'memo')!;
    expect(memo.summary).toBe('Attach a public note: taste-receipt/1 <receipt-hash> brutal');
  });

  test('changes when a single lamport of the disclosed cost changes', async () => {
    const steps = decodeAll(
      toRawInstructions(instructionsFor(PAYER, MINT, TOKEN_ACCOUNT, TASTE, 'd'.repeat(64), MINT_RENT)),
    );
    const cheap = await hashReceipt(buildReceipt(steps, CTX));
    const dear = await hashReceipt(buildReceipt(steps, { ...CTX, feeLamports: 10_001 }));
    expect(cheap).not.toBe(dear);
  });

  test('changes when the taste changes, because the taste is the product', async () => {
    const swiss = await hashReceipt(receiptFor('e'.repeat(64)));
    const stepsOther = decodeAll(
      toRawInstructions(
        instructionsFor(PAYER, MINT, TOKEN_ACCOUNT, tasteById('terminal'), 'e'.repeat(64), MINT_RENT),
      ),
    );
    const terminal = await hashReceipt(buildReceipt(stepsOther, { ...CTX, taste: 'terminal' }));
    expect(swiss).not.toBe(terminal);
  });
});

describe('what the receipt says', () => {
  const receipt = receiptFor('f'.repeat(64));

  test('totals every disclosed cost line', () => {
    const sum = receipt.costs.reduce((acc, c) => acc + c.lamports, 0);
    expect(receipt.totalLamports).toBe(sum);
    expect(receipt.totalLamports).toBe(MINT_RENT + CTX.tokenAccountRentLamports + CTX.feeLamports);
  });

  test('separates the money that comes back from the money that does not', () => {
    expect(receipt.refundableLamports).toBe(MINT_RENT + CTX.tokenAccountRentLamports);
    const labels = receipt.costs.filter((c) => !c.refundable).map((c) => c.label);
    expect(labels).toEqual(['Network fee']);
  });

  test('states the non-refundable amount as a risk in plain words', () => {
    expect(receipt.risks.join(' ')).toContain('0.00001 SOL of the total does not come back');
  });

  test('says the badge is not an investment and the cluster is a test cluster', () => {
    const risks = receipt.risks.join(' ');
    expect(risks).toContain('not an investment');
    expect(risks).toContain('devnet');
  });

  test('is not blocked when every instruction is understood', () => {
    expect(receipt.blocked).toBe(false);
    expect(receipt.risks[0]).not.toContain('STOP');
  });

  test('promises no approvals or allowances', () => {
    expect(receipt.youGet.join(' ')).toContain('no allowance');
  });
});

describe('when the transaction contains something unexplainable', () => {
  const steps = decodeAll(
    toRawInstructions(instructionsFor(PAYER, MINT, TOKEN_ACCOUNT, TASTE, '0'.repeat(64), MINT_RENT)),
  ).concat([
    {
      action: 'unknown',
      program: 'Unknown program',
      summary: 'This app cannot explain this instruction.',
      details: ['injected'],
      unknown: true,
    },
  ]);
  const receipt = buildReceipt(steps, CTX);

  test('blocks signing', () => {
    expect(receipt.blocked).toBe(true);
  });

  test('puts the warning first, above everything else', () => {
    expect(receipt.risks[0]).toContain('STOP');
    expect(receipt.risks[0]).toContain('Do not sign');
  });
});
