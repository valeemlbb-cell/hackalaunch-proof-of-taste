/**
 * Instruction decoder.
 *
 * The same function runs twice in this project's life:
 *   1. before signing, on the transaction we just built, to write the receipt
 *   2. after the fact, on the transaction fetched back from the cluster
 *
 * Because both passes use this code, a receipt hash can only match if the words
 * really were derived from the instructions that landed on chain.
 *
 * An instruction this decoder does not recognise is NEVER guessed at. It is
 * returned as `unknown`, and the receipt turns that into a blocking warning.
 */

import { readUIntLE, sol, shortAddress } from './format';
import {
  ASSOCIATED_TOKEN_PROGRAM,
  COMPUTE_BUDGET_PROGRAM,
  MEMO_PROGRAM,
  PROGRAM_NAMES,
  SYSTEM_PROGRAM,
  TOKEN_2022_PROGRAM,
  TOKEN_METADATA_INITIALIZE,
  TOKEN_METADATA_UPDATE_FIELD,
} from './programs';

export interface RawInstruction {
  programId: string;
  accounts: string[];
  data: Uint8Array;
}

export interface DecodedStep {
  /** Stable machine id — part of the hashed receipt. */
  action: string;
  program: string;
  /** One plain-language line. This is literally what the user reads. */
  summary: string;
  details: string[];
  /** Lamports this instruction explicitly moves out of the fee payer, if any. */
  lamports?: number;
  /** True when the decoder could not explain the instruction. */
  unknown: boolean;
}

const AUTHORITY_TYPES = ['mint authority', 'freeze authority', 'account owner', 'close authority'];

function programName(id: string): string {
  return PROGRAM_NAMES[id] ?? `Unknown program ${shortAddress(id, 6, 6)}`;
}

function startsWith(data: Uint8Array, prefix: number[]): boolean {
  if (data.length < prefix.length) return false;
  return prefix.every((b, i) => data[i] === b);
}

function readBorshString(data: Uint8Array, offset: number): { value: string; next: number } {
  const len = readUIntLE(data, offset, 4);
  const start = offset + 4;
  if (start + len > data.length) throw new Error('readBorshString: out of range');
  return { value: new TextDecoder().decode(data.subarray(start, start + len)), next: start + len };
}

function unknownStep(ix: RawInstruction, reason: string): DecodedStep {
  return {
    action: 'unknown',
    program: programName(ix.programId),
    summary: 'This app cannot explain this instruction.',
    details: [reason, `Program: ${ix.programId}`, `Data length: ${ix.data.length} bytes`],
    unknown: true,
  };
}

function decodeSystem(ix: RawInstruction): DecodedStep {
  const kind = readUIntLE(ix.data, 0, 4);
  if (kind === 0) {
    const lamports = readUIntLE(ix.data, 4, 8);
    const space = readUIntLE(ix.data, 12, 8);
    return {
      action: 'system.createAccount',
      program: programName(ix.programId),
      summary: `Rent ${sol(lamports)} for a new ${space}-byte account (the badge mint).`,
      details: [
        'Rent is a deposit held by the account, not a payment to anyone.',
        `New account: ${ix.accounts[1] ?? '(unknown)'}`,
      ],
      lamports,
      unknown: false,
    };
  }
  if (kind === 2) {
    const lamports = readUIntLE(ix.data, 4, 8);
    return {
      action: 'system.transfer',
      program: programName(ix.programId),
      summary: `Send ${sol(lamports)} to ${ix.accounts[1] ?? '(unknown)'}.`,
      details: ['This leaves your wallet and does not come back.'],
      lamports,
      unknown: false,
    };
  }
  return unknownStep(ix, `System Program instruction #${kind} is not in this app's dictionary.`);
}

function decodeComputeBudget(ix: RawInstruction): DecodedStep {
  const kind = ix.data[0];
  if (kind === 2) {
    const units = readUIntLE(ix.data, 1, 4);
    return {
      action: 'computeBudget.setLimit',
      program: programName(ix.programId),
      summary: `Cap this transaction at ${units} compute units.`,
      details: ['A cap, not a cost. If the work exceeds it the transaction fails instead of costing more.'],
      unknown: false,
    };
  }
  if (kind === 3) {
    const price = readUIntLE(ix.data, 1, 8);
    return {
      action: 'computeBudget.setPrice',
      program: programName(ix.programId),
      summary:
        price === 0
          ? 'Set the priority fee to exactly 0.'
          : `Set a priority fee of ${price} micro-lamports per compute unit.`,
      details: [
        price === 0
          ? 'This app never adds a priority fee. The instruction is here so you can see the zero.'
          : 'A priority fee is paid to validators on top of the base fee.',
      ],
      unknown: false,
    };
  }
  return unknownStep(ix, `Compute Budget instruction #${kind} is not in this app's dictionary.`);
}

function decodeToken2022(ix: RawInstruction): DecodedStep {
  if (startsWith(ix.data, TOKEN_METADATA_INITIALIZE)) {
    const name = readBorshString(ix.data, 8);
    const symbol = readBorshString(ix.data, name.next);
    const uri = readBorshString(ix.data, symbol.next);
    return {
      action: 'tokenMetadata.initialize',
      program: programName(ix.programId),
      summary: `Write the badge name "${name.value}" (${symbol.value}) into the mint account itself.`,
      details: [
        uri.value
          ? `Metadata URI: ${uri.value}`
          : 'No external URI: the name and symbol live inside the mint account itself.',
        'Token-2022 stores this on chain, not on a server.',
      ],
      unknown: false,
    };
  }
  if (startsWith(ix.data, TOKEN_METADATA_UPDATE_FIELD)) {
    // discriminator(8) | field: enum tag(1) [+ borsh string when tag == 3] | value: borsh string
    const tag = ix.data[8];
    let cursor = 9;
    let field = ['name', 'symbol', 'uri'][tag] ?? `field#${tag}`;
    if (tag === 3) {
      const custom = readBorshString(ix.data, cursor);
      field = custom.value;
      cursor = custom.next;
    }
    const value = readBorshString(ix.data, cursor);
    return {
      action: `tokenMetadata.updateField:${field}`,
      program: programName(ix.programId),
      summary: `Store "${field}" = ${value.value} on the badge, on chain.`,
      details:
        field === 'receipt'
          ? ['This is the hash of the receipt you are reading right now.']
          : ['Written into the mint account as a metadata field.'],
      unknown: false,
    };
  }

  const kind = ix.data[0];
  if (kind === 0) {
    const decimals = ix.data[1];
    const freezeOption = ix.data[34];
    return {
      action: 'token2022.initializeMint',
      program: programName(ix.programId),
      summary: `Turn that account into a token mint with ${decimals} decimals.`,
      details: [
        freezeOption === 0
          ? 'No freeze authority: nobody can ever freeze your badge.'
          : 'A freeze authority is being set. Whoever holds it can freeze this token.',
      ],
      unknown: false,
    };
  }
  if (kind === 6) {
    const type = ix.data[1];
    const hasNew = ix.data[2] === 1;
    const label = AUTHORITY_TYPES[type] ?? `authority type ${type}`;
    return {
      action: `token2022.setAuthority:${type}:${hasNew ? 'set' : 'revoke'}`,
      program: programName(ix.programId),
      summary: hasNew
        ? `Hand the ${label} to ${shortAddress(ix.accounts[0] ?? '', 6, 6)}.`
        : `Destroy the ${label} permanently.`,
      details: hasNew
        ? ['Someone else will control this token afterwards.']
        : ['After this, not even this app can mint another copy of your badge.'],
      unknown: false,
    };
  }
  if (kind === 7) {
    const amount = readUIntLE(ix.data, 1, 8);
    return {
      action: 'token2022.mintTo',
      program: programName(ix.programId),
      summary: `Mint ${amount} badge to your token account.`,
      details: ['This is the thing you get.'],
      unknown: false,
    };
  }
  if (kind === 25) {
    const hasAuthority = ix.data[1] === 1;
    return {
      action: `token2022.initializeMintCloseAuthority:${hasAuthority ? 'set' : 'none'}`,
      program: programName(ix.programId),
      summary: hasAuthority
        ? 'Let you close the badge mint later and take the rent deposit back.'
        : 'No close authority: the rent deposit on the mint can never be reclaimed.',
      details: hasAuthority
        ? ['The close authority is your own wallet, not this app.']
        : ['The deposit stays locked in the account forever.'],
      unknown: false,
    };
  }
  if (kind === 39 && ix.data[1] === 0) {
    return {
      action: 'token2022.initializeMetadataPointer',
      program: programName(ix.programId),
      summary: 'Point the mint at itself for metadata (Token-2022 metadata-pointer extension).',
      details: ['No external metadata server is involved.'],
      unknown: false,
    };
  }
  return unknownStep(ix, `Token-2022 instruction #${kind} is not in this app's dictionary.`);
}

function decodeAssociatedToken(ix: RawInstruction): DecodedStep {
  const idempotent = ix.data.length > 0 && ix.data[0] === 1;
  return {
    action: idempotent ? 'ata.createIdempotent' : 'ata.create',
    program: programName(ix.programId),
    summary: 'Open a token account for you so the badge has somewhere to live.',
    details: [
      'You own it and can close it later to get the rent deposit back.',
      `Token account: ${ix.accounts[1] ?? '(unknown)'}`,
    ],
    unknown: false,
  };
}

function decodeMemo(ix: RawInstruction): DecodedStep {
  const text = new TextDecoder().decode(ix.data);
  return {
    action: 'memo',
    program: programName(ix.programId),
    summary: `Attach a public note: ${text}`,
    details: ['Anyone can read this note on chain forever.'],
    unknown: false,
  };
}

export function decodeInstruction(ix: RawInstruction): DecodedStep {
  try {
    switch (ix.programId) {
      case SYSTEM_PROGRAM:
        return decodeSystem(ix);
      case COMPUTE_BUDGET_PROGRAM:
        return decodeComputeBudget(ix);
      case TOKEN_2022_PROGRAM:
        return decodeToken2022(ix);
      case ASSOCIATED_TOKEN_PROGRAM:
        return decodeAssociatedToken(ix);
      case MEMO_PROGRAM:
        return decodeMemo(ix);
      default:
        return unknownStep(ix, 'This app has never been taught to read this program.');
    }
  } catch (error) {
    return unknownStep(ix, `Decoding failed: ${(error as Error).message}`);
  }
}

export function decodeAll(instructions: RawInstruction[]): DecodedStep[] {
  return instructions.map(decodeInstruction);
}
