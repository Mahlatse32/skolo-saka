import {test} from 'node:test';import assert from 'node:assert/strict';
import {canManageTeam} from '../lib/sports-access.ts';import {validUatRegistration} from '../lib/uat-registration.ts';
const r=(role,school_id=null,team_id=null,active=true)=>({user_id:'u',role,school_id,team_id,active});
test('multi-school manager is restricted to assigned schools; coaches to assigned teams',()=>{
 const roles=[r('school_admin','a'),r('school_admin','b')];assert.equal(canManageTeam(roles,{id:'t',school_id:'a'}),true);assert.equal(canManageTeam(roles,{id:'t',school_id:'b'}),true);assert.equal(canManageTeam(roles,{id:'t',school_id:'c'}),false);
 assert.equal(canManageTeam([r('coach','a','t')],{id:'other',school_id:'a'}),false);assert.equal(canManageTeam([r('coach','a','t')],{id:'t',school_id:'a'}),true);assert.equal(canManageTeam([r('super_admin',null,null,false)],{id:'t',school_id:'a'}),false);
});
test('UAT registration admits only bounded synthetic identities and fixed test code',()=>{
 const b={phone:'+27600000001',password:'Ss!'+('a'.repeat(64)),code:'123456'};assert.equal(validUatRegistration(b),true);assert.equal(validUatRegistration({...b,phone:'+27614590028'}),false);assert.equal(validUatRegistration({...b,code:'000000'}),false);assert.equal(validUatRegistration({...b,password:'1234'}),false);assert.equal(validUatRegistration({...b,phone:'+27600000100'}),false);
});
