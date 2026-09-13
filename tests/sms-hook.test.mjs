import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { handleSmsHook } from '../lib/sms-hook.ts';

const key = Buffer.alloc(32, 7);
const secret = `v1,whsec_${key.toString('base64')}`;
function request(payload = { user: { phone: '+27821234567' }, sms: { otp: '123456' } }, age = 0, tampered = false) {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000) - age);
  const signature = createHmac('sha256', key).update(`test-id.${timestamp}.${body}`).digest('base64');
  return new Request('https://example.org/api/auth/send-sms', { method: 'POST', body: tampered ? body + ' ' : body, headers: {
    'webhook-id': 'test-id', 'webhook-timestamp': timestamp, 'webhook-signature': `v1,${signature}`,
  } });
}
test('signed Supabase code is sent as one segment to WinSMS', async () => {
  let calls = 0;
  const response = await handleSmsHook(request(), { secret, apiKey: 'test-key', send: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.winsms.co.za/api/rest/v1/sms/outgoing/send');
    assert.equal(options.headers.Authorization, 'test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.recipients[0].mobileNumber, '27821234567');
    assert.equal(body.maxSegments, 1);
    assert.match(body.message, /123456/);
    return Response.json({ recipientResults: [{ accepted: true }] });
  } });
  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {});
});
test('tampered, expired and foreign-number requests never call WinSMS', async () => {
  for (const input of [request(undefined, 0, true), request(undefined, 301), request({user:{phone:'+14155552671'},sms:{otp:'123456'}})]) {
    const response = await handleSmsHook(input, { secret, apiKey: 'test', send: async () => { assert.fail('must not send'); } });
    assert.ok([400, 401].includes(response.status));
  }
});
test('missing configuration fails closed', async () => {
  assert.equal((await handleSmsHook(request(), {})).status, 503);
});
test('recipient rejection, HTTP errors and timeout are not reported as sent', async () => {
  for (const send of [async()=>Response.json({recipientResults:[{accepted:false}]}), async()=>Response.json({}, {status:401}), async()=>{throw new Error('timeout');}]) {
    assert.equal((await handleSmsHook(request(), {secret,apiKey:'test',send})).status, 502);
  }
});
