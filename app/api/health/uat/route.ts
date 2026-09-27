import { adminSupabase } from '@/lib/paystack-server';
import { applicationOrigin, isUat, TEST_SUPABASE_URL } from '@/lib/deployment';

export const dynamic = 'force-dynamic';
export async function GET() {
  if (!isUat()) return new Response(null, { status: 404 });
  const isolated = process.env.NEXT_PUBLIC_SUPABASE_URL === TEST_SUPABASE_URL;
  let database = false;
  let callbacks = false;
  if (isolated) {
    try {
      const { error } = await adminSupabase().from('schools').select('id', { head: true }).limit(1);
      database = !error;
    } catch { /* Report configuration status only, never credentials or provider details. */ }
  }
  try { applicationOrigin(); callbacks = true; } catch { /* Unhealthy callback configuration. */ }
  return Response.json({
    environment: 'uat', isolated, database, callbacks,
    payments: process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'blocked',
    sms: 'blocked',
  }, { status: isolated && database && callbacks ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
