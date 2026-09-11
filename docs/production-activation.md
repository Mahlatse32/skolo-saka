# Skolo Saka production activation

The software pilot deliberately separates **user intent** from **real-world collection**. A contribution commitment stays `pending` until an external mandate/payment provider confirms it.

## 1. SMS / phone verification

The app already calls Supabase Phone Auth (`signInWithOtp` and `verifyOtp`). To deliver real OTPs, configure one supported SMS provider in the Supabase Auth settings.

Recommended first integration: **Twilio** because Supabase supports it directly and the app needs no custom SMS credential handling in the browser.

Production controls:
- keep OTP provider credentials inside Supabase, never in Next.js public environment variables;
- configure sensible OTP rate limits;
- enable CAPTCHA before broad public launch;
- keep the 4-digit Skolo Saka PIN as a trusted-device convenience only, never as the remote identity credential.

## 2. Recurring collection

Recommended first South African banking integration to evaluate: **Netcash eMandate + DebiCheck**.

Why the architecture fits Skolo Saka:
- eMandate supports electronically authorised debit-order mandates;
- DebiCheck supports bank-authorised recurring collection mandates;
- Skolo Saka already has separate `commitments`, `payment_attempts` and immutable-style `ledger_transactions` tables.

Do **not** store raw bank-account or card details in Skolo Saka's public database. Prefer the provider's mandate/session flow and retain only provider references, status, amounts and reconciliation metadata.

Required merchant configuration before code can activate collections:
- Netcash merchant/account approval;
- debit-order service key;
- eMandate / DebiCheck mandate template configuration;
- callback / result URL configuration;
- agreed debit day and collection rules;
- production reconciliation process.

## 3. Payment state machine

Expected lifecycle:

`pending commitment -> mandate requested -> mandate authorised -> active commitment -> collection attempt -> successful ledger contribution`

Failures stay visible in `payment_attempts`; they must never increment public funding totals.

Only a provider-confirmed successful collection may create a `ledger_transactions.type = contribution` record.

## 4. Governance activation

Before accepting public money, confirm:
- legal entity that receives and holds funds;
- school/SGB authority to request and approve projects;
- procurement and supplier approval process;
- platform fee policy, if any;
- refund/cancellation rules;
- POPIA privacy documentation;
- reconciliation and audit ownership.

The database already supports school admins, platform admins, expenditures, evidence documents and audit records; these controls should be assigned to named people only after governance is approved.
