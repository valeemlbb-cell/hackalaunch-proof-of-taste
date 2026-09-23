/**
 * The receipt.
 *
 * `buildReceipt` is a PURE function of things that are all recoverable from the
 * confirmed transaction:
 *   - the decoded instructions
 *   - the fee the cluster charged (transaction meta)
 *   - the blockhash, the signer, the mint, the chosen taste
 *   - one rent constant, which is a fixed function of an account size
 *
 * That is the whole trick. The builder calls it before signing; the verifier
 * calls it again afterwards with values read back from the cluster. If the two
 * hashes match, the screen and the chain agreed.
 */

import { canonicalJson, sha256Hex, type Json } from './canonical';
import type { DecodedStep } from './decode';
import { sol } from './format';
import { tasteLabel } from './tastes';

export const RECEIPT_VERSION = 'taste-receipt/1';

/** Steps that carry the receipt hash itself must be redacted before hashing. */
const SELF_REFERENTIAL = new Set(['memo', 'tokenMetadata.updateField:receipt']);
const HEX64 = /[0-9a-f]{64}/g;

export interface CostLine {
  label: string;
  lamports: number;
  /** true when the user can get these lamports back later. */
  refundable: boolean;
  note: string;
}

export interface ReceiptStep {
  action: string;
  summary: string;
  details: string[];
}

export interface Receipt {
  version: string;
  cluster: string;
  action: string;
  taste: string;
  signer: string;
  mint: string;
  blockhash: string;
  steps: ReceiptStep[];
  costs: CostLine[];
  totalLamports: number;
  refundableLamports: number;
  youGet: string[];
  risks: string[];
  /** true when at least one instruction could not be explained. Do not sign. */
  blocked: boolean;
}

export interface ReceiptContext {
  cluster: string;
  action: string;
  taste: string;
  signer: string;
  mint: string;
  blockhash: string;
  feeLamports: number;
  tokenAccountRentLamports: number;
}

function redact(step: DecodedStep): ReceiptStep {
  const scrub = (text: string) =>
    SELF_REFERENTIAL.has(step.action) ? text.replace(HEX64, '<receipt-hash>') : text;
  return {
    action: step.action,
    summary: scrub(step.summary),
    details: step.details.map(scrub),
  };
}

function buildCosts(steps: DecodedStep[], ctx: ReceiptContext): CostLine[] {
  const costs: CostLine[] = [];

  const mintRent = steps.find((s) => s.action === 'system.createAccount')?.lamports ?? 0;
  const canCloseMint = steps.some((s) => s.action.startsWith('token2022.initializeMintCloseAuthority:set'));
  if (mintRent > 0) {
    costs.push({
      label: 'Rent deposit — badge mint account',
      lamports: mintRent,
      refundable: canCloseMint,
      note: canCloseMint
        ? 'Yours. Burn the badge, close the mint, and this comes straight back to your wallet.'
        : 'Locked in the account. Nobody can return it, including you.',
    });
  }

  costs.push({
    label: 'Rent deposit — your token account',
    lamports: ctx.tokenAccountRentLamports,
    refundable: true,
    note: 'Yours. Close the token account in any wallet and this comes back.',
  });

  costs.push({
    label: 'Network fee',
    lamports: ctx.feeLamports,
    refundable: false,
    note: 'Paid to validators. This app receives none of it.',
  });

  for (const step of steps) {
    if (step.action === 'system.transfer' && step.lamports) {
      costs.push({
        label: 'Transfer out of your wallet',
        lamports: step.lamports,
        refundable: false,
        note: 'Leaves your wallet permanently.',
      });
    }
  }

  return costs;
}

function buildYouGet(steps: DecodedStep[], ctx: ReceiptContext): string[] {
  const out: string[] = [];
  const minted = steps.find((s) => s.action === 'token2022.mintTo');
  if (minted) {
    out.push(`One "${tasteLabel(ctx.taste)}" Taste Badge token, held by your wallet.`);
    out.push(`A new Token-2022 mint at ${ctx.mint}, created by this transaction.`);
  }
  if (steps.some((s) => s.action === 'tokenMetadata.updateField:receipt')) {
    out.push('The hash of this exact receipt, stored on chain inside the badge.');
  }
  if (steps.some((s) => s.action.startsWith('token2022.setAuthority:0:revoke'))) {
    out.push('A supply of exactly 1, frozen forever — the mint authority is destroyed in this same transaction.');
  }
  if (steps.some((s) => s.action.startsWith('token2022.initializeMintCloseAuthority:set'))) {
    out.push('The right to close the mint yourself later and reclaim its rent deposit.');
  }
  out.push('No subscription, no allowance, no approval for anyone to move your funds.');
  return out;
}

function buildRisks(steps: DecodedStep[], ctx: ReceiptContext): string[] {
  const risks: string[] = [];

  if (steps.some((s) => s.unknown)) {
    risks.push(
      'STOP: this transaction contains an instruction this app cannot explain. Do not sign it.',
    );
  }

  risks.push(
    ctx.cluster === 'mainnet-beta'
      ? 'This is real money on mainnet.'
      : `This runs on ${ctx.cluster}. The SOL is test SOL and the badge has no monetary value.`,
  );
  risks.push('A Taste Badge is a collectible, not an investment. Nobody promises it will be worth anything.');
  risks.push('If the transaction fails, the network fee is still spent. Rent deposits are not taken.');

  const nonRefundable = buildCosts(steps, ctx)
    .filter((c) => !c.refundable)
    .reduce((sum, c) => sum + c.lamports, 0);
  risks.push(`${sol(nonRefundable)} of the total does not come back under any circumstances.`);

  if (steps.some((s) => s.action.startsWith('token2022.setAuthority') && s.action.endsWith('set'))) {
    risks.push('An authority over this token is being handed to another address.');
  }
  if (steps.some((s) => s.action === 'memo')) {
    risks.push('The memo on this transaction is public and permanent. Anyone can read it.');
  }

  return risks;
}

export function buildReceipt(steps: DecodedStep[], ctx: ReceiptContext): Receipt {
  const costs = buildCosts(steps, ctx);
  return {
    version: RECEIPT_VERSION,
    cluster: ctx.cluster,
    action: ctx.action,
    taste: ctx.taste,
    signer: ctx.signer,
    mint: ctx.mint,
    blockhash: ctx.blockhash,
    steps: steps.map(redact),
    costs,
    totalLamports: costs.reduce((sum, c) => sum + c.lamports, 0),
    refundableLamports: costs.filter((c) => c.refundable).reduce((sum, c) => sum + c.lamports, 0),
    youGet: buildYouGet(steps, ctx),
    risks: buildRisks(steps, ctx),
    blocked: steps.some((s) => s.unknown),
  };
}

/** The exact bytes that get hashed. Shown in the UI so it is not a black box. */
export function canonicalReceipt(receipt: Receipt): string {
  return canonicalJson(receipt as unknown as Json);
}

export function hashReceipt(receipt: Receipt): Promise<string> {
  return sha256Hex(canonicalReceipt(receipt));
}
