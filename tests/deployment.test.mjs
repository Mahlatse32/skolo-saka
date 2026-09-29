import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicationOrigin, checkedPaystackSecret } from '../lib/deployment.ts';

test('UAT rejects live payment keys and production callback URLs', () => {
  const before = { ...process.env };
  try {
    process.env.VERCEL_GIT_COMMIT_REF = 'uat';
    process.env.NEXT_APP_URL = 'https://www.skolosaka.co.za';
    assert.throws(() => applicationOrigin(), /UAT callbacks/);
    assert.throws(() => checkedPaystackSecret('sk_live_fixture'), /test key/);
    process.env.NEXT_APP_URL = 'https://skolo-saka-uat.vercel.app';
    assert.equal(applicationOrigin(), process.env.NEXT_APP_URL);
    assert.equal(checkedPaystackSecret('sk_test_fixture'), 'sk_test_fixture');
    process.env.NEXT_APP_URL = 'https://user:pass@skolo-saka-uat.vercel.app';
    assert.throws(() => applicationOrigin(), /credentials/);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
