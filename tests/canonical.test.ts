import { describe, expect, test } from 'vitest';
import { canonicalJson, sha256Hex } from '../src/lib/canonical';

describe('canonicalJson', () => {
  test('sorts object keys so two equal receipts always hash the same', () => {
    // Arrange
    const a = { taste: 'swiss', action: 'mint', cluster: 'devnet' };
    const b = { cluster: 'devnet', action: 'mint', taste: 'swiss' };

    // Act / Assert
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe('{"action":"mint","cluster":"devnet","taste":"swiss"}');
  });

  test('sorts nested keys too', () => {
    expect(canonicalJson({ z: { b: 1, a: 2 } })).toBe('{"z":{"a":2,"b":1}}');
  });

  test('keeps array order, which is meaningful in a receipt', () => {
    expect(canonicalJson(['b', 'a'])).toBe('["b","a"]');
  });

  test('throws on non-integer numbers rather than hashing a float', () => {
    expect(() => canonicalJson({ cost: 0.1 })).toThrow(/non-integer/);
  });

  test('escapes strings through JSON rules', () => {
    expect(canonicalJson({ t: 'a"b\n' })).toBe('{"t":"a\\"b\\n"}');
  });
});

describe('sha256Hex', () => {
  test('matches the published digest of the empty string', async () => {
    await expect(sha256Hex('')).resolves.toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  test('matches the published digest of "abc"', async () => {
    await expect(sha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
