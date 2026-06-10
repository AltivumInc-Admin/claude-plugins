---
description: The governor loop — sense gaps against intent, the inventor picks the quarter-turn (declining everything is valid), agents build in parallel, a hard quality gate (incl. live functional operation) must pass, auto-PR + auto-merge on green, journal the cycle, and loop. One routine stop — the pick.
argument-hint: "[path] [sensors…] [scout] [--auto-pick[=N] --max-cycles=N --confirm-merge --no-merge --max-parallel=N --max-remediation=N]"
---

# /hone:loop — the governor loop

Run the continuous refinement loop. Each cycle: sense the gap between code and intent → the inventor exercises taste over the report → picked quarter-turns are built in parallel → a hard quality bar (including actually OPERATING the change) must pass → auto-PR, auto-merge on green → journal → loop. Arguments: **$ARGUMENTS**.

The ONLY routine stop is the **pick gate** — that is where taste lives. Auto-PR and auto-merge are built in; never ask the user to "create a PR" or "merge it." Halt outside the pick only for the **exceptions** listed at the end.

> First runs: prefer `--no-merge` (leave green PRs open for review) or `--confirm-merge`. The default merges to your base branch unattended once you have picked.

## MOUNT (once, before the loop)
1. **Intent:** read `.altivum/intent.md`. Missing → STOP and offer `/hone:intent` (the mounting rule — sensors have nothing to measure against). Keep the full text for every cycle.
2. **Repo:** bind `repoRoot` = `git rev-parse --show-toplevel`; a **clean** git working tree; `gh` authed (`gh auth status`); the base branch (default `main`) current (`git checkout main && git pull`). Dirty tree or unauthed `gh` → STOP and ask.
3. Parse `$ARGUMENTS`:
   - `path`, `sensors` (any of `integrity coherence finish friction`), `scout` — scope the per-cycle scan (same parsing as `/hone:gap`; if no sensors given, present the sensor toggle ONCE here and reuse the selection every cycle).
   - Flags: `--auto-pick[=N]` (default N=3; **requires** `--max-cycles`), `--max-cycles=N`, `--confirm-merge`, `--no-merge`, `--max-parallel=N`, `--max-remediation=N` (default 2).
   - **Guard:** `--auto-pick` without `--max-cycles` → STOP and ask (never run an unbounded, taste-free loop).
4. Load `.altivum/hone.json` if present (overrides: check commands, `functional` config, thresholds, base branch, merge method, defaults). Otherwise auto-detect build/lint/typecheck/test/coverage from package.json scripts / Makefile. Load `~/.altivum/hone.json` for the journal's vault mirror path (absent/null → repo journal only).

## The cycle (repeat until exit); track cycle counter N from 1

### 1. SENSE
Run the gap scan exactly as `/hone:gap` does (locate + read `workflows/gap-scan.mjs`, run `Workflow({ script, args: { path, sensors, scout, intent } })`; fall back to Task-dispatched sensors, then inline — same synthesis rules). Produce the clause-grouped, numbered gap report. If the scan result carries an `error` field, surface it and STOP (exception) — a failed scan is not a clean reading.
- **Zero gaps** → report "No gaps found against intent at current resolution.", journal the clean reading (step RECORD, abbreviated), and ask: raise resolution (narrower path / more sensors), or exit? A clean reading is success, not a malfunction.

### 2. PICK  ✋  (the governor gate — the one routine stop)
Present the gap report grouped by intent clause. The inventor exercises taste:
- Numbers (e.g. `2 4`) → take those this cycle.
- **Decline all** (`none`, `pass`) → a first-class outcome: journal "gaps presented, none chosen" with the gaps listed, then re-loop or exit at the user's word. Taste saying "not these" is data, not failure.
- `done` / `stop` / `q` → EXIT the loop.
- If `--auto-pick[=N]`: skip this stop and auto-select the **N smallest turns first** (sort by turn size: small → medium → large, breaking ties by rank). Unattended cycles err toward restraint — the clause-citation rule already guarantees every candidate serves intent; smallest-first guarantees the loop without taste stays conservative. Never exceed `--max-cycles`.
Record the picked gaps as `{ id, title, desc }` (id = stable number from the report; include the clause and proposed quarter-turn in `desc`).

### 3. TURN  (autonomous)
Set `cycleBranch = hone/cycle-<N>-<slug>` (slug from the picked titles; unique per cycle). Locate + read `workflows/turn-cycle.mjs` and run `Workflow({ script, args: { items, base, cycleBranch, repoRoot, checks, maxParallel } })` (`maxParallel` comes from `--max-parallel`; 0/omitted = the engine's own cap). It builds the picked turns IN PARALLEL (each on its own branch in its own worktree, TDD), integrates them onto `cycleBranch`, runs the automated checks, and runs the adversarial review panel. Returns `{ integratedBranch, checks, conflictedItems, built, failedItems, confirmedReviewDefects }`.

### 4. QUALITY GATE  (must be green before any PR)
On `integratedBranch`, evaluate ALL of:
- **Something actually shipped:** `built` non-empty AND the integrated diff vs `<base>` non-empty. Otherwise EXCEPTION — nothing to operate or ship; report and return to the pick gate (or exit).
- **Functional operation (critical):** dispatch the `hone:functional-verifier` subagent with what changed (picked turns + files) and the `functional` config. Require verdict **OPERATED**. **CANNOT-OPERATE** fails the gate. For a **web/UI change**, an N/A or "browser unavailable" verdict ALSO fails (a web change that can't be driven is not shippable). A justified **N/A** is acceptable ONLY for genuinely non-operable changes (pure infra/config with no runtime surface).
- **Automated checks:** `checks.build / lint / typecheck / test / coverage` each `pass` or a *legitimate* `not-applicable`. Any `fail` — including an expected-but-undetectable check — fails the gate. If the workflow result carries an `error` field or `checks` is missing/null (integration failed), that is an EXCEPTION — report it; never read a missing checks object as a pass.
- **Security:** dispatch `hone:security-reviewer` on the diff; no high/critical.
- **Review panel:** `confirmedReviewDefects` is empty.
- **Hygiene:** no secrets, no leftover TODO/placeholder/debug, diff scoped to the picked turns.
- Note `conflictedItems` / `failedItems` — dropped this cycle; report them.

### 5. REMEDIATE  (autonomous, bounded by --max-remediation, default 2)
Gate fails → for each failing criterion dispatch a fix (execute-style) agent scoped to that failure on `cycleBranch`, re-run only the failed checks/subagents, up to the bound (the bound is per phase: local-gate remediation here and remote-CI remediation in step 6 each get up to N attempts).
- One culprit turn still failing → **drop it**: rebuild `cycleBranch` from `<base>` merging only the surviving item branches, re-run the gate on the remainder, report the drop.
- Still red with turns remaining → **EXCEPTION**: stop, report exactly what failed with evidence. **Never open a PR on a red gate.**

### 6. PR → WAIT GREEN → MERGE  (autonomous)
1. `git push -u origin <cycleBranch>`.
2. `PR_URL=$(gh pr create --base <base> --head <cycleBranch> --title "…" --body "…")` — title + body summarize the picked turns, the clauses they serve, and the gate report (criteria + evidence). Use `"$PR_URL"` for every subsequent `gh` call this cycle.
3. Remote checks if any: `gh pr checks "$PR_URL" --watch`. Red → remediate (fix → push → re-watch) up to `--max-remediation`; still red → EXCEPTION with the failing check's logs. No remote checks → the local gate is the bar (safe: the functional criterion actually exercised the change).
4. `--confirm-merge` → ask before merging (the optional 2nd stop). `--no-merge` → do NOT merge; leave the green PR open, `git checkout <base>` (no pull) before looping. Note: under `--no-merge` the base never advances, so each cycle re-scans the same code — use it for review-first runs, not unattended loops.
5. Merge: `gh pr merge "$PR_URL" --squash --delete-branch` (override method via `.altivum/hone.json`).
6. Sync: `git checkout <base> && git pull`.

### 7. RECORD  (the journal — memory now, mechanism later)
Append to `.altivum/journal.md` in the repo (create with a `# Hone Journal` heading if absent), one entry per cycle:

    ## Cycle <N> — <date> (intent as of <date of newest Living revision>)
    Sensed: <count> gaps (<sensor> ×<n> → "<clause>", …)
    Picked: <ids+titles>. Declined: <ids + the inventor's stated reason, verbatim where given>
    Shipped: <PR URL> (<merged | left open (--no-merge)>)
    Could not close: <turns dropped/failed and why, or "—">
    Signal: <scout evidence + clause-less findings, one line each, or "—">

Dates come from `date +%Y-%m-%d` (Bash) — never guessed. "Could not close within living intent" entries are how core-pressure becomes visible over time — record them faithfully; attach no mechanism. Journal commit mechanics: after a merge, commit the entry to `<base>` and push (message `hone: journal cycle <N>`); if the base branch is protected and rejects direct pushes, carry the entry into the next cycle's branch or a tiny journal PR at session end. Under `--no-merge`, push the entry as an additional commit on the open cycle branch so it lands with the eventual merge (journal-only — never append code after the gate has run).
**Vault mirror:** if `~/.altivum/hone.json` has a non-null `vault`, append the same entry to `<vault>/Hone/<repo-name>.md` (create the folder/file on first write with YAML frontmatter `project`, `cycle`, `date`, `tags: [hone]`; update `cycle` and `date` on each append; add `[[wikilinks]]` where natural). **Collision guard:** if the file already exists and its frontmatter `project` differs from this repo (compare remote URL or absolute path), write to `<vault>/Hone/<repo-name>-<parent-dir-name>.md` instead — never clobber another project's logbook. Vault missing/unwritable → skip with a one-line note; NEVER fail the cycle over the logbook.

### 8. LOOP
Increment N. `--auto-pick` and N exceeds `--max-cycles` → exit. Otherwise return to SENSE (re-scanning the now-improved base — or, under `--no-merge`, the unchanged base).

## Exit (user said "done", or --auto-pick hit --max-cycles)
Print a session summary: cycles run; turns shipped per cycle (and the clauses they served); PRs merged (links/SHAs); everything declined/dropped/conflicted; any exception that paused the loop. If the project deploys manually (no CI/CD on merge), note that merged changes may need `/hone:deploy`.

## Exception stops (the ONLY non-pick halts)
- Mount failure: no intent file, dirty tree, missing `gh` auth, no base branch, or `--auto-pick` without `--max-cycles`.
- Nothing shipped: every picked turn failed or conflicted (empty diff).
- Quality gate cannot reach green after remediation.
- Remote CI stays red after remediation.
- Unresolvable integration conflict affecting all turns.
Each prints a precise report and waits — never guess past a red gate or a failed merge.

## Notes
- Intentionally heavy per cycle (scan + parallel build + review panel + live functional operation + CI wait). Scope with `path`/`sensors`. The pick gate is the throttle; only `--auto-pick` removes it (hence required `--max-cycles`).
- Distinct from `/hone:turn` (one inventor-stated adjustment, gated phase-by-phase). The loop is discovery-driven and self-merging; `turn` is the inventor's direct door.
