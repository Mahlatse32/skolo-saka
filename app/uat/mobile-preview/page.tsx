import {notFound} from 'next/navigation';
import {isUat,TEST_SUPABASE_URL} from '@/lib/deployment';
export default function MobilePreview(){
 if(!isUat()||process.env.NEXT_PUBLIC_SUPABASE_URL!==TEST_SUPABASE_URL)notFound();
 return <main style={{padding:20,display:'grid',justifyContent:'center',gap:12}}><h1 style={{fontSize:18}}>UAT mobile layout · 390px</h1><iframe title="Mobile application preview" src="/sports" style={{width:390,height:820,border:'1px solid #dfe7e2',borderRadius:18}}/></main>;
}
