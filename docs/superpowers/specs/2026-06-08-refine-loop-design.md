# Design: `:refine` — Continuous, Quality-Gated Refinement Loop

- **Date:** 2026-06-08
- **Status:** Approved (ready for implementation plan)
- **Author:** Christian Perez (Altivum Inc.)
- **Plugin:** `plugins/altivum-feature-dev-pipeline` (current `0.3.0` → target `0.4.0`)
- **Builds on:** the analysis lenses + `recon` workflow shipped in 0.3.0
  (`docs/superpowers/specs/2026-06-08-analysis-lenses-design.md`).

## 1. Context & problem

0.3.0 gave the plugin analysis lenses (`eval`, `improve`, `improve-ui`, `improve-x2`,
`enhance`) and a Workflow-powered multi-lens `recon` that produces a ranked brief. But turning
that brief into shipped improvements is still manual: pick → `plan` → `execute` → review → PR →
merge, each step hand-driven.

The goal is a **continuous refinement loop** the user can run "over and over" with **as few stops
as possible (1, maybe 2)**: it should discover improvements, build them with **multiple agents in
parallel**, hold every cycle to an **extremely high quality bar**, and — once that bar and all PR
checks are green — **open a PR and merge to `main` automatically**, then loop. The human stays in
control of *what* gets worked on; everything downstream runs autonomously.

## 2. Goals / non-goals

**Goals**
- A `:refine` command that loops: analyze → **pick (the one routine stop)** → build → quality-gate
  → PR → wait-green → merge → re-scan → repeat, until the user says "done".
- Parallel, worktree-isolated, multi-item execution; liberal use of agents and Workflows.
- A configurable, **very high quality gate** that must pass before any PR opens — whose **most
  critical, must-pass criterion is that an agent can actually operate the changed functionality**
  (web: via Claude-in-Chrome; non-web: interface-level exercise). "If the agent can't do it, a
  person can't."
- Automatic PR creation and **auto-merge on green** (local gate + remote checks). No "create a
  PR" / "now merge it" stops.
- Deploy is **downstream of merge** (the repo's CI/CD on merge); no per-cycle deploy stop.

**Non-goals**
- Not changing the existing lenses / `recon` / `plan` / `execute` / `deploy` / `ship` behavior
  (only reuse + one note pointing at `:refine`).
- Not building a generic CI system; we drive the repo's existing checks via `gh`.
- Not auto-deploying inside the loop (an optional post-merge deploy is explicitly out of scope for
  v1; merging to `main` is the cycle's finish line).

## 3. The cycle

Happy path = **one routine stop (PICK)**. Other halts are *exceptions* only.

```
Cycle N  (on branch refine/cycle-<N>-<slug>, cut fresh from up-to-date main)
 1. ANALYZE        run the recon workflow (scoped by [path]/[lenses]) → ranked brief   [autonomous]
 2. ✋ PICK         present brief; user chooses item numbers — or "done" to exit         [stop #1]
 3. BUILD          picked items built IN PARALLEL, each in its own git worktree:
                   plan → execute (TDD) → commit per improvement                        [autonomous]
 4. INTEGRATE      merge item branches → cycle branch (sequential; conflict → serialize) [autonomous]
 5. QUALITY GATE   the full bar (§4) must pass; autonomous remediation until green       [autonomous]
 6. PR             push cycle branch; gh pr create → main                                [autonomous]
 7. WAIT GREEN     watch remote PR checks/CI (if any) until green                        [autonomous]
 8. MERGE          auto-merge to main on green; pull main locally                        [autonomous]
 9. LOOP           re-scan the improved main → Cycle N+1 (back to PICK)                  [autonomous]
```

**Exit:** the user types "done" (or a synonym) at the PICK gate → the loop ends and prints a
session summary (cycles run, items shipped, PRs merged, anything dropped).

**Exception stops** (only): quality gate can't reach green after the remediation bound; remote CI
stays red after the remediation bound; an unresolvable integration conflict. Each surfaces a clear
report and pauses for the human rather than guessing.

## 4. The quality gate (must ALL pass before a PR opens)

Run on the integrated cycle branch. Criteria 1–8 are the **local gate** (pre-PR); criterion 9 is
the **remote gate** (post-PR, step 7). Merge requires every applicable criterion green.

1. **Functional operation — the critical must-pass.** The `functional-verifier` subagent launches
   the app and *operates the changed functionality end-to-end*. **Web/UI** changes: drive it
   through Claude-in-Chrome (navigate, click, fill, read results, check the console for errors).
   **Non-web** changes (API/CLI/library): exercise the real interface (hit the endpoint, run the
   CLI, call the function) and confirm correct observable behavior. If the agent cannot operate it,
   the cycle **fails**. For genuinely non-operable changes (e.g. pure infra/config with no runtime
   surface), it may be marked **N/A with written justification** — never a silent skip.
2. **Build** succeeds.
3. **Lint** clean (0 errors).
4. **Typecheck** clean.
5. **Tests** all pass; new behavior is covered (TDD via `execute`); coverage does not decrease
   (when coverage tooling is present).
6. **Security review** — the `security-reviewer` subagent finds no high/critical issues in the diff.
7. **Adversarial code-review panel** — parallel reviewers + a verification stage (the pattern that
   caught the 0.3.0 `audit.mjs` bug) find no *confirmed* high/critical defects.
8. **Hygiene** — no secrets, no leftover TODO/placeholder/debug, diff scoped to the picked items
   (no unrelated churn), commit messages present.
9. **Remote CI** — if the repo has PR status checks, all are green.

**Remediation:** when a local criterion fails, dispatch a remediation agent (execute-style) to fix
the specific failures, then re-run only the failed checks; bounded to `maxRemediationAttempts`
(default 2) per item. Still failing → drop that item from the cycle (reported) or, if the failure
is integration-wide, surface an exception stop. When remote CI fails, attempt the same bounded
fix→push→re-watch; still red → exception stop.

**Configurability:** an optional `.altivum/refine.json` overrides everything — the build/lint/
typecheck/test/coverage commands, the functional smoke entry point (dev-server command + URL +
the user flow to exercise), criteria toggles/thresholds, `maxParallel`, `maxRemediationAttempts`,
base branch, and the autonomy flags. When absent, the loop **auto-detects** commands from
`package.json` scripts / Makefile / common config and uses sensible defaults; anything it cannot
detect for a hard criterion is reported (not silently skipped).

## 5. Architecture

Embraces agents/Workflows/parallelism. New artifacts in **bold**.

- **`commands/refine.md`** *(new)* — the loop **orchestrator**, run in the main agent loop (so it
  can pause for the PICK gate and own the git/PR/merge side effects). Per cycle it: runs recon →
  PICK → invokes the build/gate Workflow → runs the `functional-verifier` → does PR / watch-green /
  merge → re-scans. Owns branch creation, integration, remediation dispatch, and the loop/exit.
- **`workflows/refine-cycle.mjs`** *(new)* — the autonomous per-cycle engine:
  - **Phase Build:** `parallel` item-builders, each `isolation: 'worktree'`, running plan+execute
    (TDD) and committing; returns `{ itemId, branch, summary, filesChanged }` per item.
  - **Phase Integrate:** one integrator agent (Bash, main worktree) merges the item branches into
    the cycle branch, runs the automated checks (build/lint/typecheck/tests/coverage), and reports
    `{ integratedBranch, checksReport, conflicts }`.
  - **Phase Review:** `parallel` adversarial reviewers over the integrated diff + a `verify` stage
    → confirmed findings (severity-tagged).
  - Returns `{ integratedBranch, checksReport, reviewFindings, buildSummaries }`. (Functional
    verification is deliberately *not* here — see below.)
- **`agents/functional-verifier.md`** *(new, its own subagent)* — launches the app and operates the
  changed functionality, then reports operate / can't-operate with concrete evidence. Tools: `Bash`
  (start dev server / run CLI), `Read`, `Grep`, and the Claude-in-Chrome MCP tools (loaded via
  ToolSearch). It does **not** edit code. The command dispatches it (not the Workflow) so the app
  server + browser lifecycle stays under single, cleanable control.
- **Reuses:** the `recon` workflow (`audit.mjs`) + its analyzers; `plan`/`execute` logic;
  `security-reviewer`; `deploy-validator` (only if a post-merge deploy is ever added); git worktrees;
  `gh` for PR/checks/merge.

**Why this command/Workflow split:** Workflows run autonomously in the background and cannot pause
for human input, so the **PICK gate and all git/PR/merge side effects live in the command**. The
**fan-out** work (parallel build, adversarial review) lives in the **Workflow**. The **functional
gate** lives in a **dedicated subagent** dispatched by the command, because launching a long-running
dev server and driving a browser is stateful and one-instance — best owned and cleaned up by the
command.

## 6. PR, wait-green, and merge

- **PR:** push the cycle branch; `gh pr create --base <main> --head <cycle-branch>` with a generated
  title/body summarizing the cycle's items + the quality-gate report.
- **Wait green:** if the repo has status checks, `gh pr checks <pr> --watch` (blocks until checks
  finish). Where branch protection supports it, prefer native `gh pr merge --auto` so GitHub merges
  on green; otherwise watch-then-merge.
- **Merge:** on green, `gh pr merge --squash --delete-branch` (squash keeps `main` history one
  clean commit per cycle; configurable). Then `git checkout main && git pull` so the next cycle's
  recon scans the merged result.
- **No remote checks present:** per the user's rule, the **local gate is the bar** — auto-merge once
  the local gate (criteria 1–8) is green. (The functional-operation criterion is what makes this
  safe: a human-usable result was actually exercised.)

## 7. Flags & defaults

`/altivum-feature-dev-pipeline:refine [path] [lenses…] [flags]`

- **Defaults:** always stop to PICK · auto-merge on green · loop until "done" · deploy left to CD.
- `[path]`, `[lenses…]` — scope the recon analysis (e.g. `refine src/reports ui enhance`).
- `--auto-pick[=N]` — skip the PICK gate, auto-take the top *N* (default 3) low-risk items.
  **Requires `--max-cycles`** (removing the human throttle demands an explicit bound).
- `--max-cycles=N` — hard cap on cycles (only needed with `--auto-pick`).
- `--confirm-merge` — the optional **second stop**: confirm before each merge to `main`.
- `--no-merge` — stop at a green PR each cycle (don't merge); for review-first teams.
- `--max-parallel=N` — cap concurrent item-builders (default = workflow's own cap).
- `--max-remediation=N` — per-item remediation attempts before dropping (default 2).

**No runaway:** in the default mode the PICK gate requires a human choice every cycle, so the loop
physically cannot continue without you. The cycle bound only matters once `--auto-pick` is set.

## 8. Relationship to `:ship`

- `:ship "<goal>"` — one linear, fully-gated pass for a goal the user states.
- `:refine` — discovery-driven, looping, near-autonomous, quality-gated, self-merging.

Both stay; `/ship` gains a one-line pointer to `:refine` for "continuous improvement" mode.

## 9. Testing & validation

Prompt/script/agent assets (no unit suite). Validate by:
- **JSON/manifest validity** + version `0.4.0`; `claude plugin validate .` passes.
- **`refine-cycle.mjs`** parses under the Workflow runtime model (async-fn wrap check, NOT
  `node --check`); `meta` is a pure literal; phase titles match `phase()` calls; namespaced
  `agentType`; null results from `agent()`/`parallel()` are handled (pair-before-filter, per the
  0.3.0 lesson).
- **`functional-verifier`** declares the right tools (Bash + Read + Grep + Chrome MCP), instructs
  no code edits, and degrades to interface-level exercise / justified N/A.
- **`refine.md`** control flow reads correctly: single PICK stop, exception-only halts, auto-PR/
  auto-merge, loop + exit, flags honored, conflict/remediation handling described, no bare `/plan`.
- **Dry-run smoke** (manual, human-in-the-loop): run `:refine` on a sample web repo; confirm it
  produces a brief, stops once to pick, builds in parallel, runs the gate incl. a real browser
  operation, opens a PR, waits for green, and merges — with the documented exception stops.

## 10. File manifest

| Action | Path | Notes |
|---|---|---|
| Create | `plugins/altivum-feature-dev-pipeline/commands/refine.md` | loop orchestrator command |
| Create | `plugins/altivum-feature-dev-pipeline/workflows/refine-cycle.mjs` | parallel build + integrate/checks + review panel |
| Create | `plugins/altivum-feature-dev-pipeline/agents/functional-verifier.md` | operates the change (Chrome/desktop or interface-level) |
| Modify | `plugins/altivum-feature-dev-pipeline/commands/ship.md` | one-line pointer to `:refine` |
| Modify | `plugins/altivum-feature-dev-pipeline/README.md` | "Refinement loop" section; tree; agent/workflow; quality gate; flags |
| Modify | `plugins/altivum-feature-dev-pipeline/.claude-plugin/plugin.json` | version 0.3.0→0.4.0; description; keywords (+refine, loop) |
| Modify | `.claude-plugin/marketplace.json` | refresh description |
| Modify | `README.md` (repo root) | version row → 0.4.0 |
| (doc) | `.altivum/refine.json` | document the override schema in the README (no file shipped) |

## 11. Risks & open items (resolve during plan/execution)

1. **Functional gate dependencies:** needs the app locally runnable + Claude-in-Chrome available.
   Degrades to interface-level exercise; justified N/A for non-operable changes. Browser MCP may be
   absent in headless/cron — the command must detect and report rather than silently pass.
2. **Auto-merge mechanics:** confirm `gh pr checks --watch` + `gh pr merge` vs. native `--auto` per
   the repo's branch-protection settings; the command should handle both.
3. **Parallel worktree conflicts:** integrate sequentially with rebase; on conflict, serialize the
   conflicting item or drop it with a report. Detect file-overlap among picked items up front to
   reduce conflicts.
4. **Recon re-scan cost/latency per cycle:** acceptable by design (the PICK gate throttles); allow
   `[path]`/`[lenses]` scoping and a cached/short recon mode if needed.
5. **Workflow ↔ command handoff of branches:** the Workflow's worktree builders commit on item
   branches; the integrator agent (inside the Workflow) merges them — confirm the agents share the
   same repo/worktrees and that branch names are deterministic (indexed by item, no `Date`/random
   in the script).
6. **Squash vs. merge commit** on auto-merge: default squash (clean `main`), configurable.
