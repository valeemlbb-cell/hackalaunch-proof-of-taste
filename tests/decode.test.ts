/**
 * These tests build the real instructions with the real SPL libraries and then
 * feed them to our decoder. They are the guard rail under the whole product:
 * if an upstream layout ever changes, the decoder must say "unknown" loudly
 * rather than describe the wrong thing to a user about to sign.
 */

import { describe, expect, test } from 'vitest';
import { Keypair, PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

import { instructionsFor, toRawInstructions } from '../src/lib/badge';
import { decodeAll, decodeInstruction } from '../src/lib/decode';
import { tasteById } from '../src/lib/tastes';

const PAYER = new PublicKey('6dNVEMKAAoCxL1LhcLtLPSvJeZCBQEBqjPyNvnPRbNWJ');
const MINT = new PublicKey('3wjKW6rLcWNWKNVTBvUhFGqM2Vd8YG4Zt9jjJcnN2dSq');
const TOKEN_ACCOUNT = getAssociatedTokenAddressSync(MINT, PAYER, false, TOKEN_2022_PROGRAM_ID);
const HASH = 'a'.repeat(64);
const TASTE = tasteById('swiss');
const RENT = 3_000_000;

function decodedActions() {
  return decodeAll(
    toRawInstructions(instructionsFor(PAYER, MINT, TOKEN_ACCOUNT, TASTE, HASH, RENT)),
  );
}

describe('decoding the Taste Badge transaction', () => {
  test('every instruction the app builds is understood — nothing is guessed', () => {
    const steps = decodedActions();
    const unknown = steps.filter((s) => s.unknown);
    expect(unknown.map((s) => s.details.join(' '))).toEqual([]);
  });

  test('the instruction order is the one the receipt describes', () => {
    expect(decodedActions().map((s) => s.action)).toEqual([
      'computeBudget.setLimit',
      'computeBudget.setPrice',
      'system.createAccount',
      'token2022.initializeMetadataPointer',
      'token2022.initializeMintCloseAuthority:set',
      'token2022.initializeMint',
      'tokenMetadata.initialize',
      'tokenMetadata.updateField:receipt',
      'tokenMetadata.updateField:taste',
      'ata.create',
      'token2022.mintTo',
      'token2022.setAuthority:0:revoke',
      'memo',
    ]);
  });

  test('the rent figure in the receipt comes from the instruction, not from a constant', () => {
    const step = decodedActions().find((s) => s.action === 'system.createAccount')!;
    expect(step.lamports).toBe(RENT);
    expect(step.summary).toContain('0.0030 SOL');
  });

  test('a zero priority fee is stated as a zero, not omitted', () => {
    const step = decodedActions().find((s) => s.action === 'computeBudget.setPrice')!;
    expect(step.summary).toBe('Set the priority fee to exactly 0.');
  });

  test('revoking the mint authority is described as permanent', () => {
    const step = decodedActions().find((s) => s.action.startsWith('token2022.setAuthority'))!;
    expect(step.summary).toBe('Destroy the mint authority permanently.');
    expect(step.details.join(' ')).toContain('not even this app');
  });

  test('the memo carries the receipt hash', () => {
    const step = decodedActions().find((s) => s.action === 'memo')!;
    expect(step.summary).toContain(`taste-receipt/1 ${HASH} swiss`);
  });

  test('the receipt hash is written into on-chain metadata', () => {
    const step = decodedActions().find((s) => s.action === 'tokenMetadata.updateField:receipt')!;
    expect(step.summary).toBe(`Store "receipt" = ${HASH} on the badge, on chain.`);
  });

  test('the badge name and symbol are read back out of the metadata instruction', () => {
    const step = decodedActions().find((s) => s.action === 'tokenMetadata.initialize')!;
    expect(step.summary).toContain('Taste Badge — Swiss');
    expect(step.summary).toContain('(TASTE)');
  });
});

describe('decoding things the app did not build', () => {
  test('a plain SOL transfer is priced in the summary', () => {
    const ix = SystemProgram.transfer({
      fromPubkey: PAYER,
      toPubkey: MINT,
      lamports: 250_000_000,
    });
    const step = decodeInstruction(toRawInstructions([ix])[0]);
    expect(step.action).toBe('system.transfer');
    expect(step.lamports).toBe(250_000_000);
    expect(step.summary).toContain('0.2500 SOL');
  });

  test('an unknown program is flagged, never described', () => {
    const ix = new TransactionInstruction({
      programId: Keypair.generate().publicKey,
      keys: [],
      data: Buffer.from([1, 2, 3]),
    });
    const step = decodeInstruction(toRawInstructions([ix])[0]);
    expect(step.unknown).toBe(true);
    expect(step.summary).toBe('This app cannot explain this instruction.');
  });

  test('a known program with an unknown instruction is also flagged', () => {
    const ix = new TransactionInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      keys: [],
      data: Buffer.from([99]),
    });
    const step = decodeInstruction(toRawInstructions([ix])[0]);
    expect(step.unknown).toBe(true);
    expect(step.details.join(' ')).toContain('#99');
  });

  test('truncated instruction data fails closed', () => {
    const step = decodeInstruction({
      programId: '11111111111111111111111111111111',
      accounts: [],
      data: new Uint8Array([0, 0, 0, 0, 1]),
    });
    expect(step.unknown).toBe(true);
  });
});
