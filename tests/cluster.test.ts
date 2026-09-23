import { describe, expect, test } from 'vitest';
import { clusterFromGenesis, isMainnet } from '../src/lib/cluster';

describe('identifying the cluster', () => {
  test('names the three public clusters by genesis hash', () => {
    expect(clusterFromGenesis('EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG')).toBe('devnet');
    expect(clusterFromGenesis('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d')).toBe('mainnet-beta');
    expect(clusterFromGenesis('4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY')).toBe('testnet');
  });

  test('says so plainly when it does not recognise the chain', () => {
    expect(clusterFromGenesis('BpSZhh2N9dtXzxi9DjcK5JnYAACSmBabAm8yoD59z62V')).toBe(
      'unrecognised-cluster:BpSZhh2N',
    );
  });

  test('a strange RPC is never silently treated as devnet', () => {
    expect(clusterFromGenesis('whatever')).not.toBe('devnet');
  });

  test('mainnet is recognised so it can be refused', () => {
    expect(isMainnet(clusterFromGenesis('5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'))).toBe(true);
    expect(isMainnet('devnet')).toBe(false);
  });
});
