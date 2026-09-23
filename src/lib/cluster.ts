/**
 * Cluster configuration.
 *
 * Devnet, deliberately and only. The RPC endpoint is overridable because the
 * public devnet endpoint rate-limits hard, and a reviewer with their own RPC
 * should not be stuck behind it. The override lives in this browser only.
 */

import { Connection } from '@solana/web3.js';
import type { Chain } from './wallet';

export const CLUSTER = 'devnet';
export const CHAIN: Chain = 'solana:devnet';
export const DEFAULT_RPC = 'https://api.devnet.solana.com';

const RPC_STORAGE_KEY = 'taste.rpc.devnet';

export function rpcEndpoint(): string {
  const fromEnv = import.meta.env?.VITE_SOLANA_RPC as string | undefined;
  try {
    const stored = localStorage.getItem(RPC_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    /* storage blocked: fall back to env or default */
  }
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_RPC;
}

export function setRpcEndpoint(endpoint: string): void {
  try {
    if (endpoint) localStorage.setItem(RPC_STORAGE_KEY, endpoint);
    else localStorage.removeItem(RPC_STORAGE_KEY);
  } catch {
    /* storage blocked: the change applies to this page load only */
  }
}

export function connection(): Connection {
  return new Connection(rpcEndpoint(), 'confirmed');
}

/**
 * Genesis hashes are the only trustworthy cluster identifier: an RPC URL can
 * say anything. The receipt names the cluster, so the app asks the chain which
 * chain it is rather than believing the endpoint.
 */
export const KNOWN_GENESIS: Record<string, string> = {
  '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d': 'mainnet-beta',
  EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG: 'devnet',
  '4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY': 'testnet',
};

export function clusterFromGenesis(genesisHash: string): string {
  return KNOWN_GENESIS[genesisHash] ?? `unrecognised-cluster:${genesisHash.slice(0, 8)}`;
}

/** True for the one cluster this app refuses to build a transaction for. */
export function isMainnet(cluster: string): boolean {
  return cluster === 'mainnet-beta';
}

export async function resolveCluster(conn: Connection): Promise<string> {
  return clusterFromGenesis(await conn.getGenesisHash());
}

export function explorerTx(signature: string, cluster: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}
