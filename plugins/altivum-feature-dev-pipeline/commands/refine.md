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
3. Load `.altivum/refine.json` if present (overrides: check commands, `functional` config, thresholds, base branch, merge method, defaults). Otherwise auto-detect build/lint/typecheck/test commands from package.json scripts / Makefile and use defaults.

## The cycle (repeat until exit); track cycle counter N from 1

### 1. ANALYZE
Run the recon analysis scoped by `path`/`lenses` exactly as `:recon` does (locate + read `workflows/audit.mjs`, run it via `Workflow({ script, args: { path, lenses } })`; fall back to dispatching the analyzer subagents, then inline). Produce the ranked brief.

### 2. PICK  ✋  (the one routine stop)
Present the ranked brief (numbered). Ask which item number(s) to take this cycle.
- Numbers (e.g. `2 4`) → take those. `done` / `stop` / `q` → EXIT the loop.
- If `--auto-pick[=N]`: skip this stop, auto-select the top N lowest-risk items, and never exceed `--max-cycles`.
Record the picked items as `{ id, title, desc }` (id = stable index from the brief).

### 3. BUILD + INTEGRATE + REVIEW  (autonomous)
Set `cycleBranch = refine/cycle-<N>-<slug>` (slug from the picked titles). Run the per-cycle workflow: locate + read `workflows/refine-cycle.mjs` and run `Workflow({ script, args: { items, base, cycleBranch, repoRoot, checks } })`. It builds the picked items IN PARALLEL (each in its own worktree), integrates them onto `cycleBranch`, runs the automated checks, and runs the adversarial review panel. It returns `{ integratedBranch, checks, conflictedItems, built, failedItems, confirmedReviewDefects }`.

### 4. QUALITY GATE  (the bar that must be green before any PR)
On `integratedBranch`, evaluate ALL of:
- **Functional operation (critical):** dispatch the `altivum-feature-dev-pipeline:functional-verifier` subagent with what changed (picked items + files) and the `functional` config. Require verdict **OPERATED** (or a justified **N/A** for non-operable changes). **CANNOT-OPERATE = fail.**
- **Automated checks:** `checks.build/lint/typecheck/test` are each `pass` or `not-applicable` (never `fail`).
- **Security:** dispatch `altivum-feature-dev-pipeline:security-reviewer` on the diff; no high/critical.
- **Review panel:** `confirmedReviewDefects` is empty.
- **Hygiene:** no secrets, no leftover TODO/placeholder/debug, diff scoped to the picked items.
- Note any `conflictedItems` / `failedItems` — they were dropped this cycle; report them.

### 5. REMEDIATE  (autonomous, bounded by --max-remediation, default 2)
If the gate fails, for each failing criterion dispatch a fix (execute-style) agent scoped to that specific failure on `cycleBranch`, then re-run only the failed checks/subagents. Repeat up to the bound.
- If one item is the culprit and still fails, **drop it** (revert its commits from `cycleBranch`) and re-run the gate on the remainder; report the drop.
- If the gate still fails with items remaining → **EXCEPTION**: stop, report exactly what failed with evidence, ask the user. **Never open a PR on a red gate.**

### 6. PR → WAIT GREEN → MERGE  (autonomous)
Once the gate is green:
1. `git push -u origin <cycleBranch>`.
2. `gh pr create --base <base> --head <cycleBranch>` with a title + body summarizing the cycle's items and the gate report (criteria + evidence).
3. Wait for remote checks if any exist: `gh pr checks <pr> --watch`.
   - All green → proceed. Any red → REMEDIATE the CI failure (fix → push → re-watch) up to `--max-remediation`; still red → EXCEPTION stop with the failing check's logs.
   - **No remote checks exist** → the local gate is the bar; proceed (safe because the functional criterion actually exercised the change).
4. If `--confirm-merge`: ask the user to confirm the merge (the optional 2nd stop). If `--no-merge`: stop here with the green PR link and continue to the next cycle without merging.
5. Merge: `gh pr merge <pr> --squash --delete-branch` (squash → one clean commit per cycle on `main`; override via `.altivum/refine.json`).
6. Sync: `git checkout <base> && git pull`.

### 7. LOOP
Increment N. If `--auto-pick` and N exceeds `--max-cycles`, exit. Otherwise return to ANALYZE (recon re-scans the now-improved base).

## Exit (user said "done", or --auto-pick hit --max-cycles)
Print a session summary: cycles run; items shipped per cycle; PRs merged (links/SHAs); anything dropped/skipped/conflicted; any exception that paused the loop. If the project deploys manually (no CI/CD on merge), note that merged changes may need `:deploy`.

## Exception stops (the ONLY non-pick halts)
- Quality gate cannot reach green after remediation.
- Remote CI stays red after remediation.
- Unresolvable integration conflict affecting all items.
- Setup failure: dirty tree, missing `gh` auth, or no base branch.
Each prints a precise report and waits — never guess past a red gate or a failed merge.

## Notes
- Intentionally heavy per cycle (recon + parallel build + review panel + live functional operation + CI wait). Scope with `path`/`lenses` to control cost. The pick gate is the throttle; only `--auto-pick` removes it (hence required `--max-cycles`).
- Distinct from `:ship` (one linear, fully-gated pass for a stated goal). `:refine` is the discovery-driven, looping, self-merging mode.
