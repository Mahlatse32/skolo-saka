# Paystack setup for Skolo Saka

Start in **Paystack Test Mode**. Never put the secret key in GitHub or browser code.

## Vercel environment variables

Add these to the `skolo-saka-arnx` project in Vercel → Settings → Environment Variables:

- `PAYSTACK_SECRET_KEY` = your Paystack **Test Secret Key** (`sk_test_...` while testing)
- `SUPABASE_SERVICE_ROLE_KEY` = the Supabase service-role secret (server only)
- `NEXT_PUBLIC_APP_URL` = `https://skolo-saka-arnx.vercel.app`

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` should remain configured as before.

After adding/changing environment variables, redeploy the production deployment.

## Paystack dashboard

In Paystack → Settings → API Keys & Webhooks → Test Mode, set:

- Webhook URL: `https://skolo-saka-arnx.vercel.app/api/paystack/webhook`
- Callback URL can be `https://skolo-saka-arnx.vercel.app/payment/complete` (the app also sends this callback per transaction).

Use the Test Secret Key only until the complete recurring flow has been tested.

## Test flow

1. Sign into Skolo Saka.
2. Add an email address under Profile (Paystack requires an email for transaction initialization).
3. Add a school and choose the monthly amount.
4. Open `/payments` and select **Set up monthly payment**.
5. Complete Paystack's test checkout.
6. Paystack redirects to `/payment/complete`; the server independently verifies the transaction.
7. The signed webhook activates the commitment and writes the contribution to the ledger idempotently.

The app never stores card numbers, CVVs, or Paystack secret keys in Supabase/browser state.
