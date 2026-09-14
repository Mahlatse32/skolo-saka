import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const exports = {};
const code = ts.transpileModule(readFileSync('lib/payment-instructions-server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInNewContext(code,{exports,require:()=>({}),Date});
const instruction={id:'i',user_id:'u',kind:'recurring',amount_cents:2000,currency:'ZAR',status:'active'};
function database(allocations = [{school_id:'s1',amount_cents:1000,commitment_id:'c1'},{school_id:'s2',amount_cents:1000,commitment_id:'c2'}]){
 const writes=[];
 return {writes,from(table){
   const q={select(){return q;},eq(...args){writes.push(['filter',table,...args]);return q;},neq(){return q;},not(...args){writes.push(['not',table,...args]);return q;},order(){return Promise.resolve({data:allocations});},upsert(row){writes.push(['upsert',table,row]);return Promise.resolve({error:null});},update(row){writes.push(['update',table,row]);return q;},then(resolve){return Promise.resolve({error:null}).then(resolve);}};
   return q;
 }};
}
test('amount and currency mismatch never write money',async()=>{
 for(const [amount,currency] of [[1000,'ZAR'],[2000,'USD']]){
  const db=database();await assert.rejects(exports.recordInstructionCharge({db,instruction,reference:'r',amount,currency}));assert.equal(db.writes.length,0);
 }
});
test('repeated callbacks use stable per-school references',async()=>{
 const db=database();
 for(let i=0;i<2;i++) await exports.recordInstructionCharge({db,instruction,reference:'r',amount:2000,currency:'ZAR'});
 assert.deepEqual(db.writes.filter(w=>w[0]==='upsert').map(w=>w[2].external_reference),['r:s1','r:s2','r:s1','r:s2']);
});
test('late success on cancelled arrangement records money without reactivating commitments',async()=>{
 const db=database();await exports.recordInstructionCharge({db,instruction:{...instruction,status:'cancelled'},reference:'r',amount:2000,currency:'ZAR'});
 assert.equal(db.writes.filter(w=>w[0]==='update'&&w[1]==='commitments').length,0);
 assert.ok(db.writes.some(w=>w[0]==='not'&&w[1]==='payment_instructions'&&w[4].includes('cancelled')));
});

for (const kind of ['one_off', 'recurring']) {
 test(`${kind} unallocated donations record the full amount with an idempotent reference`, async () => {
  const db=database([]);
  for(let i=0;i<2;i++) await exports.recordInstructionCharge({db,instruction:{...instruction,kind},reference:'unallocated-test',amount:2000,currency:'ZAR'});
  const receipts=db.writes.filter(w=>w[0]==='upsert').map(w=>w[2]);
  assert.equal(receipts.length,2);
  for(const row of receipts){
   assert.equal(row.school_id,null); assert.equal(row.commitment_id,null);
   assert.equal(row.user_id,'u'); assert.equal(row.amount_cents,2000);
   assert.equal(row.external_reference,'unallocated-test:unallocated');
  }
  assert.equal(db.writes.filter(w=>w[0]==='update'&&w[1]==='commitments').length,0);
  assert.equal(db.writes.find(w=>w[0]==='update'&&w[1]==='payment_instructions')[2].status,kind==='one_off'?'completed':'active');
 });
}
test('partial allocations remain invalid instead of silently losing money',async()=>{
 const db=database([{school_id:'s1',amount_cents:1000,commitment_id:null}]);
 await assert.rejects(exports.recordInstructionCharge({db,instruction,reference:'r',amount:2000,currency:'ZAR'}));
 assert.equal(db.writes.filter(w=>w[0]==='upsert').length,0);
});
