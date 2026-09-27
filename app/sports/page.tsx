'use client';
import {useEffect,useState} from 'react';
import SecondaryShell from '../SecondaryShell';
import {supabase} from '@/lib/supabase';
import {standings,type Team,type Match,type Player,type MatchEvent} from '@/lib/sports';
import './sports.css';
type School={id:string;name:string;municipality:string|null};
const date=(v:string)=>new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Johannesburg'}).format(new Date(v));
export default function SportsPage(){
 const [schools,setSchools]=useState<School[]>([]),[teams,setTeams]=useState<Team[]>([]),[matches,setMatches]=useState<Match[]>([]),[players,setPlayers]=useState<Player[]>([]),[events,setEvents]=useState<MatchEvent[]>([]),[roster,setRoster]=useState<{team_id:string;player_id:string}[]>([]);
 const [school,setSchool]=useState(''),[sport,setSport]=useState('football'),[group,setGroup]=useState(''),[tab,setTab]=useState('Overview'),[player,setPlayer]=useState<string|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[isAdmin,setIsAdmin]=useState(false);
 useEffect(()=>{let active=true;async function load(){try{
 const {data:{user}}=await supabase.auth.getUser();
 if(user){const {data:roles}=await supabase.from('sports_admin_assignments').select('id').eq('user_id',user.id).eq('active',true).limit(1);if(active)setIsAdmin(Boolean(roles?.length));}
 const [s,t,m,p,e,r,membership]=await Promise.all([
 supabase.from('schools').select('id,name,municipality').order('name'),
 supabase.from('sports_teams').select('id,school_id,sport,name,age_group,gender,season_year'),
 supabase.from('sports_matches').select('id,home_team_id,away_team_id,starts_at,venue,status,home_score,away_score,player_of_match_id').in('status',['scheduled','live','pending_confirmation','official']).order('starts_at',{ascending:false}),
 supabase.from('sports_players').select('id,school_id,first_name,last_name,position,public_age').eq('public_profile',true).not('guardian_consent_at','is',null),
 supabase.from('sports_match_events').select('id,match_id,team_id,player_id,event_type,minute'),
 supabase.from('sports_team_players').select('team_id,player_id'),
 user?supabase.from('school_memberships').select('school_id').eq('user_id',user.id).order('created_at').limit(1):Promise.resolve({data:[],error:null})]);
 if([s,t,m,p,e,r,membership].some(r=>r.error))throw new Error('Could not load sports. Please try again.');if(!active)return;
 setSchools(s.data||[]);setTeams(t.data||[]);setMatches(m.data||[]);setPlayers(p.data||[]);setEvents(e.data||[]);setRoster(r.data||[]);
 const preferredSchool=membership.data?.[0]?.school_id;
 setSchool(prev=>prev||(t.data?.some(team=>team.school_id===preferredSchool)?preferredSchool:undefined)||s.data?.find(candidate=>t.data?.some(team=>team.school_id===candidate.id))?.id||s.data?.[0]?.id||'');setError('');
 }catch(err){if(active)setError(err instanceof Error?err.message:'Could not load sports.');}finally{if(active)setLoading(false);}}
 void load();const timer=setInterval(()=>void load(),30000);return()=>{active=false;clearInterval(timer);};},[]);
 const selectedSchool=schools.find(s=>s.id===school),schoolName=(id:string)=>schools.find(s=>s.id===id)?.name||'School';
 const teamMap=new Map(teams.map(t=>[t.id,t])),playerMap=new Map(players.map(p=>[p.id,p]));
 const sportTeams=teams.filter(t=>t.sport===sport),groups=[...new Set(sportTeams.map(t=>`${t.season_year} · ${t.age_group} · ${t.gender}`))].sort().reverse();
 const selectedGroup=groups.includes(group)?group:groups[0];
 const competition=sportTeams.filter(t=>`${t.season_year} · ${t.age_group} · ${t.gender}`===selectedGroup&&(!selectedSchool?.municipality||schools.find(s=>s.id===t.school_id)?.municipality===selectedSchool.municipality));
 const ids=new Set(competition.map(t=>t.id)),districtMatches=matches.filter(m=>ids.has(m.home_team_id)&&ids.has(m.away_team_id));
 const myMatches=districtMatches.filter(m=>teamMap.get(m.home_team_id)?.school_id===school||teamMap.get(m.away_team_id)?.school_id===school);
 const last=myMatches.find(m=>m.status==='official'),potm=last?.player_of_match_id?playerMap.get(last.player_of_match_id):null;
 const visiblePlayers=players.filter(p=>p.school_id===school&&roster.some(r=>r.player_id===p.id&&ids.has(r.team_id)));
 const selectedPlayer=player?playerMap.get(player):null;
 const name=(p:Player)=>`${p.first_name} ${p.last_name}`;
 function playerLink(p:Player){return <button className="sports-link" onClick={()=>setPlayer(p.id)}>{name(p)}</button>;}
 function matchCard(m:Match){return <article className="secondary-card sports-match" key={m.id}><small>{date(m.starts_at)} · {m.venue||'Venue to be confirmed'}</small><h3>{teamMap.get(m.home_team_id)?.name} <strong>{m.status==='scheduled'?'vs':`${m.home_score??0} – ${m.away_score??0}`}</strong> {teamMap.get(m.away_team_id)?.name}</h3><span className="sports-status">{m.status.replace('_',' ')}</span><div>{events.filter(e=>e.match_id===m.id&&['goal','netball_goal'].includes(e.event_type)).map(e=><span className="sports-scorer" key={e.id}>{e.player_id&&playerMap.has(e.player_id)?playerLink(playerMap.get(e.player_id)!):'Scorer'} {e.minute!==null?`${e.minute}′`:''}</span>)}</div></article>;}
 return <SecondaryShell active="sports"><header className="secondary-hero"><div><span className="secondary-eyebrow">School sport</span><h1 className="secondary-title">Your school. Your team.</h1><p className="secondary-lead">Follow the players, the fixtures and the moments that bring your school together.</p></div></header>
 {isAdmin&&<p><a className="sports-link" href="/sports/admin">Manage sports →</a></p>}<div className="sports-controls"><label>School<select value={school} onChange={e=>{setSchool(e.target.value);setPlayer(null);}}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Sport<select value={sport} onChange={e=>setSport(e.target.value)}><option value="football">Football</option><option value="netball">Netball</option><option value="rugby">Rugby</option></select></label>{groups.length>0&&<label>Competition group<select value={selectedGroup} onChange={e=>setGroup(e.target.value)}>{groups.map(g=><option key={g}>{g}</option>)}</select></label>}</div>
 {loading?<p role="status">Loading school sport…</p>:error?<p role="alert">{error}</p>:<>
 <nav className="project-filter" aria-label="Sports sections">{['Overview','Fixtures','Results','Log','Players'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>{setTab(x);setPlayer(null);}}>{x}</button>)}</nav>
 {selectedPlayer?<section className="secondary-card"><button className="sports-link" onClick={()=>setPlayer(null)}>← Back to sport</button><p className="secondary-eyebrow">Player profile</p><h2>{name(selectedPlayer)}</h2><p>{schoolName(selectedPlayer.school_id)} · {selectedPlayer.position||'Player'}</p><p>{selectedPlayer.public_age?`Age ${selectedPlayer.public_age}`:''}</p><p>{events.filter(e=>e.player_id===selectedPlayer.id&&['goal','netball_goal'].includes(e.event_type)&&matches.some(m=>m.id===e.match_id&&m.status==='official')).length} recorded goals · {matches.filter(m=>m.status==='official'&&m.player_of_match_id===selectedPlayer.id).length} Player of the Match awards</p></section>:<>
 {tab==='Overview'&&<><section className="sports-spotlight"><span className="secondary-eyebrow">Previous match · Player of the Match</span><h2>{potm?playerLink(potm):'The next school hero starts here.'}</h2><p>{potm?`${schoolName(potm.school_id)} · ${potm.position||'Player'}`:'A confirmed Player of the Match will appear here after your school’s next result.'}</p>{last&&<p>{teamMap.get(last.home_team_id)?.name} {last.home_score} – {last.away_score} {teamMap.get(last.away_team_id)?.name}</p>}</section><h2>Next fixtures</h2><div className="secondary-list">{myMatches.filter(m=>m.status==='scheduled').reverse().slice(0,3).map(matchCard)}{!myMatches.some(m=>m.status==='scheduled')&&<p>No upcoming fixtures for this school yet.</p>}</div><h2>Nearby results</h2><div className="secondary-list">{districtMatches.filter(m=>m.status==='official').slice(0,4).map(matchCard)}{!districtMatches.some(m=>m.status==='official')&&<p>No confirmed results in this area yet.</p>}</div></>}
 {tab==='Fixtures'&&<div className="secondary-list">{myMatches.filter(m=>m.status==='scheduled'||m.status==='live').reverse().map(matchCard)}{!myMatches.some(m=>m.status==='scheduled'||m.status==='live')&&<p>No fixtures yet.</p>}</div>}
 {tab==='Results'&&<div className="secondary-list">{myMatches.filter(m=>['official','pending_confirmation'].includes(m.status)).map(matchCard)}{!myMatches.some(m=>['official','pending_confirmation'].includes(m.status))&&<p>No results yet.</p>}</div>}
 {tab==='Log'&&<section className="secondary-card"><h2>{selectedSchool?.municipality||'School sport'} log</h2><p className="secondary-muted">Standings for this competition group. Confirmed results only; win 3 points, draw 1.</p><div className="sports-table"><table><thead><tr>{['Team','P','W','D','L','GD','Pts'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{standings(competition,districtMatches).map(t=><tr key={t.id}><td>{t.name}</td><td>{t.played}</td><td>{t.won}</td><td>{t.drawn}</td><td>{t.lost}</td><td>{t.for-t.against}</td><td><b>{t.points}</b></td></tr>)}</tbody></table></div>{!competition.length&&<p>No teams in this group yet.</p>}</section>}
 {tab==='Players'&&<div className="sports-player-grid">{visiblePlayers.map(p=><article className="secondary-card" key={p.id}><h2>{playerLink(p)}</h2><p>{p.position||'Player'}</p></article>)}{!visiblePlayers.length&&<p>No published player profiles for this school yet.</p>}</div>}
 </> }<p className="secondary-muted sports-footer">Updates refresh every 30 seconds. Only published player profiles are shown.</p></>}
 </SecondaryShell>;
}
