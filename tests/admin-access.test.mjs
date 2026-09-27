import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { hasSportsAdminRole, canManageTeam } from '../lib/sports-access.ts';

function route(file, { signedIn = true, roles = [], platform = false, failed = false } = {}) {
  const calls = [];
  const db = {
    from(table) {
      const result = { data: table === 'platform_admins' ? (platform ? { user_id: 'u' } : null) : roles, error: failed ? { message: 'unavailable' } : null };
      const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => result, then(resolve) { return Promise.resolve(result).then(resolve); } };
      return query;
    },
    rpc: async (name) => { calls.push(name); return { data: { saved: true }, error: null }; },
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'u' } : null }, error: null }) },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (name === 'next/server') return { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
    if (name.includes('sports-access')) return { hasSportsAdminRole, canManageTeam };
    if (name.includes('payment-instructions-server')) return { authenticatedUser: async () => signedIn ? { user: { id: 'u' }, supabase: db } : null };
    return { adminSupabase: () => db, serverSupabase: () => db };
  } });
  return { ...exports, calls };
}
const request = (area = 'analytics') => ({
  headers: new Headers({ authorization: 'Bearer valid-session' }),
  nextUrl: new URL(`https://example.test/api/admin/access?area=${area}`),
  json: async () => ({ action: 'grant', payload: { role: 'super_admin', user_id: 'u' } }),
});
const role = (role, school_id = null, team_id = null, active = true) => ({ user_id: 'u', role, school_id, team_id, active });

test('admin entry rejects signed-out users and ordinary accounts in both areas', async () => {
  for (const area of ['analytics', 'sports']) {
    assert.equal((await route('app/api/admin/access/route.ts', { signedIn: false }).GET(request(area))).status, 401);
    assert.equal((await route('app/api/admin/access/route.ts').GET(request(area))).status, 403);
  }
});
test('sports assignments never imply analytics permissions', async () => {
  for (const assignment of [role('super_admin'), role('school_admin', 's'), role('coach', 's', 't')]) {
    const api = route('app/api/admin/access/route.ts', { roles: [assignment] });
    assert.equal((await api.GET(request('sports'))).status, 200);
    assert.equal((await api.GET(request('analytics'))).status, 403);
  }
  assert.equal((await route('app/api/admin/access/route.ts', { platform: true }).GET(request())).status, 200);
});
test('revoked, unknown and incomplete sports assignments fail closed', async () => {
  for (const assignment of [role('super_admin', null, null, false), role('match_official'), role('school_admin'), role('coach', 's')]) {
    assert.equal((await route('app/api/admin/access/route.ts', { roles: [assignment] }).GET(request('sports'))).status, 403);
  }
  assert.equal((await route('app/api/admin/access/route.ts', { failed: true }).GET(request())).status, 503);
});
test('analytics API never calls reporting RPC for a non-admin or role lookup failure', async () => {
  for (const options of [{ signedIn: false }, {}, { failed: true }, { roles: [role('super_admin')] }]) {
    const api = route('app/api/admin/analytics/route.ts', options);
    assert.ok([401, 403, 503].includes((await api.GET(request())).status));
    assert.equal(api.calls.length, 0);
  }
  const admin = route('app/api/admin/analytics/route.ts', { platform: true });
  assert.equal((await admin.GET(request())).status, 200);
  assert.deepEqual(admin.calls, ['platform_analytics_summary']);
});
test('direct sports POST rejects unassigned and revoked users before mutation RPC', async () => {
  for (const options of [{ signedIn: false }, {}, { roles: [role('super_admin', null, null, false)] }, { failed: true }]) {
    const api = route('app/api/sports/admin/route.ts', options);
    assert.ok([401, 403, 503].includes((await api.POST(request())).status));
    assert.equal(api.calls.length, 0);
  }
});
