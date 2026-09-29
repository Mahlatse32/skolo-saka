import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
function load(env) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(readFileSync('lib/payment-environment.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {exports,process:{env}});
 return exports;
}
const prod = { NEXT_PUBLIC_SUPABASE_URL:'https://nnexzxszqjedaqqukfiq.supabase.co', PAYSTACK_SECRET_KEY:'sk_live_example', VERCEL_ENV:'production' };
const uat = { NEXT_PUBLIC_SUPABASE_URL:'https://faytrobauwibxujvmbct.supabase.co', PAYSTACK_SECRET_KEY:'sk_test_example' };
test('production rejects missing, malformed and test keys',()=>{
 for(const key of ['', 'invalid', 'sk_test_example']) assert.equal(load({...prod,PAYSTACK_SECRET_KEY:key}).paymentMode(),'unavailable');
});
test('production accepts a live key and canonical callback',()=>{
 const config=load(prod).paymentConfiguration(); assert.equal(config.mode,'live');assert.equal(config.origin,'https://www.skolosaka.co.za');
});
test('preview and UAT cannot charge the production database',()=>{
 for(const env of [{VERCEL_ENV:'preview'},{VERCEL_GIT_COMMIT_REF:'uat'},{VERCEL_PROJECT_ID:'prj_EIjAps6uY5VAfnbkb2IlTulDJks6'}]) assert.equal(load({...prod,...env}).paymentMode(),'unavailable');
});
test('test database rejects live keys and unknown databases fail closed',()=>{
 assert.equal(load({...uat,PAYSTACK_SECRET_KEY:'sk_live_example'}).paymentMode(),'unavailable');
 assert.equal(load({...prod,NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co'}).paymentMode(),'unavailable');
 assert.equal(load({...uat,VERCEL_PROJECT_ID:'prj_P0ZKFWbWTgqGkdaTy5Lvyw31ikwp'}).paymentMode(),'unavailable');
});
test('UAT test checkout stays in UAT and bad callback config blocks checkout',()=>{
 assert.equal(load(uat).paymentConfiguration().origin,'https://skolo-saka-uat.vercel.app');
 for(const env of [prod,uat]) assert.equal(load({...env,NEXT_APP_URL:'http://localhost:3000'}).paymentMode(),'unavailable');
});
