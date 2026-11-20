// BYOK cipher tests — the real crypto that guards user API keys at rest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptSecret, decryptSecret, maskKey } from '../src/lib/byok-cipher.mjs';

test('encrypt → decrypt roundtrip', () => {
  const secret = 'test-secret-0123456789abcdef';
  const key = 'sk-abc123-verylongkey-987654321';
  const enc = encryptSecret(key, secret);
  assert.notEqual(enc, key);
  assert.match(enc, /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
  assert.equal(decryptSecret(enc, secret), key);
});

test('wrong secret cannot decrypt (GCM auth tag failure)', () => {
  const enc = encryptSecret('sk-test-key-value', 'secret-A');
  assert.throws(() => decryptSecret(enc, 'secret-B'));
});

test('tampered ciphertext throws', () => {
  const secret = 'some-secret';
  const enc = encryptSecret('sk-test-key-value', secret);
  const parts = enc.split('.');
  const data = Buffer.from(parts[2], 'base64');
  data[0] ^= 0xff;
  parts[2] = data.toString('base64');
  assert.throws(() => decryptSecret(parts.join('.'), secret));
});

test('maskKey never reveals the bulk of the key', () => {
  const m = maskKey('sk-proj-abcdefgh1234567890');
  assert.ok(m.includes('…'));
  assert.ok(!m.includes('abcdefgh1234567890'));
});
