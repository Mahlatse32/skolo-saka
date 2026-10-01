# Password sign-in and contribution cancellation

The main sign-in, registration and recovery flows use a phone number and password. Passwords have at least 12 characters; numeric-only passwords, obvious repeated values, common examples and the old PIN-derived credential format are rejected. Password managers and passphrases work with the same sign-in design. PIN is absent from the main flow; optional device quick access is not introduced by this release.

## Existing accounts

Before production promotion, review the migration `202610011630_password_credentials.sql`. It removes the old password hash from phone accounts that have not completed password setup. Their profiles, schools, contributions and provider subscriptions are preserved. Those users must verify by SMS or use their previously saved, verified recovery email to choose a password. The old PIN cannot authenticate against Supabase after the migration.

Password setup uses a server-verified SMS code and a ten-minute, HttpOnly signed proof bound to the account, original phone and session. Email recovery requires a recent verified recovery claim; an account upgrading from PIN must match the original saved recovery email. An ordinary session, email-change link, email OTP, expired proof or a different account's proof cannot authorize a reset.

The verified server updates the password and credential marker atomically using the Auth Admin API. Only the server sets `app_metadata.credential_version=password_v2`, and it revokes other refresh sessions. Existing access JWTs cannot be immediately revoked by Supabase. Restrictive RLS policies reject pre-upgrade JWTs on private account/payment tables, and the shared API authentication helper checks the verified JWT marker as well as the current user. Ownership and administrator checks remain in place.

## Cancelling contributions

Cancellation opens an inline password confirmation using the existing contribution-card styling. The server checks the supplied password against the authenticated account before reading or modifying payment instructions or calling Paystack. Client-side confirmation alone cannot cancel a contribution. Missing/wrong passwords, legacy PIN accounts and other-account credentials fail closed. Verification sessions created for this check are immediately signed out locally.

## UAT and production gate

1. Deploy and test the new routes/UI in isolated UAT.
2. Apply the migration to the test database and verify old PIN rejection, password sign-in, stale-session rejection and password confirmation on cancellation.
3. Use synthetic UAT registration for no-SMS backend checks. Its bounded numbers and fixed test code are excluded from production.
4. Owner must approve both the UAT build and the forced password-setup impact before production migration/promotion. Production phone users will need a password setup step once; do not present this as an optional rollout.
5. Promote only the shared UI, routes, helpers, tests and migration. Keep UAT-only pages/registration code out of main.

Removing old password hashes is not undone by rolling back the frontend. A rollback must retain SMS/recovery access or restore the password setup routes; do not restore four-digit PIN authentication as an emergency workaround. No payment is executed by the migration.

Before release, enable **Require current password when changing password** in hosted Supabase Auth for UAT and production. Otherwise direct Auth API calls from a stolen session could change a password without this application’s recovery proof. Server-authorized SMS/email resets use the Admin API so this protection does not break verified recovery. The server enforces the documented password policy; do not assume Admin API resets enforce hosted leaked-password checks. This code does not change hosted confirmation, OTP rate-limit or SMTP settings. The branded email template remains a separate hosted configuration task.
