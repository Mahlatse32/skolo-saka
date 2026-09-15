import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const request = body => ({ json: async () => body });

function loadRoute({ auth, instruction, allocations = [], rpcError = null }) {
  const providerCalls = [], rpcCalls = [];
  const db = { rpc: async (name, args) => { rpcCalls.push([name, args]); return { error: rpcError }; } };
  const exports = {};
  const code = ts.transpileModule(readFileSync('app/api/payments/change-amount/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Number, Error, console, encodeURIComponent, require(name) {
    if (name === 'next/server') return { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
    if (name.includes('payment-instructions-server')) return { authenticatedUser: async () => auth, fetchInstruction: async () => instruction, instructionAllocations: async () => allocations };
    return { adminSupabase: () => db, paystackRequest: async (path, options) => { providerCalls.push([path, JSON.parse(options.body)]); return { status: true, message: 'ok' }; } };
  }});
  return { post: exports.POST, providerCalls, rpcCalls };
}

const active = { id: 'instruction-1', user_id: 'owner', kind: 'recurring', status: 'active', amount_cents: 2000, provider_plan_code: 'PLN one/two', provider_subscription_code: 'SUB_1', next_payment_at: '2026-10-15T00:00:00Z' };

test('amount change requires authentication and validates the amount', async () => {
  assert.equal((await loadRoute({ auth: null }).post(request({ instructionId: 'i', amountCents: 2500 }))).status, 401);
  for (const amountCents of [999, 1000.1, 100_000_001, '2500']) {
    assert.equal((await loadRoute({ auth: { user: { id: 'owner' } } }).post(request({ instructionId: 'i', amountCents }))).status, 400);
  }
});

test('amount change rejects another user and inactive arrangements without provider calls', async () => {
  for (const instruction of [{ ...active, user_id: 'other' }, { ...active, status: 'non_renewing' }, { ...active, kind: 'one_off' }]) {
    const route = loadRoute({ auth: { user: { id: 'owner' } }, instruction });
    assert.ok([404, 409].includes((await route.post(request({ instructionId: active.id, amountCents: 2500 }))).status));
    assert.equal(route.providerCalls.length, 0);
  }
});

test('active monthly amount updates its dedicated Paystack plan without charging', async () => {
  const route = loadRoute({ auth: { user: { id: 'owner' } }, instruction: active });
  const result = await route.post(request({ instructionId: active.id, amountCents: 3550 }));
  assert.equal(result.status, 200);
  assert.equal(result.body.nextPaymentAt, active.next_payment_at);
  assert.deepEqual(route.providerCalls, [['/plan/PLN%20one%2Ftwo', { amount: 3550, update_existing_subscriptions: true }]]);
  assert.equal(JSON.stringify(route.rpcCalls), JSON.stringify([['change_payment_instruction_amount', { p_instruction_id: active.id, p_amount_cents: 3550 }]]));
  assert.ok(!route.providerCalls.some(([path]) => path.includes('transaction')));
});

test('a multi-school amount keeps the per-school minimum before contacting Paystack', async () => {
  const route = loadRoute({ auth: { user: { id: 'owner' } }, instruction: active, allocations: [{ id: 'a' }, { id: 'b' }] });
  const result = await route.post(request({ instructionId: active.id, amountCents: 1500 }));
  assert.equal(result.status, 400);
  assert.equal(route.providerCalls.length, 0);
});

test('local update failure restores the old Paystack plan amount', async () => {
  const route = loadRoute({ auth: { user: { id: 'owner' } }, instruction: active, rpcError: new Error('database unavailable') });
  const result = await route.post(request({ instructionId: active.id, amountCents: 3550 }));
  assert.equal(result.status, 500);
  assert.deepEqual(route.providerCalls.map(call => call[1].amount), [3550, 2000]);
});
