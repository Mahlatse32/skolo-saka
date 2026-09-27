# Budgeted five-role agent setup

This workflow uses **one Codex invocation for one approved GitHub issue**. The planner, developer, tester, reviewer and release reporter are stages of that invocation, not five separately billed agents. GitHub Actions runs the existing tests and build; each successful change becomes a **draft** pull request. Nothing in this workflow merges or deploys to production.

## Activation order

1. The separate Supabase project `skolo-saka-test` already exists. The analytics table and summary function exist there, but the analytics migration is absent from its migration history; reconcile history before running a bulk migration command. Populate only synthetic test records. Set up sandbox Paystack, test SMS and test email independently. Check the Supabase Auth redirect allowlist for the UAT URL.
2. In Vercel, map UAT to a non-production branch/environment. The current project shares `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` across Production and Preview. Replace those shared values with environment-specific production and test values, and explicitly set test-only `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_APP_URL` and payment/SMS settings for Preview. This PR removes the hardcoded fallback and rejects Preview builds targeting the production Supabase URL. Confirm the actual deployed preview points to UAT. Do not attach the live Paystack key or production service-role key to Preview.
3. Protect `main` in GitHub with PR review and required CI checks. In Vercel, keep `main` as the only production branch. Production credentials belong only to the production environment, with access restricted to the owner.
4. The dedicated OpenAI project `Skolo Saka Development Agent` exists. It currently has no API credit or payment method. Fund it with a deliberate limit, configure spending controls and alerts, then add a project-scoped API key as the GitHub Actions secret `OPENAI_API_KEY`. Billing and the ChatGPT subscription are separate. Do not add production credentials to GitHub Actions.
5. Set GitHub Actions repository variable `AGENT_MAX_RUNS_PER_DAY=1` and, after all checks above, `AGENT_ENABLED=true`. Add the `agent-ready` label to issues you approve for development. Labelling by Mahlatse triggers a run; a daily scheduled check picks the oldest approved open issue. Manual runs require Mahlatse and an approved issue number.

The workflow has a 45-minute timeout, one concurrent run and a configurable daily run limit of 1–4 actual Codex invocations. The run limit limits work, **not dollars**: model token usage varies per issue. The API project budget is the cost control; confirm its actual billing behaviour and set a spending limit outside this repository. A scheduled run with no approved issue does not invoke Codex.

## Review and release

The draft PR contains the agent's summary and passing local checks. Before UAT, inspect migrations, auth, payment and data changes. Merge to a protected UAT branch only after review, verify UAT against its own database, and record the preview URL and test results. When satisfied, approve a separate release into `main`. Never treat the existence of a Vercel preview as proof it is isolated from production.

## What is not provisioned by this PR

The UAT Supabase project, Vercel environment and domain, sandbox credentials, GitHub branch protection, OpenAI billing limit and GitHub secret/variables require account-level setup. The workflow is deliberately inactive until those are configured. It does not provide five independent agents or continuous unattended production releases.
