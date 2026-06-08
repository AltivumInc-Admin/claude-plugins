---
description: Run the full Altivum feature pipeline — eval -> plan -> execute -> deploy — with a human approval gate between every phase.
argument-hint: "[feature/goal description, or a path/PR to work from]"
---

# /ship — Feature Development Pipeline Orchestrator

You are orchestrating Altivum's end-to-end feature pipeline for: **$ARGUMENTS**

Run the four phases **in order**. This is a human-in-the-loop pipeline: after each phase, **stop, summarize the result, and wait for the user's explicit go-ahead** before starting the next phase. Never auto-advance past a gate.

The phase logic lives in the sibling commands of this plugin — apply the same instructions they contain:
- `/altivum-feature-dev-pipeline:eval`
- `/altivum-feature-dev-pipeline:plan`
- `/altivum-feature-dev-pipeline:execute`
- `/altivum-feature-dev-pipeline:deploy`

## Sequence

1. **EVAL** — Run the eval phase to understand the codebase and surface prioritized recommendations. If `$ARGUMENTS` already names a specific change, scope the eval to the relevant area. Present the numbered recommendations.
   - **GATE:** Ask which recommendation(s) to carry forward (or confirm the stated goal). Wait.

2. **PLAN** — For the chosen item(s), produce the detailed implementation plan(s) (objective, steps, file changes, tests, risks, effort). Surface any decisions only the user can make.
   - **GATE:** Get plan approval and resolve open decisions. Wait.

3. **EXECUTE** — Implement the approved plan(s). Use TDD where applicable (write the failing test first, then the code). Keep the build/lint/types/tests green at every step; verify with real command output before claiming done. If the project uses a branch workflow, work on a feature branch.
   - **GATE:** Present the diff/verification summary. Get approval to deploy. Wait.

4. **DEPLOY** — Carry out the deploy per the deploy phase: verify feasibility first, prefer reviewable/reversible mechanisms, never fabricate secrets, run data migrations dry-run before `--apply`, and confirm before any irreversible or outward-facing production action. Verify the live result.
   - Finish with a concise debrief (what shipped, what was verified, anything outstanding, and any manual steps only the user can do).

## Operating principles (apply throughout)
- **Evidence before assertions.** Run the actual checks (lint, types, tests, build, live endpoints) and quote the output. If something failed or was skipped, say so.
- **Confirm irreversible/outward-facing prod actions** — even when broadly authorized, surface new material risk (downtime windows, data migration, secret handling) at the point of no return.
- **Don't fabricate secrets or guess production config** — read existing values, use `UsePreviousValue` for NoEcho parameters, and ask when blocked.
- **Stay faithful to the user's decisions** from each gate; don't silently expand scope.

If the user passed a single phase name in `$ARGUMENTS` (e.g. "just eval"), run only that phase.
