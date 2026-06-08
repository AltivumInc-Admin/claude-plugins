#!/usr/bin/env bash
# PreToolUse(Bash) BLOCKING gate for altivum-feature-dev-pipeline.
#
# Blocks production-MUTATING deploy commands until they are explicitly approved.
# Safe/preview steps (sam build, sam package, create-change-set, describe-*,
# dry-runs) are NOT blocked, so the normal deploy prep flow is unimpeded.
#
# Exit codes (PreToolUse): 2 = block the tool call (stderr is shown to Claude);
# 0 = allow. The gate always allows non-deploy commands.
#
# To proceed past the gate, re-run the SAME command prefixed with the approval
# token AFTER confirming with the user:
#     ALTIVUM_DEPLOY_APPROVED=1 <command>
#
# This is a deliberate-action speed bump (it forces an explicit, auditable
# approval step before an irreversible prod action) — not a hard security
# boundary. Point hooks.json at pre-deploy-reminder.sh instead for non-blocking.

input="$(cat 2>/dev/null)"

# Production-mutating / irreversible commands only.
DEPLOY_RE='sam[[:space:]]+deploy|cloudformation[[:space:]]+(execute-change-set|deploy|update-stack|delete-stack)|amplify[[:space:]]+start-job|cdk[[:space:]]+(deploy|destroy)|terraform[[:space:]]+(apply|destroy)|serverless[[:space:]]+deploy'

if printf '%s' "$input" | grep -qiE "$DEPLOY_RE"; then
  if printf '%s' "$input" | grep -qE 'ALTIVUM_DEPLOY_APPROVED=1'; then
    exit 0  # explicitly approved — allow
  fi
  printf '%s\n' \
    "BLOCKED by altivum-feature-dev-pipeline pre-deploy gate." \
    "This command mutates production. Confirm with the user first, verifying:" \
    "  1. Change set reviewed — no stateful resource (db/bucket/user pool) replaced?" \
    "  2. Secrets preserved via UsePreviousValue (never fabricated/re-supplied)?" \
    "  3. Data migration dry-run done before --apply?" \
    "  4. Explicit user approval for this irreversible/outward-facing action?" \
    "Then re-run the SAME command prefixed with:  ALTIVUM_DEPLOY_APPROVED=1 <command>" >&2
  exit 2  # block
fi

exit 0
