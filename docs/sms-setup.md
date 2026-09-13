# Real SMS delivery: Supabase + WinSMS

The app requests and verifies codes using Supabase Auth. The HTTP Send SMS Hook delivers Supabase-generated codes through WinSMS; it never generates or verifies its own codes.

## Activation

1. Create a WinSMS account, fund SMS credits, and obtain its REST API key in the Client Zone.
2. On the app host, set server-only `WINSMS_API_KEY` and `SUPABASE_SMS_HOOK_SECRET`. Never prefix either with NEXT_PUBLIC or commit values.
3. In Supabase Authentication > Hooks create an HTTP Send SMS hook pointing to `https://www.skolosaka.co.za/api/auth/send-sms`. Use the actual reachable deployment URL if the custom domain is not ready. Generate the hook signing secret; copy the full `v1,whsec_...` value into `SUPABASE_SMS_HOOK_SECRET`.
4. Deploy the endpoint and environment variables before enabling the hook. It must be publicly reachable without deployment protection; requests are authenticated by the hook signature.
5. Enable Phone authentication and phone confirmation. Set six-digit OTPs, a short expiry (for example 5 minutes), and a 60-second resend interval. Keep Supabase's server-side rate limits enabled; the UI countdown is not an abuse-control boundary.
6. Remove fixed test-phone OTP overrides when ready to test actual delivery. Do not disable phone confirmation. WinSMS trial restrictions and credit balance still apply.
7. Test registration on your own SA mobile, invalid/expired codes, resend, PIN creation, sign-out/sign-in, and PIN reset. Confirm delivery in WinSMS logs without copying OTPs into logs or screenshots.

The hook accepts South African mobile numbers only and limits each SMS to one segment. Signature checks cover the raw body, ID and timestamp, with a five-minute tolerance. WinSMS recipient rejection and transport errors return a failure to Supabase. Acceptance by the gateway does not prove handset delivery. No durable duplicate-event store is implemented: authenticated hook redeliveries can send the same code again; configure rate limits and monitor credits before public promotion.

## Verification

Run `node --experimental-strip-types --test tests/sms-hook.test.mjs` on Node 22.6+ and `npx tsc --noEmit`.

References:
- https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
- https://www.winsms.co.za/api/sdkdocs/
- https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md
