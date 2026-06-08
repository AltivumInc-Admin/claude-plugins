---
description: Execute a previously generated implementation plan with precision, TDD, and verification.
argument-hint: "[plan number(s) like '1 2', 'all', or 'the plan']"
---

# Execute Implementation Plan

Execute the previously generated plan(s) indicated by **$ARGUMENTS**.

## Parse the request
- Number(s) -> execute those plan(s). "all" -> execute all. If unclear, ask which.

## Execution rules
1. Follow the plan exactly, step by step, in order. Do not skip steps or cut corners.
2. **Use TDD for features and bugfixes:** write the failing test first, watch it fail for the right reason, write the minimal code to pass, then refactor. No production code without a failing test first.
3. **For UI work**, follow the project's design system / frontend conventions (and any frontend-design guidance) so new components match the existing aesthetic.
4. Create/modify/delete every file the plan specifies.
5. Keep the project green continuously — run lint, typecheck, tests, and build, and **cite real output**. Fix breakage immediately.
6. **Security-sensitive changes** (auth/authz, input handling, file uploads, data access, IAM/IaC, external requests, crypto/tokens) — invoke the **security-reviewer** subagent on the diff before considering the work done; address any high/critical findings.
7. If a step needs a human decision or input, **stop and ask** before proceeding.
8. If you hit an error or blocker, report it with context and a proposed fix — don't silently work around it.
9. Use a feature branch if the repo follows that workflow. Commit/push/PR only when the user asks.

## When complete — Mission Debrief
```
MISSION DEBRIEF
===============
Executed: [which plan(s)]
Completed Steps: [summary of each major step]
Deviations from Plan: [what differed and why, or "None"]
Errors Encountered: [hit + how resolved, or "None"]
Current Project Status: [state of the codebase; what works now that didn't]
Verification: [lint/types/tests/build results — actual output]
Recommended Next Steps: [follow-ups, incl. deploy]
```

Before claiming completion, confirm with real command output. Evidence before assertions.
