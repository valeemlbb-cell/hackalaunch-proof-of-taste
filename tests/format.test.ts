import { describe, expect, test } from 'vitest';
import { readUIntLE, shortAddress, sol, solString, toHex } from '../src/lib/format';

describe('solString', () => {
  test('keeps at least four decimals so small costs never render as "0"', () => {
    // Arrange / Act / Assert
    expect(solString(0)).toBe('0.0000');
    expect(solString(10_000)).toBe('0.00001');
  });

  test('never rounds a cost away — one lamport is still shown', () => {
    expect(solString(1)).toBe('0.000000001');
  });

  test('renders whole and fractional lamports without locale separators', () => {
    expect(solString(1_000_000_000)).toBe('1.0000');
    expect(solString(1_500_000_000)).toBe('1.5000');
    expect(solString(2_039_280)).toBe('0.00203928');
  });

  test('handles negative balance deltas', () => {
    expect(solString(-1_500_000_000)).toBe('-1.5000');
  });

  test('rejects values that would hash unstably', () => {
    expect(() => solString(Number.NaN)).toThrow(/finite/);
  });

  test('sol() appends the ticker', () => {
    expect(sol(10_000)).toBe('0.00001 SOL');
  });
});

describe('readUIntLE', () => {
  test('reads little-endian integers', () => {
    const data = new Uint8Array([0x01, 0x00, 0x00, 0x00, 0xe8, 0x03, 0x00, 0x00]);
    expect(readUIntLE(data, 0, 4)).toBe(1);
    expect(readUIntLE(data, 4, 4)).toBe(1000);
  });

  test('refuses to read past the end instead of returning garbage', () => {
    expect(() => readUIntLE(new Uint8Array([1, 2]), 0, 4)).toThrow(/out of range/);
  });

  test('refuses values beyond the safe integer range', () => {
    const data = new Uint8Array(8).fill(0xff);
    expect(() => readUIntLE(data, 0, 8)).toThrow(/safe integer/);
  });
});

describe('display helpers', () => {
  test('shortAddress keeps both ends', () => {
    expect(shortAddress('11111111111111111111111111111111')).toBe('1111…1111');
    expect(shortAddress('abc')).toBe('abc');
  });

  test('toHex is lowercase and zero padded', () => {
    expect(toHex(new Uint8Array([0, 15, 255]))).toBe('000fff');
  });
});
