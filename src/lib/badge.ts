/**
 * Builds the Taste Badge transaction: a Token-2022 mint that carries its own
 * metadata, with the receipt hash written into that metadata and into a memo.
 *
 * Built in two passes so the receipt can describe a transaction that contains
 * the receipt's own hash:
 *   pass 1 — build with a placeholder hash, decode it, produce the receipt
 *   pass 2 — rebuild with the real hash (same byte lengths, so the fee is identical)
 */

import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type Keypair,
} from '@solana/web3.js';
import {
  AuthorityType,
  ExtensionType,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE,
  createAssociatedTokenAccountInstruction,
  createInitializeMetadataPointerInstruction,
  createInitializeMintCloseAuthorityInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAccountLen,
  getAssociatedTokenAddressSync,
  getMintLen,
} from '@solana/spl-token';
import {
  createInitializeInstruction,
  createUpdateFieldInstruction,
  pack,
  type TokenMetadata,
} from '@solana/spl-token-metadata';
import { Buffer } from 'buffer';

import { decodeAll, type RawInstruction } from './decode';
import { buildReceipt, hashReceipt, type Receipt } from './receipt';
import { MEMO_PROGRAM, METADATA_KEY_RECEIPT, METADATA_KEY_TASTE, RECEIPT_MEMO_PREFIX } from './programs';
import type { Taste } from './tastes';

const PLACEHOLDER_HASH = '0'.repeat(64);
/**
 * Deliberately empty. Name and symbol already live in the mint account, and a
 * transaction has 1232 bytes to spend — an off-chain URI would cost bytes and
 * hand somebody the power to change the badge later.
 */
const METADATA_URI = '';
const COMPUTE_UNIT_LIMIT = 300_000;
const MINT_EXTENSIONS = [ExtensionType.MetadataPointer, ExtensionType.MintCloseAuthority];

export interface BuiltBadge {
  transaction: VersionedTransaction;
  receipt: Receipt;
  receiptHash: string;
  mint: PublicKey;
  tokenAccount: PublicKey;
}

function memoText(hash: string, taste: Taste): string {
  return `${RECEIPT_MEMO_PREFIX} ${hash} ${taste.id}`;
}

function metadataFor(mint: PublicKey, payer: PublicKey, taste: Taste, hash: string): TokenMetadata {
  return {
    updateAuthority: payer,
    mint,
    name: `Taste Badge — ${taste.name}`,
    symbol: taste.symbol,
    uri: METADATA_URI,
    additionalMetadata: [
      [METADATA_KEY_RECEIPT, hash],
      [METADATA_KEY_TASTE, taste.id],
    ],
  };
}

/** Exported so tests can decode the exact instruction list the app ships. */
export function instructionsFor(
  payer: PublicKey,
  mint: PublicKey,
  tokenAccount: PublicKey,
  taste: Taste,
  hash: string,
  mintRentLamports: number,
): TransactionInstruction[] {
  const mintLen = getMintLen(MINT_EXTENSIONS);
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNIT_LIMIT }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 0 }),
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mint,
      space: mintLen,
      lamports: mintRentLamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(mint, payer, mint, TOKEN_2022_PROGRAM_ID),
    createInitializeMintCloseAuthorityInstruction(mint, payer, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(mint, 0, payer, null, TOKEN_2022_PROGRAM_ID),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: mint,
      updateAuthority: payer,
      mint,
      mintAuthority: payer,
      name: `Taste Badge — ${taste.name}`,
      symbol: taste.symbol,
      uri: METADATA_URI,
    }),
    createUpdateFieldInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: mint,
      updateAuthority: payer,
      field: METADATA_KEY_RECEIPT,
      value: hash,
    }),
    createUpdateFieldInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      metadata: mint,
      updateAuthority: payer,
      field: METADATA_KEY_TASTE,
      value: taste.id,
    }),
    createAssociatedTokenAccountInstruction(payer, tokenAccount, payer, mint, TOKEN_2022_PROGRAM_ID),
    createMintToInstruction(mint, tokenAccount, payer, 1, [], TOKEN_2022_PROGRAM_ID),
    createSetAuthorityInstruction(mint, payer, AuthorityType.MintTokens, null, [], TOKEN_2022_PROGRAM_ID),
    new TransactionInstruction({
      programId: new PublicKey(MEMO_PROGRAM),
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      data: Buffer.from(memoText(hash, taste), 'utf8'),
    }),
  ];
}

export function toRawInstructions(instructions: TransactionInstruction[]): RawInstruction[] {
  return instructions.map((ix) => ({
    programId: ix.programId.toBase58(),
    accounts: ix.keys.map((k) => k.pubkey.toBase58()),
    data: new Uint8Array(ix.data),
  }));
}

function compile(
  payer: PublicKey,
  blockhash: string,
  instructions: TransactionInstruction[],
): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/** Rent for a Token-2022 associated token account (it carries ImmutableOwner). */
export function tokenAccountLen(): number {
  return getAccountLen([ExtensionType.ImmutableOwner]);
}

export async function buildBadge(
  connection: Connection,
  payer: PublicKey,
  mintKeypair: Keypair,
  taste: Taste,
  cluster: string,
): Promise<BuiltBadge> {
  const mint = mintKeypair.publicKey;
  const tokenAccount = getAssociatedTokenAddressSync(mint, payer, false, TOKEN_2022_PROGRAM_ID);

  const mintLen = getMintLen(MINT_EXTENSIONS);
  const metadataLen =
    TYPE_SIZE + LENGTH_SIZE + pack(metadataFor(mint, payer, taste, PLACEHOLDER_HASH)).length;

  const [mintRentLamports, tokenAccountRentLamports, latest] = await Promise.all([
    connection.getMinimumBalanceForRentExemption(mintLen + metadataLen),
    connection.getMinimumBalanceForRentExemption(tokenAccountLen()),
    connection.getLatestBlockhash('confirmed'),
  ]);

  const draft = instructionsFor(payer, mint, tokenAccount, taste, PLACEHOLDER_HASH, mintRentLamports);
  const draftTx = compile(payer, latest.blockhash, draft);

  const feeResponse = await connection.getFeeForMessage(draftTx.message, 'confirmed');
  const feeLamports = feeResponse.value;
  if (feeLamports === null) {
    throw new Error('The cluster would not quote a fee for this transaction. Nothing was signed.');
  }

  const steps = decodeAll(toRawInstructions(draft));
  const receipt = buildReceipt(steps, {
    cluster,
    action: 'mint-taste-badge',
    taste: taste.id,
    signer: payer.toBase58(),
    mint: mint.toBase58(),
    blockhash: latest.blockhash,
    feeLamports,
    tokenAccountRentLamports,
  });
  const receiptHash = await hashReceipt(receipt);

  const final = instructionsFor(payer, mint, tokenAccount, taste, receiptHash, mintRentLamports);
  const transaction = compile(payer, latest.blockhash, final);
  transaction.sign([mintKeypair]);

  return { transaction, receipt, receiptHash, mint, tokenAccount };
}
