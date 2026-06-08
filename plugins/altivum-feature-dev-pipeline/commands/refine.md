---
description: Continuous, quality-gated refinement loop — recon finds improvements, you pick, agents build them in parallel, a high quality bar (incl. live functional operation) must pass, then it auto-opens a PR and auto-merges on green, and loops. One routine stop: the pick.
argument-hint: "[path] [lenses…] [--auto-pick[=N] --max-cycles=N --confirm-merge --no-merge --max-parallel=N --max-remediation=N]"
---

# /refine — continuous refinement loop

Run an ongoing improvement loop over this project. Each cycle finds the highest-impact improvements, lets the user pick, builds them in parallel, holds them to a high quality bar (including actually OPERATING the change), then auto-opens a PR and auto-merges once everything is green — and loops. Arguments: **$ARGUMENTS**.

The ONLY routine stop is the **pick gate**. Auto-PR and auto-merge are built in — never ask the user to "create a PR" or "merge it." Halt outside the pick gate only for the **exceptions** listed at the end.

## Setup (once, before the loop)
1. Confirm prerequisites: a **clean** git working tree; `gh` is authed (`gh auth status`); the base branch (default `main`) is current (`git checkout main && git pull`). If the tree is dirty or `gh` is unauthed, STOP and ask.
2. Parse `$ARGUMENTS`:
   - `path` = the first token that looks like a path/area; `lenses` = any recognized lens names (`eval`, `improve`, `improve-ui`, `improve-x2`, `enhance`). These scope the recon analysis.
   - Flags: `--auto-pick[=N]` (default N=3; **requires** `--max-cycles`), `--max-cycles=N`, `--confirm-merge`, `--no-merge`, `--max-parallel=N`, `--max-remediation=N` (default 2).
   - **Guard:** if `--auto-pick` is set but `--max-cycles` is not, STOP and ask (setup exception). `--auto-pick` removes the pick gate, so an explicit cycle ceiling is mandatory — never run an unbounded, stop-free loop.
3. Load `.altivum/refine.json` if present (overrides: check commands, `functional` config, thresholds, base branch, merge method, defaults). Otherwise auto-detect build/lint/typecheck/test/coverage commands from package.json scripts / Makefile and use defaults.

## The cycle (repeat until exit); track cycle counter N from 1

### 1. ANALYZE
Run the recon analysis scoped by `path`/`lenses` exactly as `:recon` does (locate + read `workflows/audit.mjs`, run it via `Workflow({ script, args: { path, lenses } })`; fall back to dispatching the analyzer subagents, then inline). Produce the ranked brief.

### 2. PICK  ✋  (the one routine stop)
Present the ranked brief (numbered). Ask which item number(s) to take this cycle.
- Numbers (e.g. `2 4`) → take those. `done` / `stop` / `q` → EXIT the loop.
- If `--auto-pick[=N]`: skip this stop, auto-select the top N lowest-risk items, and never exceed `--max-cycles`.
Record the picked items as `{ id, title, desc }` (id = stable index from the brief, scoped to this cycle).

### 3. BUILD + INTEGRATE + REVIEW  (autonomous)
Set `cycleBranch = refine/cycle-<N>-<slug>` (slug from the picked titles; unique per cycle). Run the per-cycle workflow: locate + read `workflows/refine-cycle.mjs` and run `Workflow({ script, args: { items, base, cycleBranch, repoRoot, checks, maxParallel } })` (pass `maxParallel` from `--max-parallel`, or omit/0 for the workflow's own cap). It builds the picked items IN PARALLEL (each on its own per-cycle branch in its own worktree), integrates them onto `cycleBranch`, runs the automated checks, and runs the adversarial review panel. It returns `{ integratedBranch, checks, conflictedItems, built, failedItems, confirmedReviewDefects }`.

### 4. QUALITY GATE  (the bar that must be green before any PR)
On `integratedBranch`, evaluate ALL of:
- **Something actually shipped:** at least one item built (`built` non-empty) AND the integrated diff vs `<base>` is non-empty. If `built` is empty or the diff is empty (e.g. every item conflicted/failed), this is an **EXCEPTION** — do not open a PR; report and return to the pick gate (or exit). There is nothing to operate or ship.
- **Functional operation (critical):** dispatch the `altivum-feature-dev-pipeline:functional-verifier` subagent with what changed (picked items + files) and the `functional` config. Require verdict **OPERATED**. A **CANNOT-OPERATE** verdict fails the gate. For a **web/UI change**, an N/A or "browser unavailable" verdict ALSO fails the gate (a web change that can't be driven is not shippable — that is the whole point). A justified **N/A** is acceptable ONLY for genuinely non-operable changes (pure infra/config with no runtime surface).
- **Automated checks:** `checks.build / lint / typecheck / test / coverage` are each `pass` or a *legitimate* `not-applicable`. Any `fail` — including a check that was expected for this project but couldn't be detected/run — fails the gate.
- **Security:** dispatch `altivum-feature-dev-pipeline:security-reviewer` on the diff; no high/critical.
- **Review panel:** `confirmedReviewDefects` is empty.
- **Hygiene:** no secrets, no leftover TODO/placeholder/debug, diff scoped to the picked items.
- Note any `conflictedItems` / `failedItems` — they were dropped this cycle; report them.

### 5. REMEDIATE  (autonomous, bounded by --max-remediation, default 2)
If the gate fails, for each failing criterion dispatch a fix (execute-style) agent scoped to that specific failure on `cycleBranch`, then re-run only the failed checks/subagents. Repeat up to the bound.
- If one item is the culprit and still fails, **drop it**: rebuild `cycleBranch` from `<base>` merging only the surviving item branches (cleaner and more reliable than reverting a `--no-ff` merge), re-run the gate on the remainder, and report the drop.
- If the gate still fails with items remaining → **EXCEPTION**: stop, report exactly what failed with evidence, ask the user. **Never open a PR on a red gate.**

### 6. PR → WAIT GREEN → MERGE  (autonomous)
Once the gate is green:
1. `git push -u origin <cycleBranch>`.
2. Open the PR and CAPTURE its handle: `PR_URL=$(gh pr create --base <base> --head <cycleBranch> --title "…" --body "…")` with a title + body summarizing the cycle's items and the gate report (criteria + evidence). Use `"$PR_URL"` as the PR handle for every subsequent `gh` call this cycle.
3. Wait for remote checks if any exist: `gh pr checks "$PR_URL" --watch`.
   - All green → proceed. Any red → REMEDIATE the CI failure (fix → push → re-watch) up to `--max-remediation`; still red → EXCEPTION stop with the failing check's logs.
   - **No remote checks exist** → the local gate is the bar; proceed (safe because the functional criterion actually exercised the change).
4. If `--confirm-merge`: ask the user to confirm the merge (the optional 2nd stop). If `--no-merge`: do NOT merge — leave the green PR open, then `git checkout <base>` (do NOT pull; the PR is unmerged) before looping. Note: with `--no-merge`, merged work never lands in `<base>`, so recon re-scans the same base each cycle — use `--no-merge` for review-first runs, not unattended loops.
5. Merge: `gh pr merge "$PR_URL" --squash --delete-branch` (squash → one clean commit per cycle on `main`; override the method via `.altivum/refine.json`).
6. Sync: `git checkout <base> && git pull`.

### 7. LOOP
Increment N. If `--auto-pick` and N exceeds `--max-cycles`, exit. Otherwise return to ANALYZE (recon re-scans the now-improved base — or, under `--no-merge`, the unchanged base).

## Exit (user said "done", or --auto-pick hit --max-cycles)
Print a session summary: cycles run; items shipped per cycle; PRs merged (links/SHAs); anything dropped/skipped/conflicted; any exception that paused the loop. If the project deploys manually (no CI/CD on merge), note that merged changes may need `:deploy`.

## Exception stops (the ONLY non-pick halts)
- Setup failure: dirty tree, missing `gh` auth, no base branch, or `--auto-pick` without `--max-cycles`.
- Nothing shipped: every picked item failed or conflicted (empty diff).
- Quality gate cannot reach green after remediation.
- Remote CI stays red after remediation.
- Unresolvable integration conflict affecting all items.
Each prints a precise report and waits — never guess past a red gate or a failed merge.

## Notes
- Intentionally heavy per cycle (recon + parallel build + review panel + live functional operation + CI wait). Scope with `path`/`lenses` to control cost. The pick gate is the throttle; only `--auto-pick` removes it (hence required `--max-cycles`).
- Distinct from `:ship` (one linear, fully-gated pass for a stated goal). `:refine` is the discovery-driven, looping, self-merging mode.
