import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const school = '11111111-1111-4111-8111-111111111111';
const context = { params: Promise.resolve({ id: school }) };
const request = (query = '', body = {}) => ({ nextUrl: new URL(`https://www.skolosaka.co.za/api/schools/${school}/community${query}`), json: async () => body });
const cohort = { id: 'membership', grade_left: 7, graduation_year: 2007 };
function setup({ signedIn = true, membership = cohort } = {}) {
  const filters = [], orders = [], writes = [];
  let privilegedCalls = 0;
  const own = { from() { const q = { select() { return q; }, eq(...args) { filters.push(['own', ...args]); return q; }, update(row) { writes.push(row); return q; }, maybeSingle: async () => ({ data: membership }) }; return q; } };
  const others = { from(table) {
    assert.equal(table, 'school_memberships');
    privilegedCalls++;
    const q = { select(fields) { assert.ok(!fields.includes('phone') && !fields.includes('email')); return q; }, eq(...args) { filters.push(['others', ...args]); return q; }, neq(...args) { filters.push(['exclude', ...args]); return q; }, order(...args) { orders.push(args); return q; }, range: async (start, end) => ({ count: 23, data: Array.from({ length: 23 }, (_, i) => ({ id: `member-${i}`, grade_left: 7, graduation_year: 2007, profiles: { first_name: 'Alumni', last_name: String(i), phone: 'private', email: 'private' } })).slice(start, end + 1) }) }; return q;
  }};
  const exports = {};
  const code = ts.transpileModule(readFileSync('app/api/schools/[id]/community/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Date, require(name) {
    if (name === 'next/server') return { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200, headers: options?.headers }) } };
    if (name.includes('payment-instructions-server')) return { authenticatedUser: async () => signedIn ? { user: { id: 'caller' }, supabase: own } : null };
    return { adminSupabase: () => others };
  }});
  return { ...exports, filters, orders, writes, calls: () => privilegedCalls };
}
test('anonymous users and non-members cannot retrieve names', async () => {
 for (const [options, expected] of [[{signedIn:false},401],[{membership:null},403]]) {
  const api=setup(options); const r=await api.GET(request(),context);
  assert.equal(r.status,expected); assert.equal(api.calls(),0);
 }
});
test('classmates match exact school, grade and year, excluding caller', async () => {
 const api=setup();const r=await api.GET(request(),context);
 assert.equal(r.status,200);assert.equal(r.body.items.length,10);assert.equal(r.body.total,23);
 for(const filter of [['others','school_id',school],['others','role','alumnus'],['others','grade_left',7],['others','graduation_year',2007],['exclude','user_id','caller']]) assert.ok(api.filters.some(f=>JSON.stringify(f)===JSON.stringify(filter)));
 assert.deepEqual(Object.keys(r.body.items[0]).sort(),['grade','id','name','year']);
 assert.equal(r.headers['Cache-Control'],'private, no-store');
});
test('schoolmates span years and pages contain distinct groups of ten', async () => {
 const api=setup(); const r=await api.GET(request('?mode=schoolmates&page=2'),context);
 assert.equal(r.body.items.length,10); assert.equal(r.body.items[0].id,'member-10');
 assert.ok(!api.filters.some(f=>f[0]==='others'&&['grade_left','graduation_year'].includes(f[1])));
 assert.equal(api.orders[0][0],'created_at'); assert.equal(api.orders[1][0],'id');
 const last=await api.GET(request('?mode=schoolmates&page=3'),context);
 assert.equal(last.body.items.length,3);
});
test('missing cohort does not accidentally return everyone as classmates',async()=>{
 const api=setup({membership:{...cohort,grade_left:null}});const r=await api.GET(request(),context);
 assert.equal(r.body.needsDetails,true);assert.equal(r.body.items.length,0);assert.equal(api.calls(),0);
});
test('invalid page and mode are rejected',async()=>{
 for(const query of ['?page=0','?page=1.5','?page=10001','?mode=staff']) {
  const api=setup();assert.equal((await api.GET(request(query),context)).status,400);assert.equal(api.calls(),0);
 }
});
test('attendance edits are validated and restricted to the caller membership',async()=>{
 const api=setup(); const saved=await api.PATCH(request('',{grade:7,year:2007,user_id:'other'}),context);
 assert.equal(saved.status,200);assert.equal(api.writes[0].grade_left,7);assert.equal(api.writes[0].graduation_year,2007);
 assert.ok(api.filters.some(f=>f[0]==='own'&&f[1]==='user_id'&&f[2]==='caller'));assert.equal(api.calls(),0);
 for(const body of [{grade:13,year:2007},{grade:7,year:1800},{grade:7,year:2200}]) assert.equal((await api.PATCH(request('',body),context)).status,400);
 assert.equal(api.writes.length,1);
});
