# Skolo Saka UAT

UAT is the mandatory validation environment between feature development and production.

## Environment map

| Environment | Git ref | Database |
| --- | --- | --- |
| Development | feature branches | test/local as appropriate |
| UAT | `uat` | Supabase `skolo-saka-test` (`faytrobauwibxujvmbct`) |
| Production | `main` | Supabase `skolo-saka` (`nnexzxszqjedaqqukfiq`) |

## Promotion flow

1. Develop on a feature branch.
2. Open a PR into `uat`.
3. CI must pass (`npm test` and `npm run build`).
4. Merge and deploy `uat` to the stable UAT Vercel environment.
5. Test against `skolo-saka-test`.
6. Record product-owner approval.
7. Open a PR from `uat` to `main`.
8. Merge only the approved release to production.

## Required UAT environment variables

UAT must use values belonging to `skolo-saka-test`, never production values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_APP_URL` — the stable UAT URL, never localhost
- `PAYSTACK_SECRET_KEY` — Paystack test key only
- `WINSMS_API_KEY` — test/sandbox configuration where available
- `SUPABASE_SMS_HOOK_SECRET`

Never commit secret values to GitHub.

## Release gate

Before promotion to `main`:

- CI passes.
- UAT deployment is healthy.
- Authentication and callbacks stay on the UAT domain.
- Registration/login works with test users.
- School flows work.
- Payments remain in test mode.
- No UAT action writes to production Supabase.
- Database migrations have been exercised in UAT first.
- No release-blocking browser/server errors remain.
- Product owner explicitly approves the UAT build.
