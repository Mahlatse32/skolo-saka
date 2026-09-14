import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSaPhone, pinPassword } from '../lib/pin-auth.ts';

test('South African phone formats normalize to the same account identifier', () => {
  assert.equal(normalizeSaPhone('061 459 0028'), '+27614590028');
  assert.equal(normalizeSaPhone('+27 61 459 0028'), '+27614590028');
  assert.equal(normalizeSaPhone('27614590028'), '+27614590028');
});

test('phone and email recovery create the same sign-in password for a PIN', async () => {
  const fromLocalPhone = await pinPassword('0614590028', '4826');
  const fromStoredPhone = await pinPassword('+27614590028', '4826');
  assert.equal(fromLocalPhone, fromStoredPhone);
  assert.match(fromLocalPhone, /^Ss![0-9a-f]{64}$/);
  assert.notEqual(fromLocalPhone, await pinPassword('+27614590028', '4827'));
});
