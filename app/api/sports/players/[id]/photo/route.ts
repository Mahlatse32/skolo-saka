import {NextRequest} from 'next/server';
import {adminSupabase} from '@/lib/paystack-server';
export async function GET(_req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))return new Response(null,{status:404});
 try{const db=adminSupabase();const {data,error}=await db.from('sports_players').select('photo_path,user_id').eq('id',id).eq('public_profile',true).not('guardian_consent_at','is',null).single();
 if(error||!data.photo_path||!data.user_id||!data.photo_path.startsWith(data.user_id+'/'))return new Response(null,{status:404});
 const file=await db.storage.from('profile-photos').download(data.photo_path);if(file.error)throw file.error;
 return new Response(await file.data.arrayBuffer(),{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response(null,{status:404});}
}
