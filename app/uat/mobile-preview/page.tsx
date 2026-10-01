import {notFound} from 'next/navigation';
import {isUat,TEST_SUPABASE_URL} from '@/lib/deployment';
const PAGES:Record<string,string>={schools:'/schools',signin:'/',profile:'/?view=profile',sports:'/sports'};
const WIDTHS=[320,375,390,430];
export default async function MobilePreview({searchParams}:{searchParams:Promise<{page?:string;width?:string}>}){
 if(!isUat()||process.env.NEXT_PUBLIC_SUPABASE_URL!==TEST_SUPABASE_URL)notFound();
 const params=await searchParams;
 const page=params.page&&PAGES[params.page]?params.page:'schools';
 const width=WIDTHS.includes(Number(params.width))?Number(params.width):390;
 return <main style={{padding:20,display:'grid',justifyContent:'center',gap:12}}><h1 style={{fontSize:18,margin:0}}>UAT mobile layout · {width}px</h1><nav aria-label="Preview page" style={{display:'flex',gap:12,flexWrap:'wrap'}}>{Object.keys(PAGES).map(p=><a key={p} href={`?page=${p}&width=${width}`} aria-current={page===p?'page':undefined}>{p==='signin'?'Sign in':p[0].toUpperCase()+p.slice(1)}</a>)}</nav><nav aria-label="Preview width" style={{display:'flex',gap:12}}>{WIDTHS.map(w=><a key={w} href={`?page=${page}&width=${w}`} aria-current={width===w?'page':undefined}>{w}px</a>)}</nav><iframe title="Mobile application preview" src={PAGES[page]} style={{width,height:820,border:'1px solid #dfe7e2',borderRadius:18,maxWidth:'100%'}}/></main>;
}
