export function normalizeSaPhone(value:string){
  const digits=value.replace(/\D/g,'');
  if(digits.startsWith('27'))return `+${digits}`;
  if(digits.startsWith('0'))return `+27${digits.slice(1)}`;
  return `+27${digits}`;
}

export async function pinPassword(phone:string,pin:string){
  const source=new TextEncoder().encode(`skolo-saka-auth-v1:${normalizeSaPhone(phone)}:${pin}:south-africa`);
  const digest=await crypto.subtle.digest('SHA-256',source);
  const hex=Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
  return `Ss!${hex}`;
}
