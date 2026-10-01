import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {notFound} from 'next/navigation';
import {isUat,TEST_SUPABASE_URL} from '@/lib/deployment';

export const dynamic='force-dynamic';

export default async function EmailPreview(){
  if(!isUat()||process.env.NEXT_PUBLIC_SUPABASE_URL!==TEST_SUPABASE_URL)notFound();
  const template=await readFile(join(process.cwd(),'supabase/templates/email-change.html'),'utf8');
  const sample=template.replaceAll('{{ .NewEmail }}','alumnus@example.com').replaceAll('{{ .ConfirmationURL }}','#preview-only');
  return <main style={{padding:20,display:'grid',justifyContent:'center',gap:12}}>
    <h1 style={{fontSize:20,margin:0}}>Verification email preview</h1>
    <p style={{margin:0,maxWidth:560}}>Design preview only. No email has been sent. Hosted email and sender settings still need to be applied.</p>
    <div style={{padding:16,background:'#fff',border:'1px solid #dfe7e2',borderRadius:12}}><b>From:</b> Skolo Saka<br/><b>Subject:</b> Verify your email — Skolo Saka</div>
    <iframe title="Verification email design" sandbox="" srcDoc={sample} style={{width:390,maxWidth:'100%',height:820,border:'1px solid #dfe7e2',borderRadius:16}}/>
  </main>;
}
