# Skolo Saka

**R10 a month. For the school that made you.**

Skolo Saka is a mobile-first alumni contribution network for South African primary and high schools. One person can belong to multiple schools and create an independent recurring commitment for each.

## Current state

- Next.js 16 + React 19 + TypeScript
- Supabase Auth/Postgres/RLS backend
- Primary and high schools supported from V1
- Phone OTP via Supabase Auth with signed WinSMS delivery hook
- Phone + 4-digit PIN sign-in after SMS verification
- Multi-school alumni memberships
- R10/R25/R50/R100 monthly commitment intent per school
- Projects, project updates, expenditure evidence, votes, invitations and immutable ledger model
- Security advisor: no findings
- Public pilot data contains no fake donations

## Important production boundaries

SMS and payments require production account configuration. See [SMS setup](docs/sms-setup.md) and [Paystack setup](docs/paystack-setup.md).

The WinSMS hook and Paystack checkout are implemented, but live SMS delivery, merchant approval, bank settlement, and cancellation must be verified before public fundraising. Never represent test contributions as live money. The payment page explicitly labels test checkout.

## Development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

The app requires explicit Supabase credentials in every environment. Copy `.env.example` to `.env.local` and replace its values before starting the server. Preview deployments must use a separate UAT Supabase project.

Payment flows additionally require server-only credentials in `.env.local`:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PAYSTACK_SECRET_KEY=your-paystack-test-secret-key
```

Do not commit `.env.local` or expose either server-only key through a `NEXT_PUBLIC_` variable.

To verify a local setup:

```bash
npm run build
npm run dev
```

The browser client uses the Supabase publishable key only. Never expose a service-role key to the frontend.
