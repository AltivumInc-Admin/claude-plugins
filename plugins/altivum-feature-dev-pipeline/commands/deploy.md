---
description: Deploy the implemented change safely — feasibility check, reviewable/reversible mechanisms, migrations, and live verification.
argument-hint: "[optional target/scope, e.g. 'backend only' or 'frontend']"
---

# Deploy

Carry out the deployment for **$ARGUMENTS** (or the full change if unspecified). Treat production as a live system: prefer reviewable, reversible steps and confirm before anything irreversible or outward-facing.

## 1. Establish feasibility (read-only first)
- Confirm credentials/identity and the target account/region (e.g. `aws sts get-caller-identity`).
- Locate the deploy targets (stacks, apps, pipelines) and their current state.
- Identify required inputs/secrets. **Never fabricate secret values.** For existing IaC stacks, read non-secret params and plan to preserve secrets via `UsePreviousValue` (CloudFormation/SAM) rather than re-supplying them.
- Check for live data that a change could disrupt (e.g. records pointing at resources you're about to change) and whether there's a migration to run.

## 2. Prefer safe mechanisms
- **IaC updates:** build + package, then create a **change set** and REVIEW it before executing. Verify no stateful resource (database, bucket, user pool) is being *replaced*. Use `CAPABILITY_IAM CAPABILITY_AUTO_EXPAND` for SAM transforms; pass `UsePreviousValue=true` for NoEcho params.
- **Data migrations:** run **dry-run first**, show the diff, then `--apply`. Make migrations idempotent and re-runnable.
- **App/frontend deploys:** know what triggers them (e.g. merge to main -> CI build) and that they only swap on success, so a failed build leaves the live site intact.

## 3. Confirm at the point of no return
Even when broadly authorized, surface NEW material risk before executing: downtime windows, data migration, secret handling, repo/IAM/config changes the user didn't specifically authorize. Get explicit go-ahead for those.

## 4. Execute in dependency order
Typical order: backend/infra -> data migration (close any compatibility gap immediately) -> config/env -> frontend/app -> merge/release. Sequence so the live site is never broken longer than necessary.

## 5. Verify live
Use the **deploy-validator** subagent (or do it inline): confirm stack/app status, hit live endpoints, check the deployed artifact reflects the new build, and confirm migrated data resolves. Cite real output (HTTP codes, API responses, job statuses).

## 6. Debrief
Report what shipped, what was verified, deviations, errors + resolutions, and any manual steps only the user can perform (console actions, secrets, DNS).

## Hard-won gotchas (AWS)
- **"Unable to assume specified IAM Role" on AWS Amplify is usually NOT an IAM problem** — it most often means the Amplify GitHub App lost access to the repo (common on older OAuth-era apps). Fix by reconnecting the repository / re-granting the GitHub App access in GitHub org settings or the Amplify console, then retry the build. Don't chase the IAM role.
- A repo `amplify.yml` **overrides** any console/inline build spec.
- The "Sign-in not configured" type screens usually mean missing frontend env vars in the hosting console, not a code bug — verify env vars before debugging code.
- Permission/safety classifiers may block inferred prod config changes (IAM, service roles, deploys) you weren't explicitly told to make — that's a signal to stop and confirm, not to work around.
