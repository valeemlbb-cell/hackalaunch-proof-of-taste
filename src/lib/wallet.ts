/**
 * Signing.
 *
 * Two ways in, both honest about what they are:
 *  - a real wallet, through the Wallet Standard (Phantom, Solflare, Backpack…)
 *  - a disposable devnet burner generated in this tab
 *
 * The burner exists so a reviewer with no wallet installed can still watch a
 * real transaction land. It is generated locally, it is labelled disposable
 * everywhere it appears, and the app never asks anybody for a seed phrase or a
 * private key.
 */

import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getWallets } from '@wallet-standard/app';
import bs58 from 'bs58';

const BURNER_STORAGE_KEY = 'taste.burner.devnet.v1';
const SIGN_AND_SEND = 'solana:signAndSendTransaction';
const CONNECT = 'standard:connect';

/** A Wallet Standard chain identifier, e.g. `solana:devnet`. */
export type Chain = `${string}:${string}`;

export interface Signer {
  kind: 'wallet' | 'burner';
  label: string;
  address: PublicKey;
  signAndSend(transaction: VersionedTransaction, connection: Connection): Promise<string>;
}

export interface WalletOption {
  name: string;
  icon?: string;
  connect(): Promise<Signer>;
}

interface StandardWalletLike {
  name: string;
  icon?: string;
  chains: readonly string[];
  features: Record<string, any>;
  accounts: readonly { address: string; publicKey: Uint8Array; features?: readonly string[] }[];
}

function makeWalletSigner(
  wallet: StandardWalletLike,
  account: StandardWalletLike['accounts'][number],
  chain: Chain,
): Signer {
  return {
    kind: 'wallet',
    label: wallet.name,
    address: new PublicKey(account.publicKey),
    async signAndSend(transaction) {
      const result = await wallet.features[SIGN_AND_SEND].signAndSendTransaction({
        account,
        chain,
        transaction: transaction.serialize(),
      });
      const first = Array.isArray(result) ? result[0] : result;
      if (!first?.signature) throw new Error(`${wallet.name} returned no signature.`);
      return bs58.encode(first.signature);
    },
  };
}

/** Wallets installed in this browser that can sign for the given cluster. */
export function detectWallets(chain: Chain): WalletOption[] {
  const { get } = getWallets();
  return get()
    .filter((w) => w.chains.includes(chain) && SIGN_AND_SEND in w.features && CONNECT in w.features)
    .map((wallet) => ({
      name: wallet.name,
      icon: wallet.icon,
      async connect(): Promise<Signer> {
        const typed = wallet as unknown as StandardWalletLike;
        const connected = await typed.features[CONNECT].connect();
        const account = (connected?.accounts ?? typed.accounts)[0];
        if (!account) throw new Error(`${typed.name} did not share an account.`);
        return makeWalletSigner(typed, account, chain);
      },
    }));
}

function loadBurnerKeypair(): Keypair {
  try {
    const stored = localStorage.getItem(BURNER_STORAGE_KEY);
    if (stored) return Keypair.fromSecretKey(bs58.decode(stored));
  } catch {
    /* unreadable storage: fall through and make a new one */
  }
  const fresh = Keypair.generate();
  try {
    localStorage.setItem(BURNER_STORAGE_KEY, bs58.encode(fresh.secretKey));
  } catch {
    /* private mode: the burner just lives for this page load */
  }
  return fresh;
}

export function forgetBurner(): void {
  try {
    localStorage.removeItem(BURNER_STORAGE_KEY);
  } catch {
    /* nothing to forget */
  }
}

export function burnerSigner(): Signer {
  const keypair = loadBurnerKeypair();
  return {
    kind: 'burner',
    label: 'Devnet burner (disposable)',
    address: keypair.publicKey,
    async signAndSend(transaction, connection) {
      transaction.sign([keypair]);
      return connection.sendRawTransaction(transaction.serialize(), {
        preflightCommitment: 'confirmed',
      });
    },
  };
}
