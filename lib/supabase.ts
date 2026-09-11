import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://nnexzxszqjedaqqukfiq.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_zVwmcb5dpkWfxn04L-PVSQ_9aTfa0q5';

export const supabase = createBrowserClient(url, key);
