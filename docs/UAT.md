# Skolo Saka UAT

## Purpose

UAT is the mandatory validation environment between feature development and production.

## Environment map

| Environment | Git ref | Database | Intended URL |
| --- | --- | --- | --- |
| Development | feature branches | local/test as appropriate | Vercel preview URL |
| UAT | `uat` | Supabase `skolo-saka-test` (`faytrobauwibxujvmbct`) | stable UAT Vercel URL/domain |
| Production | `main` | Supabase `skolo-saka` (`nnexzxszqjedaqqukfiq`) | `skolosaka.co.za` / production aliases |

## Promotion flow

1. Create a feature branch from `uat` (or bring the feature branch up to date with `uat`).
2. Implement a small, reviewable change.
3. Open a pull request into `uat`.
4. CI must pass (`npm test` and `npm run build`).
5. Merge into `uat` only after review.
6. Vercel deploys `uat` to the stable UAT environment using UAT-only environment variables.
7. Validate the change against the `skolo-saka-test` Supabase project.
8. Record UAT approval.
9. Promote the approved `uat` commit to `main` through a pull request.
10. Production deploys from `main` using production-only environment variables.

## Required Vercel UAT variables

The UAT deployment must use values belonging to `skolo-saka-test`, never production values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_APP_URL` — stable UAT URL, not localhost
- `PAYSTACK_SECRET_KEY` — test key only
- `WINSMS_API_KEY` — test/sandbox configuration where available
- `SUPABASE_SMS_HOOK_SECRET`

Never commit secret values to GitHub.

## Production safety rules

- `main` is the only production source branch.
- Feature branches must never point at the production Supabase project.
- UAT must never use a live Paystack secret key.
- Database migrations are tested on `skolo-saka-test` before production.
- Production schema changes happen only as part of an approved promotion.
- A failed UAT check blocks promotion.

## UAT acceptance checklist

Before promoting a release:

- CI passes.
- UAT deployment is healthy.
- Authentication works and callbacks remain on the UAT domain.
- Test user registration/login works.
- School search/profile flows work.
- Payment flows use Paystack test mode.
- No UAT action writes to the production Supabase project.
- New database migrations have been exercised in UAT.
- Browser and server logs have no release-blocking errors.
- Product owner has explicitly approved the UAT build.
