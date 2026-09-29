import {NextRequest,NextResponse} from 'next/server';
import sharp from 'sharp';
import {randomUUID} from 'node:crypto';
import {authenticatedUser} from '@/lib/payment-instructions-server';
import {adminSupabase} from '@/lib/paystack-server';
export const runtime='nodejs';
const bucket='profile-photos';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:NextRequest){try{const auth=await authenticatedUser(req);if(!auth)return json({error:'Sign in required.'},401);const db=adminSupabase();const {data,error}=await db.from('profiles').select('avatar_path').eq('id',auth.user.id).single();if(error)throw error;if(!data.avatar_path?.startsWith(auth.user.id+'/'))return json({url:null});const signed=await db.storage.from(bucket).createSignedUrl(data.avatar_path,3600);if(signed.error)throw signed.error;return json({url:signed.data.signedUrl});}catch{return json({error:'Could not load your photo.'},500);}}
export async function POST(req:NextRequest){
 const auth=await authenticatedUser(req);if(!auth)return json({error:'Sign in required.'},401);
 if(Number(req.headers.get('content-length')||0)>3*1024*1024+10000)return json({error:'Photo must be 3 MB or smaller.'},413);
 try{const form=await req.formData(),file=form.get('photo');if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>3*1024*1024||!file.size)return json({error:'Choose a JPG, PNG or WebP image up to 3 MB.'},400);
 const image=sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:25_000_000,animated:false});const meta=await image.metadata();if(!['jpeg','png','webp'].includes(meta.format||''))return json({error:'Unsupported image format.'},400);
 const bytes=await image.rotate().resize(512,512,{fit:'cover'}).webp({quality:82}).toBuffer();
 const db=adminSupabase(),path=`${auth.user.id}/${randomUUID()}.webp`;
 const upload=await db.storage.from(bucket).upload(path,bytes,{contentType:'image/webp',upsert:false});if(upload.error)throw upload.error;
 const updated=await db.from('profiles').update({avatar_path:path,updated_at:new Date().toISOString()}).eq('id',auth.user.id).select('id').single();if(updated.error){await db.storage.from(bucket).remove([path]);throw updated.error;}
 const signed=await db.storage.from(bucket).createSignedUrl(path,3600);if(signed.error)throw signed.error;return json({url:signed.data.signedUrl});
 }catch{return json({error:'Could not save this photo. Try a smaller JPG, PNG or WebP image.'},400);}
}
