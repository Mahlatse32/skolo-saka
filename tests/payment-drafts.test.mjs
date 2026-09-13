import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function route(path, auth, db) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Date, Set, Number, Error, process: { env: {} }, require(name) {
    if (name === 'next/server') return { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
    if (name.includes('payment-instructions-server')) return { authenticatedUser: async () => auth };
    return { adminSupabase: () => db, paystackRequest: () => { throw new Error('Unexpected payment provider call'); } };
  }});
  return exports.POST;
}
const request = body => ({ json: async () => body });
const valid = { kind: 'recurring', amountCents: 1000, termMonths: 12 };

test('saving an arrangement needs authentication and rejects invalid money or terms', async () => {
  const path = 'app/api/payments/drafts/route.ts';
  assert.equal((await route(path, null, null)(request(valid))).status, 401);
  for (const body of [{ ...valid, amountCents: 999 }, { ...valid, amountCents: 1000.1 }, { ...valid, amountCents: 100_000_001 }, { ...valid, termMonths: 0 }, { ...valid, kind: 'invalid' }]) {
    assert.equal((await route(path, { user: { id: 'owner' } }, null)(request(body))).status, 400);
  }
});

test('a school-free arrangement belongs to caller and makes no provider call', async () => {
  let saved;
  const db = { from(table) { assert.equal(table, 'payment_instructions'); return { insert(row) { saved = row; return { select() { return { single: async () => ({ data: { id: 'draft-1' } }) }; } }; } }; } };
  const result = await route('app/api/payments/drafts/route.ts', { user: { id: 'owner' } }, db)(request({ ...valid, user_id: 'attacker' }));
  assert.equal(result.status, 201);
  assert.equal(saved.user_id, 'owner');
  assert.equal(saved.provider, 'draft');
  assert.equal(saved.status, 'pending');
  assert.equal(saved.amount_cents, 1000);
  assert.equal(saved.provider_reference, undefined);
});

test('checkout rejects an unavailable or another user’s draft before contacting Paystack', async () => {
  const filters = [];
  const db = { from(table) {
    const q = { select() { return q; }, update() { assert.equal(table, 'payment_instructions'); return q; }, eq(key, value) { if (table === 'payment_instructions') filters.push([key, value]); return q; }, in() { return Promise.resolve({ data: [{ school_id: 'school-1' }] }); }, maybeSingle() { return Promise.resolve({ data: table === 'profiles' ? { email: 'test@example.com' } : null }); } };
    return q;
  }};
  const auth = { user: { id: 'owner' }, supabase: db };
  const result = await route('app/api/payments/initialize/route.ts', auth, db)(request({ kind: 'recurring', consent: true, draftId: 'draft-1', allocations: [{ schoolId: 'school-1', amountCents: 1000 }] }));
  assert.equal(result.status, 409);
  assert.deepEqual(filters, [['id', 'draft-1'], ['user_id', 'owner'], ['provider', 'draft'], ['status', 'pending']]);
});
