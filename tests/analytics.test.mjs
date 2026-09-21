import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanAnalyticsProperties, deviceType, sanitiseAnalyticsPath } from '../lib/analytics.ts';

test('analytics paths remove identifiers and unknown query parameters',()=>{
  assert.equal(sanitiseAnalyticsPath('/school/7b233b7f-1bca-4f6a-8837-084d8b645b24?email=private@example.com'),'/school/:id');
  assert.equal(sanitiseAnalyticsPath('/?view=schools&phone=0821234567'),'/?view=schools');
  assert.equal(sanitiseAnalyticsPath('/payments?reference=secret'),'/payments');
});

test('analytics properties are bounded and device types are coarse',()=>{
  assert.deepEqual(cleanAnalyticsProperties({kind:'recurring',email:'x'.repeat(100),'bad-key':'no'}),{kind:'recurring',email:'x'.repeat(80)});
  assert.equal(deviceType('Mozilla/5.0 (iPhone; CPU iPhone OS)'), 'mobile');
  assert.equal(deviceType('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop');
});
