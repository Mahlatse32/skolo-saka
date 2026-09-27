export type Team={id:string;school_id:string;sport:string;name:string;age_group:string;gender:string;season_year:number};
export type Match={id:string;home_team_id:string;away_team_id:string;starts_at:string;venue:string;status:string;home_score:number|null;away_score:number|null;player_of_match_id:string|null};
export type Player={id:string;school_id:string;first_name:string;last_name:string;position:string|null;public_age:number|null};
export type MatchEvent={id:string;match_id:string;team_id:string;player_id:string|null;event_type:string;minute:number|null};
export function standings(teams:Team[],matches:Match[]){
 const rows=new Map(teams.map(t=>[t.id,{...t,played:0,won:0,drawn:0,lost:0,for:0,against:0,points:0}]));
 for(const m of matches){if(m.status!=='official'||m.home_score===null||m.away_score===null)continue;
 const h=rows.get(m.home_team_id),a=rows.get(m.away_team_id);if(!h||!a)continue;
 h.played++;a.played++;h.for+=m.home_score;h.against+=m.away_score;a.for+=m.away_score;a.against+=m.home_score;
 if(m.home_score===m.away_score){h.drawn++;a.drawn++;h.points++;a.points++;}else{const winner=m.home_score>m.away_score?h:a,loser=winner===h?a:h;winner.won++;winner.points+=3;loser.lost++;}}
 return [...rows.values()].sort((a,b)=>b.points-a.points||(b.for-b.against)-(a.for-a.against)||b.for-a.for||a.name.localeCompare(b.name));
}
