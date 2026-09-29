import type {Match,MatchEvent,Team} from './sports';
export type PlayerBadge={id:string;label:string;detail:string;count:number};
export function playerBadges(playerId:string,teams:Team[],matches:Match[],events:MatchEvent[]):PlayerBadge[]{
 const badges:PlayerBadge[]=[];
 if(teams.length)badges.push({id:'team',label:'Team player',detail:teams.map(t=>t.name).join(' · '),count:teams.length});
 const sports=new Set(teams.map(t=>t.sport));
 if(sports.size>1)badges.push({id:'multi',label:'Multi-sport athlete',detail:'Representing teams in more than one sport',count:sports.size});
 const official=new Set(matches.filter(m=>m.status==='official').map(m=>m.id));
 const awards=matches.filter(m=>m.status==='official'&&m.player_of_match_id===playerId).length;
 if(awards)badges.push({id:'potm',label:'Player of the Match',detail:'Awarded on independently confirmed results',count:awards});
 const goals=events.filter(e=>e.player_id===playerId&&official.has(e.match_id)&&['goal','netball_goal'].includes(e.event_type)).length;
 if(goals)badges.push({id:'scorer',label:'Goalscorer',detail:'Recorded goals in confirmed matches',count:goals});
 return badges;
}
