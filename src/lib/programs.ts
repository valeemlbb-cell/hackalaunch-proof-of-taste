/** Program ids this app is willing to explain. Anything else is flagged, not guessed. */

export const SYSTEM_PROGRAM = '11111111111111111111111111111111';
export const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const ASSOCIATED_TOKEN_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

export const PROGRAM_NAMES: Record<string, string> = {
  [SYSTEM_PROGRAM]: 'System Program',
  [COMPUTE_BUDGET_PROGRAM]: 'Compute Budget Program',
  [TOKEN_2022_PROGRAM]: 'Token-2022 Program',
  [ASSOCIATED_TOKEN_PROGRAM]: 'Associated Token Account Program',
  [MEMO_PROGRAM]: 'Memo Program',
};

/** 8-byte anchor-style discriminators of the SPL Token Metadata Interface. */
export const TOKEN_METADATA_INITIALIZE = [210, 225, 30, 162, 88, 184, 77, 141];
export const TOKEN_METADATA_UPDATE_FIELD = [221, 233, 49, 45, 181, 202, 220, 200];

/** Receipt marker written into the memo instruction. */
export const RECEIPT_MEMO_PREFIX = 'taste-receipt/1';

/** Metadata keys used for the on-chain copy of the receipt hash. */
export const METADATA_KEY_RECEIPT = 'receipt';
export const METADATA_KEY_TASTE = 'taste';
