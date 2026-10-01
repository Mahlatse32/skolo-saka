# Recovery email branding

The recovery email action in `app/PaymentQuickLink.tsx` calls Supabase `auth.updateUser({ email })`. Its email uses the **Change email address** template, not the signup confirmation template.

## Approved design candidate

- Sender display name: **Skolo Saka**.
- Subject: **Verify your email — Skolo Saka**.
- Body: `supabase/templates/email-change.html`.
- Button: **Verify email address**.
- Preview text explains account recovery rather than repeating the heading.

The template retains Supabase's `{{ .ConfirmationURL }}` so confirmation tokens, expiry, secure email change and environment-specific redirects remain managed by Auth. `{{ .NewEmail }}` is escaped by Supabase's HTML template renderer. There are no external images or tracking links.

## Apply in UAT first

1. Open Authentication → Emails → Templates in the `skolo-saka-test` project (`faytrobauwibxujvmbct`).
2. Save the existing **Change email address** subject and HTML for rollback.
3. Set the subject above and paste the HTML template. Save and check the rendered preview.
4. Request verification from a UAT test account using an authorized test inbox. Check sender, subject, preview text and mobile rendering, then follow the link to confirm it returns to UAT Profile and marks the address verified.
5. Record owner approval before applying the same subject and template in production (`nnexzxszqjedaqqukfiq`).

The UAT page `/uat/email-preview` renders a sample of the proposed message without sending email or generating a verification token. It is a design preview, not evidence of successful delivery.

## Sender identity

The default Supabase mail service displays **Supabase Auth**. A branded sender needs custom SMTP configured in Authentication → Emails → SMTP Settings, using an existing authorized email provider and its verified sending address/domain. Set the sender display name to **Skolo Saka**. Do not enable custom SMTP with placeholder credentials or an unverified address.

Changing HTML and subject alone does not change the sender name. Sender configuration must be checked in the hosted Supabase project; committing this file does not apply hosted Auth settings. Do not change email confirmation, secure email change, rate limits or redirect allowlists as part of this branding update.

References: [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
