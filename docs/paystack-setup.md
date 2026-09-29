# Skolo Saka payment activation

Production: https://www.skolosaka.co.za
UAT: https://skolo-saka-uat.vercel.app

## Production configuration

In Vercel project `skolo-saka-arnx`, Production environment only:

- `NEXT_PUBLIC_SUPABASE_URL=https://nnexzxszqjedaqqukfiq.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: production publishable key
- `SUPABASE_SERVICE_ROLE_KEY`: production server-only service role key
- `NEXT_APP_URL=https://www.skolosaka.co.za`
- `PAYSTACK_SECRET_KEY`: live secret (`sk_live_...`), only after merchant activation

Never put secret keys in GitHub, chat, or NEXT_PUBLIC variables. Redeploy after changing environment variables. Until the live key is configured, production checkout returns 503 before creating payment records. Registration, school linking and saving unpaid arrangements remain available. Production test keys are rejected for checkout and payment recording. Preview deployments cannot use production payment credentials.

In Paystack's **Live** settings:

- Webhook: `https://www.skolosaka.co.za/api/paystack/webhook`
- Callback: `https://www.skolosaka.co.za/payment/complete`

Use the www webhook directly to avoid redirects. The callback verifies the transaction with Paystack; webhooks validate HMAC SHA512 signatures before processing. Contribution entries use stable references to avoid duplicate receipts. Card contributions are supported; bank-account debit orders are not offered.

## UAT configuration

Keep the test database `faytrobauwibxujvmbct`, its own service role key, a `sk_test_...` Paystack key, and `NEXT_APP_URL=https://skolo-saka-uat.vercel.app`. Live keys are rejected with the test database. UAT sample accounts, sports teams and OTP shortcuts must not be copied into production.

## Activation verification

1. Confirm merchant approval and payout bank details in Paystack.
2. Set the live key and canonical app URL securely, then redeploy.
3. With the owner's approval for the charge, make a R10 once-off contribution and confirm its Paystack reference, signed webhook delivery and one ledger receipt.
4. Verify monthly setup, cancellation and amount changes separately; these create real financial commitments and must be intentional.
5. Confirm bank settlement separately. Checkout success does not prove settlement.
6. Verify real phone OTP, email verification and account recovery on the production domain.
7. Check declined/abandoned checkout and monitor webhook failures, failed invoices, expiring cards and refunds. Automatic recovery/refund reconciliation is not fully implemented.

## Existing records requiring reconciliation

A read-only production audit on 2026-09-29 found 12 Paystack contribution entries totalling R780. The stored metadata does not identify test versus live mode. These records have been preserved. Match their transaction references against Paystack before claiming they are real donations or archiving confirmed test records. Do not erase user accounts or ledger history as a launch cleanup.

Database audit: every current public table has RLS enabled; users can read only their own ledger rows; the analytics summary function is not executable by anon/authenticated roles and is reached through an administrator-checked server route. One platform admin assignment exists.
