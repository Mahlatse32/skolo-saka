import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyInputToCents } from '../lib/money-input.ts';

test('money input accepts South African comma and dot decimals', () => {
  assert.equal(moneyInputToCents('50,00'), 5000);
  assert.equal(moneyInputToCents('50.00'), 5000);
  assert.equal(moneyInputToCents(' 1 000,50 '), 100050);
});

test('money input rejects ambiguous or over-precise values', () => {
  for (const value of ['', 'R50', '1,000.50', '50,001', '-10']) assert.equal(moneyInputToCents(value), null);
});
