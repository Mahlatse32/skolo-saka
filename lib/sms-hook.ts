import { createHmac, timingSafeEqual } from 'node:crypto';

// Supabase signs HTTP Auth Hooks using Standard Webhooks (HMAC SHA-256).
export function validSmsSignature(body: string, headers: Headers, secret: string, now = Date.now()) {
  const id = headers.get('webhook-id');
  const timestamp = headers.get('webhook-timestamp');
  const signatures = headers.get('webhook-signature');
  if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const encoded = secret.replace(/^v1,/, '').replace(/^whsec_/, '');
  const key = Buffer.from(encoded, 'base64');
  if (key.length < 16) return false;
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();
  return signatures.split(' ').some(signature => {
    const [version, value] = signature.split(',');
    if (version !== 'v1' || !value) return false;
    const actual = Buffer.from(value, 'base64');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

function hookError(status: number, message: string) {
  return Response.json({ error: { http_code: status, message } }, { status });
}

export async function handleSmsHook(request: Request, config: {
  secret?: string; apiKey?: string; send?: typeof fetch;
}) {
  if (!config.secret || !config.apiKey) return hookError(503, 'SMS delivery is not configured. Please try again later.');
  const body = await request.text();
  if (body.length > 65536) return hookError(413, 'Request too large.');
  if (!validSmsSignature(body, request.headers, config.secret)) return hookError(401, 'Invalid hook signature.');
  let phone: string;
  let otp: string;
  try {
    const payload = JSON.parse(body);
    phone = String(payload.user?.phone || '').replace(/^\+/, '');
    otp = String(payload.sms?.otp || '');
    if (!/^27[6-8]\d{8}$/.test(phone) || !/^\d{6}$/.test(otp)) return hookError(400, 'A South African mobile number and six-digit code are required.');
  } catch { return hookError(400, 'Invalid request.'); }
  try {
    const response = await (config.send || fetch)('https://api.winsms.co.za/api/rest/v1/sms/outgoing/send', {
      method: 'POST',
      headers: { Authorization: config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Your Skolo Saka verification code is ${otp}. Do not share this code.`,
        maxSegments: 1,
        recipients: [{ mobileNumber: phone }],
      }),
      signal: AbortSignal.timeout(3500),
      cache: 'no-store',
    });
    const result = await response.json();
    // WinSMS acknowledges a successful submission with HTTP 200 and statusCode 200.
    // Its response does not contain Twilio-style recipientResults/accepted fields.
    if (!response.ok || result?.statusCode !== 200) {
      return hookError(502, 'We could not send your SMS. Please try again later.');
    }
    return Response.json({});
  } catch {
    // Never log provider responses, phone numbers, secrets, or OTPs.
    return hookError(502, 'SMS delivery is temporarily unavailable. Please try again later.');
  }
}
