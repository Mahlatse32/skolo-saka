import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {passwordError,hasPasswordCredential,hasRecentResetProof} from '../lib/password-auth.ts';
import {createPasswordProof,verifyPasswordProof} from '../lib/password-proof.ts';

function load(path,modules){
  const exports={};
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,Date,Number,Error,TextEncoder,process,require(name){if(!(name in modules))throw new Error('Unexpected import '+name);return modules[name];}});
  return exports;
}
const next={NextResponse:{json(body,options){return{body,status:options?.status||200,cookies:{set(){}}};}}};
const strong='river school garden 42!';
const owner={id:'owner',phone:'+27821234567',email:'owner@example.com',email_confirmed_at:'2026-01-01',app_metadata:{credential_version:'password_v2'}};
const policies={passwordError,hasPasswordCredential,hasRecentResetProof,PASSWORD_CREDENTIAL_VERSION:'password_v2'};

test('password policy accepts passphrases and rejects short, numeric, repeated and legacy PIN credentials',()=>{
  assert.equal(passwordError(strong),null);
  for(const candidate of ['1234','123456789012','aaaaaaaaaaaa','password1234','Ss!'+'a'.repeat(64),'😀'.repeat(19)])assert.ok(passwordError(candidate));
  assert.equal(hasPasswordCredential({app_metadata:{},user_metadata:{credential_version:'password_v2'}}),false);
  assert.equal(hasPasswordCredential(owner),true);
});

test('reset claims require a recent OTP/recovery event rather than password or email-change sign-in',()=>{
  const now=2_000_000;
  for(const method of ['otp','recovery'])assert.equal(hasRecentResetProof({amr:[{method,timestamp:1999}]},now),true);
  for(const entry of [{method:'password',timestamp:1999},{method:'email_change',timestamp:1999},{method:'otp',timestamp:1000},{method:'recovery',timestamp:2200}])assert.equal(hasRecentResetProof({amr:[entry]},now),false);
});

test('SMS setup proof is signed, expires and is bound to the account, original phone and session',()=>{
  const before=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY='unit-test-only-proof-key';
  try{
    const expected={sub:'owner',sessionId:'verified-session',phone:'+27821234567'};
    const proof=createPasswordProof(expected,1000);
    assert.equal(verifyPasswordProof(proof,expected,2000),true);
    for(const patch of [{sub:'attacker'},{sessionId:'other-session'},{phone:'+27829876543'}])assert.equal(verifyPasswordProof(proof,{...expected,...patch},2000),false);
    assert.equal(verifyPasswordProof(proof,expected,601000),false);
    assert.equal(verifyPasswordProof(proof+'x',expected,2000),false);
    assert.equal(verifyPasswordProof(undefined,expected,2000),false);
  }finally{if(before===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=before;}
});

function setupRoute({user=owner,claims,proof=false,profile={phone:owner.phone,email:owner.email},updateError=null,markerError=null}={}){
  const calls=[];
  const client={auth:{getUser:async()=>({data:{user}}),getClaims:async()=>({data:{claims}}),updateUser:async args=>{calls.push(['password',args]);return{error:updateError};}}};
  const db={from(){return{select(){return this;},eq(){return this;},maybeSingle:async()=>({data:profile})};},auth:{admin:{updateUserById:async(id,args)=>{calls.push(['password',id,args]);return{error:updateError||markerError};},signOut:async(token,scope)=>{calls.push(['revoke',scope]);return{};}}}};
  const route=load('app/api/auth/password/route.ts',{'next/server':next,'@/lib/paystack-server':{serverSupabase:()=>client,adminSupabase:()=>db},'@/lib/password-auth':policies,'@/lib/pin-auth':{normalizeSaPhone:value=>'+'+value.replace(/\D/g,'')},'@/lib/password-proof':{PASSWORD_PROOF_COOKIE:'proof',verifyPasswordProof:()=>proof}}).POST;
  return{calls,post:body=>route({headers:{get:()=>user?'Bearer session':null},cookies:{get:()=>({value:'proof'})},json:async()=>body})};
}
const recent=method=>({sub:'owner',session_id:'s',amr:[{method,timestamp:Date.now()/1000}]});

test('password setup rejects signed-out, ordinary, email-change, unproved email OTP and mismatched-account sessions',async()=>{
  for(const args of [{user:null},{claims:recent('password')},{claims:recent('email_change')},{claims:recent('otp')},{claims:{...recent('recovery'),sub:'attacker'}}]){
    const route=setupRoute(args);assert.ok([401,403].includes((await route.post({password:strong})).status));assert.equal(route.calls.length,0);
  }
});

test('password setup rejects wrong original phone and replacement recovery email on legacy accounts',async()=>{
  for(const args of [{claims:recent('otp'),proof:true,profile:{phone:'+27829876543',email:owner.email}},{user:{...owner,app_metadata:{}},claims:recent('recovery'),profile:{phone:owner.phone,email:'different@example.com'}}]){
    const route=setupRoute(args);assert.equal((await route.post({password:strong})).status,403);assert.equal(route.calls.length,0);
  }
});

test('verified SMS and saved recovery email can set a password, mark credentials and revoke other sessions',async()=>{
  for(const args of [{claims:recent('otp'),proof:true},{claims:recent('recovery'),user:{...owner,app_metadata:{}}}]){
    const route=setupRoute(args);assert.equal((await route.post({password:strong})).status,200);
    assert.equal(route.calls[0][0],'password');assert.equal(route.calls[0][2].app_metadata.credential_version,'password_v2');assert.equal(route.calls[0][2].password,strong);assert.deepEqual(route.calls[1],['revoke','others']);
  }
});

test('weak passwords and failed Auth updates never mark an account as upgraded',async()=>{
  const weak=setupRoute({claims:recent('otp'),proof:true});assert.equal((await weak.post({password:'1234'})).status,400);assert.equal(weak.calls.length,0);
  const failed=setupRoute({claims:recent('otp'),proof:true,updateError:{message:'rejected'}});assert.equal((await failed.post({password:strong})).status,400);assert.equal(failed.calls.length,1);
});

test('cancellation denies missing or wrong passwords before accessing the database or provider',async()=>{
  for(const password of [undefined,'wrong-password']){
    const calls=[];
    const route=load('app/api/payments/cancel/route.ts',{'next/server':next,'@/lib/paystack-server':{adminSupabase:()=>{calls.push('database');throw new Error('Unexpected database access');}},'@/lib/payment-instructions-server':{authenticatedUser:async()=>({user:owner})},'@/lib/password-server':{confirmAccountPassword:async(user,value)=>{assert.equal(user.id,'owner');assert.equal(value,password);return false;}}}).POST;
    assert.equal((await route({json:async()=>({instructionId:'i',password})})).status,403);assert.deepEqual(calls,[]);
  }
});

test('password confirmation accepts only the authenticated account and signs out the verification session locally',async()=>{
  for(const id of ['owner','attacker']){
    const scopes=[];
    const verifier={auth:{signInWithPassword:async credentials=>{assert.equal(credentials.phone,owner.phone);return{data:{user:{...owner,id},session:{}}};},signOut:async args=>{scopes.push(args.scope);return{};}}};
    const helper=load('lib/password-server.ts',{'./paystack-server':{serverSupabase:()=>verifier},'./password-auth':policies});
    assert.equal(await helper.confirmAccountPassword(owner,strong),id==='owner');assert.deepEqual(scopes,['local']);
    assert.equal(await helper.confirmAccountPassword({...owner,app_metadata:{}},strong),false);
  }
});

test('API authentication rejects pre-upgrade JWTs even after the current user has a password marker',async()=>{
  const client={auth:{getUser:async()=>({data:{user:owner}}),getClaims:async()=>({data:{claims:{sub:'owner',app_metadata:{}}}})}};
  const helper=load('lib/payment-instructions-server.ts',{'@/lib/paystack-server':{serverSupabase:()=>client},'@/lib/password-auth':policies});
  assert.equal(await helper.authenticatedUser({headers:{get:()=> 'Bearer old-session'}}),null);
  client.auth.getClaims=async()=>({data:{claims:{sub:'owner',app_metadata:{credential_version:'password_v2'}}}});
  assert.equal((await helper.authenticatedUser({headers:{get:()=> 'Bearer new-session'}})).user.id,'owner');
});

test('SMS verification binds a secure HttpOnly setup cookie to the verified account/session',async()=>{
  const cookies=[];let payload;
  const response={NextResponse:{json(body,options){return{body,status:options?.status||200,cookies:{set(...args){cookies.push(args);}}};}}};
  const client={auth:{verifyOtp:async args=>{assert.equal(args.type,'sms');return{data:{user:owner,session:{access_token:'verified-token',refresh_token:'refresh'}}};},getClaims:async()=>({data:{claims:{sub:owner.id,session_id:'verified-session'}}})}};
  const db={from(){return{select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{phone:owner.phone}})};}};
  const route=load('app/api/auth/phone-verify/route.ts',{'next/server':response,'@/lib/paystack-server':{serverSupabase:()=>client,adminSupabase:()=>db},'@/lib/pin-auth':{normalizeSaPhone:value=>'+'+value.replace(/\D/g,'')},'@/lib/password-proof':{PASSWORD_PROOF_COOKIE:'proof',createPasswordProof:args=>{payload=args;return'signed-proof';}}}).POST;
  const result=await route({json:async()=>({phone:owner.phone,code:'123456'})});
  assert.equal(result.status,200);assert.equal(payload.sub,owner.id);assert.equal(payload.sessionId,'verified-session');
  assert.equal(cookies[0][2].httpOnly,true);assert.equal(cookies[0][2].secure,true);assert.equal(cookies[0][2].sameSite,'strict');assert.equal(cookies[0][2].path,'/api/auth/password');
  client.auth.verifyOtp=async()=>({error:{message:'bad code'},data:{}});
  assert.equal((await route({json:async()=>({phone:owner.phone,code:'123456'})})).status,400);assert.equal(cookies.length,1);
});
