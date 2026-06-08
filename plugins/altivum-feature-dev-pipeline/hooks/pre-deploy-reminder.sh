#!/usr/bin/env bash
# PreToolUse(Bash) hook for altivum-feature-dev-pipeline.
# NON-BLOCKING reminder: when a Bash command looks like a production deploy,
# print a short pre-flight checklist to stderr. Always exits 0 so it can never
# block a tool call.
#
# The hook payload arrives as JSON on stdin; we grep the raw text (no jq dependency).

input="$(cat 2>/dev/null)"

if printf '%s' "$input" | grep -qiE 'sam deploy|execute-change-set|cloudformation (deploy|create-change-set|update-stack)|amplify (start-job|update-app)|cdk deploy|terraform apply|serverless deploy'; then
  printf '%s\n' \
    "[altivum-feature-dev-pipeline] Production-deploy command detected. Pre-flight:" \
    "  - Change set reviewed? (no stateful resource replacement: db / bucket / user pool)" \
    "  - Secrets preserved via UsePreviousValue (never re-supplied/fabricated)?" \
    "  - Data migration dry-run done before --apply?" \
    "  - Explicit approval to mutate production / take an irreversible action?" >&2
fi

exit 0
