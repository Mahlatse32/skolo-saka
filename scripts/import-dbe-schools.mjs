// Imports the official DBE national ordinary-schools workbook into Supabase.
// Usage: node scripts/import-dbe-schools.mjs <path-to-xlsx>
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const file=process.argv[2];
if(!file) throw new Error('Pass the DBE .xlsx file path.');
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const wb=XLSX.readFile(file);
const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:null});
const pick=(r,names)=>{for(const n of names){const k=Object.keys(r).find(k=>k.toLowerCase().replace(/[^a-z0-9]/g,'')===n);if(k&&r[k]!=null)return String(r[k]).trim();}return null;};
const phaseToLevel=(phase='')=>{const p=phase.toLowerCase();if(p.includes('combined')||p.includes('composite'))return 'combined';if(p.includes('secondary')||p.includes('high')||p.includes('fet'))return 'high';if(p.includes('primary')||p.includes('intermediate')||p.includes('foundation'))return 'primary';return 'other';};
const mapped=rows.map(r=>{const name=pick(r,['institutionname','officialinstitutionname','nameofschool','schoolname']);const emis=pick(r,['natemis','nationalemisnumber','emisnumber']);const phase=pick(r,['phaseped','schoolphase','phase'])||'';return {name,emis_number:emis,level:phaseToLevel(phase),province:pick(r,['province']),municipality:pick(r,['lmunname','localmunicipalityname','municipality']),town:pick(r,['towncity','town','townshipvillage']),verified:true};}).filter(r=>r.name&&r.emis_number);
const dedup=[...new Map(mapped.map(r=>[r.emis_number,r])).values()];
const supabase=createClient(url,key,{auth:{persistSession:false}});
for(let i=0;i<dedup.length;i+=500){const {error}=await supabase.from('schools').upsert(dedup.slice(i,i+500),{onConflict:'emis_number'});if(error)throw error;console.log(`Imported ${Math.min(i+500,dedup.length)}/${dedup.length}`);}
console.log(`Done: ${dedup.length} official DBE schools.`);
