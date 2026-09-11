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

The browser client uses the Supabase publishable key only. Never expose a service-role key to the frontend.
