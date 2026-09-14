import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function route(path, auth, db, provider = () => { throw new Error('Unexpected payment provider call'); }) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Date, Set, Number, Error, process: { env: { NEXT_APP_URL: 'https://skolo-saka-arnx.vercel.app' } }, require(name) {
    if (name === 'next/server') return { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
    if (name.includes('payment-instructions-server')) return { authenticatedUser: async () => auth };
    return { adminSupabase: () => db, paystackRequest: provider };
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

for (const kind of ['one_off', 'recurring']) {
  test(`${kind} checkout without schools reaches Paystack and preserves amount and term`, async () => {
    const saved = [], calls = [];
    const db = { from(table) {
      assert.equal(table, 'payment_instructions', 'no school, membership, or commitment dependency');
      const q = { insert(row) { saved.push(row); return q; }, update(row) { saved.push(row); return q; }, select() { return q; }, eq() { return q; }, single: async () => ({ data: { id: 'instruction-1' } }), then(resolve) { return Promise.resolve({ error: null }).then(resolve); } };
      return q;
    }};
    const provider = async (path, options) => {
      calls.push([path, JSON.parse(options.body)]);
      return { status: true, data: path === '/plan' ? { plan_code: 'plan-1' } : { authorization_url: 'https://checkout.paystack.com/test', reference: 'ref-1' } };
    };
    const auth = { user: { id: 'owner', email: 'donor@example.com' }, supabase: db };
    const result = await route('app/api/payments/initialize/route.ts', auth, db, provider)({ json: async () => ({ kind, consent: true, amountCents: 2350, termMonths: 6 }), nextUrl: { origin: 'https://www.skolosaka.co.za' } });
    assert.equal(result.status, 200);
    assert.equal(result.body.authorizationUrl, 'https://checkout.paystack.com/test');
    assert.equal(saved[0].amount_cents, 2350);
    assert.equal(saved[0].user_id, 'owner');
    const checkout = calls.find(c => c[0] === '/transaction/initialize')[1];
    assert.equal(checkout.amount, 2350);
    assert.equal(checkout.callback_url, 'https://www.skolosaka.co.za/payment/complete');
    assert.equal(checkout.metadata.payment_instruction_id, 'instruction-1');
    assert.equal(checkout.plan, kind === 'recurring' ? 'plan-1' : undefined);
    assert.equal(calls.length, kind === 'recurring' ? 2 : 1);
    if (kind === 'recurring') assert.equal(calls[0][1].invoice_limit, 6);
  });
}

test('school-free checkout rejects invalid amounts and missing consent before database or provider calls', async () => {
  const post = route('app/api/payments/initialize/route.ts', { user: { id: 'owner' } }, null);
  for (const amountCents of [0, 999, 1000.1, 100_000_001, '1000', null]) {
    assert.equal((await post(request({ kind: 'one_off', consent: true, amountCents }))).status, 400);
  }
  assert.equal((await post(request({ kind: 'one_off', amountCents: 1000 }))).status, 400);
});

test('provider failure leaves no active unallocated donation', async () => {
  const patches=[];
  const db={from(table){
    const q={insert(){return q;},select(){return q;},single:async()=>({data:{id:'i'}}),update(row){patches.push([table,row]);return q;},eq(){return q;},then(resolve){return Promise.resolve({error:null}).then(resolve);}};
    return q;
  }};
  const post=route('app/api/payments/initialize/route.ts',{user:{id:'owner',email:'donor@example.com'}},db,async()=>{throw new Error('Provider unavailable');});
  const result=await post({json:async()=>({kind:'one_off',consent:true,amountCents:1000}),nextUrl:{origin:'https://www.skolosaka.co.za'}});
  assert.equal(result.status,500);
  assert.equal(result.body.error,'Provider unavailable');
  assert.ok(patches.some(([table,row])=>table==='payment_instructions'&&row.status==='failed'));
  assert.ok(!patches.some(([,row])=>row.status==='active'));
});

test('active monthly donation without schools cancels through Paystack',async()=>{
 const exports={},calls=[],patches=[];
 const code=ts.transpileModule(readFileSync('app/api/payments/cancel/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const db={from(table){assert.equal(table,'payment_instructions');const q={update(row){patches.push(row);return q;},eq(){return q;},then(resolve){return Promise.resolve({error:null}).then(resolve);}};return q;}};
 vm.runInNewContext(code,{exports,Date,Error,require(name){
   if(name==='next/server')return{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}};
   if(name.includes('payment-instructions-server'))return{
    authenticatedUser:async()=>({user:{id:'owner'}}),
    fetchInstruction:async()=>({id:'i',user_id:'owner',kind:'recurring',status:'active',provider_subscription_code:'sub',provider_email_token:'token'}),
    disablePaystackSubscription:async(...args)=>{calls.push(args);},
    instructionAllocations:async()=>{throw new Error('Cancellation must not depend on schools');}
   };
   return{adminSupabase:()=>db};
 }});
 const result=await exports.POST(request({instructionId:'i'}));
 assert.equal(result.status,200);assert.equal(result.body.status,'non_renewing');
 assert.equal(calls.length,1);assert.equal(calls[0][0],'sub');
 assert.equal(patches[0].status,'non_renewing');
});
