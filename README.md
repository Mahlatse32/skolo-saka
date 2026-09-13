# Skolo Saka

**R10 a month. For the school that made you.**

Skolo Saka is a mobile-first alumni contribution network for South African primary and high schools. One person can belong to multiple schools and create an independent recurring commitment for each.

## Current state

- Next.js 16 + React 19 + TypeScript
- Supabase Auth/Postgres/RLS backend
- Primary and high schools supported from V1
- Phone OTP wired for identity verification
- 4-digit PIN used only as a trusted-device unlock
- Multi-school alumni memberships
- R10/R25/R50/R100 monthly commitment intent per school
- Projects, project updates, expenditure evidence, votes, invitations and immutable ledger model
- Security advisor: no findings
- Public pilot data contains no fake donations

## Important production boundaries

Two external services are intentionally not faked:

1. Supabase phone Auth needs an SMS provider before OTP messages can be delivered.
2. A South African recurring-payment provider must be connected before a commitment can become active or any money can be displayed as collected.

Until those integrations exist, commitments remain `pending` and verified project funding stays at R0.

## Development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

The main app can run immediately using its browser-safe pilot Supabase defaults. To use another Supabase project, copy `.env.example` to `.env.local` and replace its values before starting the server.

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
