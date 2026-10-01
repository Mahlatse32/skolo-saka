import {NextRequest,NextResponse} from 'next/server';
import {adminSupabase} from '@/lib/paystack-server';
import {isUat,TEST_SUPABASE_URL,UAT_ORIGIN} from '@/lib/deployment';
import {passwordError,PASSWORD_CREDENTIAL_VERSION} from '@/lib/password-auth';
import {validUatRegistration} from '@/lib/uat-registration';
export async function POST(req:NextRequest){
 if(!isUat()||process.env.NEXT_PUBLIC_SUPABASE_URL!==TEST_SUPABASE_URL)return NextResponse.json({error:'Not found'},{status:404});
 if(req.headers.get('origin')!==UAT_ORIGIN)return NextResponse.json({error:'Use the UAT registration page.'},{status:403});
 try{const body=await req.json();if(!validUatRegistration(body)||passwordError(body.password))return NextResponse.json({error:'Use a synthetic number from 0600000000 to 0600000099 and test code 123456.'},{status:400});
 const {error}=await adminSupabase().auth.admin.createUser({phone:body.phone,password:body.password,phone_confirm:true,app_metadata:{uat_synthetic:true,credential_version:PASSWORD_CREDENTIAL_VERSION}});
 if(error)return NextResponse.json({error:'Could not create this account. If the number is already registered, sign in with its existing password.'},{status:409});
 return NextResponse.json({created:true});
 }catch{return NextResponse.json({error:'Could not create the test account.'},{status:400});}
}
