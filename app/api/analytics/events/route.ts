import { NextRequest, NextResponse } from 'next/server';
import { adminSupabase, serverSupabase } from '@/lib/paystack-server';
import { cleanAnalyticsProperties, deviceType, isAnalyticsEventName, sanitiseAnalyticsPath } from '@/lib/analytics';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!isAnalyticsEventName(body.eventName) || !UUID.test(body.visitorId || '') || !UUID.test(body.sessionId || '')) return NextResponse.json({ error: 'Invalid analytics event.' }, { status: 400 });
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    let userId: string | null = null;
    if (token) { const { data } = await serverSupabase(token).auth.getUser(token); userId = data.user?.id || null; }
    let referrerHost: string | null = null;
    try { const referrer = request.headers.get('referer'); referrerHost = referrer ? new URL(referrer).hostname.slice(0, 160) : null; } catch { referrerHost = null; }
    const { error } = await adminSupabase().from('analytics_events').insert({
      event_name: body.eventName, visitor_id: body.visitorId, session_id: body.sessionId, user_id: userId,
      page_path: sanitiseAnalyticsPath(body.pagePath || '/'), referrer_host: referrerHost,
      device_type: deviceType(request.headers.get('user-agent') || ''), properties: cleanAnalyticsProperties(body.properties),
    });
    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Analytics event rejected', error);
    return NextResponse.json({ error: 'Could not record event.' }, { status: 500 });
  }
}
