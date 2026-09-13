import { handleSmsHook } from '@/lib/sms-hook';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleSmsHook(request, {
    secret: process.env.SUPABASE_SMS_HOOK_SECRET,
    apiKey: process.env.WINSMS_API_KEY,
  });
}
