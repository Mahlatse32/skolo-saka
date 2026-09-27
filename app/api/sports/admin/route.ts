import {NextRequest,NextResponse} from 'next/server';
import {authenticatedUser} from '@/lib/payment-instructions-server';
import {adminSupabase} from '@/lib/paystack-server';
import {canManageTeam,type SportsRole} from '@/lib/sports-access';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){try{
 const auth=await authenticatedUser(req);if(!auth)return json({error:'Sign in to manage sports.'},401);
 const db=adminSupabase();const {data:roles,error}=await db.from('sports_admin_assignments').select('*').eq('user_id',auth.user.id).eq('active',true);if(error)throw error;if(!roles?.length)return json({error:'Your account has no sports admin assignment.'},403);
 const superAdmin=roles.some(r=>r.role==='super_admin');
 const [schools,teams,matches,players,roster,assignments,users,audit]=await Promise.all([
 db.from('schools').select('id,name').order('name'),db.from('sports_teams').select('*').order('name'),db.from('sports_matches').select('*').order('starts_at',{ascending:false}),
 db.from('sports_players').select('id,school_id,first_name,last_name,position,public_profile,guardian_consent_at'),db.from('sports_team_players').select('*'),
 superAdmin?db.from('sports_admin_assignments').select('*').eq('active',true):Promise.resolve({data:roles,error:null}),
 superAdmin?db.from('profiles').select('id,first_name,last_name,phone').order('created_at',{ascending:false}).limit(200):Promise.resolve({data:[],error:null}),
 superAdmin?db.from('sports_audit_log').select('id,actor_user_id,action,entity_type,entity_id,created_at').order('created_at',{ascending:false}).limit(50):db.from('sports_audit_log').select('id,actor_user_id,action,entity_type,entity_id,created_at').eq('actor_user_id',auth.user.id).order('created_at',{ascending:false}).limit(50)]);
 if([schools,teams,matches,players,roster,assignments,users,audit].some(r=>r.error))throw new Error('Data unavailable');
 const editable=(teams.data||[]).filter(t=>canManageTeam(roles as SportsRole[],t));const teamIds=new Set(editable.map(t=>t.id));const schoolIds=new Set((roles as SportsRole[]).filter(r=>r.role==='school_admin').map(r=>r.school_id));
 const visiblePlayers=(players.data||[]).filter(p=>superAdmin||schoolIds.has(p.school_id)||(roster.data||[]).some(r=>r.player_id===p.id&&teamIds.has(r.team_id))||(p.public_profile&&p.guardian_consent_at));const playerIds=new Set(visiblePlayers.map(p=>p.id));
 return json({userId:auth.user.id,superAdmin,roles,schools:schools.data,teams:teams.data,editableTeamIds:[...teamIds],matches:(matches.data||[]).filter(m=>superAdmin||teamIds.has(m.home_team_id)||teamIds.has(m.away_team_id)),players:visiblePlayers.map(({guardian_consent_at,...p})=>p),roster:(roster.data||[]).filter(r=>playerIds.has(r.player_id)),assignments:assignments.data,users:(users.data||[]).map(u=>({id:u.id,label:[u.first_name,u.last_name].filter(Boolean).join(' ')||`Account …${u.phone?.slice(-4)||u.id.slice(-4)}`})),audit:audit.data});
 }catch{return json({error:'Could not load sports administration.'},500);}}
export async function POST(req:NextRequest){try{
 const auth=await authenticatedUser(req);if(!auth)return json({error:'Sign in required.'},401);
 const body=await req.json();if(typeof body.action!=='string'||!body.payload||typeof body.payload!=='object')return json({error:'Invalid action.'},400);
 if(['fixture_update','result_submit','result_confirm','event_add'].includes(body.action)&&(!Number.isInteger(body.payload.revision)||body.payload.revision<0))return json({error:'Refresh the match before saving.'},400);
 const {data,error}=await auth.supabase.rpc('sports_admin_mutate',{action:body.action,payload:body.payload});if(error)return json({error:error.message},error.code==='42501'?403:error.code==='40001'?409:400);return json(data);
 }catch{return json({error:'Could not save sports changes.'},400);}}
