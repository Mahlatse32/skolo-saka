import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playerBadges} from '../lib/player-badges.ts';
test('badges use confirmed records and the selected player only',()=>{
 const matches=[{id:'a',status:'official',player_of_match_id:'p'},{id:'b',status:'pending_confirmation',player_of_match_id:'p'}];
 const events=[{player_id:'p',match_id:'a',event_type:'goal'},{player_id:'p',match_id:'b',event_type:'goal'},{player_id:'other',match_id:'a',event_type:'goal'}];
 const badges=playerBadges('p',[{name:'A',sport:'football'},{name:'B',sport:'netball'}],matches,events);
 assert.deepEqual(badges.map(b=>[b.id,b.count]),[['team',2],['multi',2],['potm',1],['scorer',1]]);
 assert.deepEqual(playerBadges('nobody',[],matches,events),[]);
});
