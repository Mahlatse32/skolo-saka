import {test} from 'node:test';
import assert from 'node:assert/strict';
import {standings} from '../lib/sports.ts';
test('sports log excludes unconfirmed results and ranks confirmed wins and draws',()=>{
 const teams=[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}];
 const matches=[{home_team_id:'a',away_team_id:'b',status:'official',home_score:2,away_score:0},{home_team_id:'b',away_team_id:'c',status:'official',home_score:1,away_score:1},{home_team_id:'c',away_team_id:'a',status:'pending_confirmation',home_score:9,away_score:0}];
 const rows=standings(teams,matches);assert.deepEqual(rows.map(r=>[r.id,r.played,r.points]),[['a',1,3],['c',1,1],['b',2,1]]);
});
