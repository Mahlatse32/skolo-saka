import { isUat } from '@/lib/deployment';
import { handleSmsHook } from '@/lib/sms-hook';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (isUat()) return Response.json({ error: { http_code: 503, message: 'Live SMS delivery is disabled in UAT. Use configured Supabase test phone numbers.' } }, { status: 503 });
  return handleSmsHook(request, {
    secret: process.env.SUPABASE_SMS_HOOK_SECRET,
    apiKey: process.env.WINSMS_API_KEY,
  });
}
