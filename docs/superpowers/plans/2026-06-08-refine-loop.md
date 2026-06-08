# :refine Refinement Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `:refine` — a continuous, quality-gated refinement loop — to `altivum-feature-dev-pipeline`: recon finds improvements, the user picks (the one routine stop), agents build them in parallel worktrees, a high quality bar (live functional operation first, then build/lint/types/tests/security/adversarial-review) must pass, then it auto-opens a PR and auto-merges on green, and loops.

**Architecture:** A `refine.md` orchestrator command (main loop — owns the pick gate + all git/PR/merge side effects), a `refine-cycle.mjs` Workflow (parallel worktree build → integrate + automated checks → adversarial review panel), and a `functional-verifier` subagent (operates the change via Claude-in-Chrome or interface-level). Reuses the `recon` workflow, `security-reviewer`, and `gh`.

**Tech Stack:** Claude Code plugin assets — markdown command & agent (YAML frontmatter), one plain-JS (ESM) Workflow script, JSON manifests. No unit suite; verification = JSON/JS validity + frontmatter/content greps + a mandatory human dry-run smoke.

**Spec:** `docs/superpowers/specs/2026-06-08-refine-loop-design.md`.

---

## Conventions for every task

- **Branch:** work is on `feat/refine-loop` (already created). Commit after each task.
- **Reuse 0.3.0 lessons:**
  - Plugin subagents are invoked **namespaced**: `altivum-feature-dev-pipeline:<name>`.
  - In Workflow scripts: `meta` is a **pure literal**; `meta.phases` titles match `phase()` calls; **never** put the literal tokens `Date.now`/`Math.random`/`new Date(` in the source (even in prompt strings — the validator greps them); pair data with its result **before** `.filter(Boolean)` (never index a filtered array against an unfiltered one).
  - Validate a Workflow script with the **async-fn-wrap** check, NOT `node --check` (top-level `return` is legal in the runtime, not in `node --check`).
- **JSON validation:** `node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log('JSON OK')" <file>`
- **Plugin root:** `plugins/altivum-feature-dev-pipeline/` (repo root `/Users/cperez/dev/altivum-claude-plugins`).
- **High-risk pieces:** Tasks 2 (workflow) and 3 (command) are executable orchestration — Task 6's adversarial review + dry-run smoke are REQUIRED gates, not optional.

---

## Task 1: `functional-verifier` subagent

**Files:**
- Create: `plugins/altivum-feature-dev-pipeline/agents/functional-verifier.md`

> Note: this agent deliberately **omits** a `tools:` allowlist so it can reach Bash + ToolSearch + the Claude-in-Chrome MCP tools (which are dynamically named and loaded on demand). Read-only-of-source is enforced by the prompt, not the allowlist.

- [ ] **Step 1: Create the file** with exactly this content:

````md
---
name: functional-verifier
description: Functional gate for a code change. Launches the app and OPERATES the changed functionality end-to-end — web changes via Claude-in-Chrome, non-web changes via their real interface (API/CLI/function) — then reports whether a real user could actually use it. The critical must-pass of the refine quality gate. Runs processes and drives a browser, but never edits source code.
---

You are the functional gate for a code change. Your job: **prove a real user could actually operate the changed functionality** by driving it yourself. Guiding rule: *if you can't operate it, a person can't.* You may run processes and drive a browser, but you are **read-only with respect to source code** — never create, modify, or delete source files. If something is broken, report it precisely; do not fix it.

## Input you'll be given
- What changed this cycle (the picked improvements + files touched) and base vs. head branch.
- The project's run instructions if known (dev-server command + URL, or how to invoke the API/CLI), or `.altivum/refine.json`'s `functional` config. If not provided, discover them (read README / package.json scripts / Makefile).

## Pick the mode
- **Web / UI change → operate it through Claude-in-Chrome.** Load the browser tools first with ToolSearch (e.g. `select:mcp__claude-in-chrome__tabs_context_mcp`, then `navigate`, `find`, `computer`, `get_page_text`, `read_console_messages`). Start the dev server (Bash, in the background), open the app, and perform the actual user flow the change affects. Do NOT trigger native dialogs (alert/confirm/prompt) — they freeze the browser session.
- **Non-web change (API / CLI / library) → exercise the real interface.** curl the endpoint, run the CLI, or call the function via a one-off invocation (`node -e` / `python -c` is running, not editing source). Confirm correct observable behavior.
- **Genuinely non-operable change** (pure infra/config with no runtime surface) → you MAY return N/A, but ONLY with a written justification of why there is nothing to operate. Never N/A for convenience.

## Method
1. Get the app/feature running; capture exactly how (commands, URL). If you cannot get it running, that is a FAIL — report what blocked you.
2. Perform the concrete user flow(s) that exercise the change end-to-end, with realistic inputs. UI: confirm the expected result is visible AND the browser console shows no new errors. API/CLI: confirm status/output is correct.
3. Probe the obvious unhappy edge a user would hit (empty/invalid input) where cheap.
4. Clean up: stop every server/process you started. Leave no background processes running.

## Output
- **Verdict:** OPERATED | CANNOT-OPERATE | N/A (justified).
- **Mode:** web (Chrome) | interface-level | n/a.
- **What you did:** the exact steps/flow, commands, URL, inputs — reproducible.
- **Evidence:** key observations (rendered result, HTTP status + body snippet, CLI output, console state); note any screenshot/snapshot taken.
- **If CANNOT-OPERATE:** precisely what failed (step, error, console/log excerpt) and your best read of the cause — but do not fix it.

Only **OPERATED** means you actually drove it and saw it work. Do not pass on assumptions.
````

- [ ] **Step 2: Validate frontmatter + read-only-of-source instruction**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/agents/functional-verifier.md
grep -q '^name: functional-verifier$' "$f" && grep -q 'read-only with respect to source code' "$f" && grep -q 'Claude-in-Chrome' "$f" && grep -q 'interface-level' "$f" && ! grep -qE '^tools:' "$f" && echo "AGENT OK"
```
Expected: `AGENT OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/agents/functional-verifier.md
git commit -m "feat(agents): add functional-verifier subagent (operates the change; Chrome or interface-level)"
```

---

## Task 2: `refine-cycle` Workflow script

**Files:**
- Create: `plugins/altivum-feature-dev-pipeline/workflows/refine-cycle.mjs`

This is the autonomous per-cycle engine: **Build** (parallel worktree builders) → **Integrate** (one agent merges item branches + runs automated checks + cleans up worktrees) → **Review** (parallel adversarial reviewers + a verify stage). It returns the integrated branch, per-check results, failed/conflicted items, and confirmed review defects. (Functional + security gates run in the command, not here.)

- [ ] **Step 1: Create the script** with exactly this content (plain ESM; `agent`/`parallel`/`phase`/`log`/`args` are runtime globals — do NOT import them):

````javascript
export const meta = {
  name: 'altivum-refine-cycle',
  description: 'One refine cycle: parallel worktree build of picked items, integrate + automated checks, adversarial review panel with verification',
  phases: [
    { title: 'Build', detail: 'build each picked item in its own worktree, in parallel' },
    { title: 'Integrate', detail: 'merge item branches, run automated checks, clean up worktrees' },
    { title: 'Review', detail: 'adversarial review panel over the integrated diff, then verify findings' },
  ],
}

const BUILD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'itemId', 'summary'],
  properties: {
    status: { type: 'string', enum: ['built', 'failed'] },
    itemId: { type: 'string' },
    branch: { type: 'string' },
    worktree: { type: 'string' },
    commit: { type: 'string' },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' },
  },
}

const INTEGRATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['integratedBranch', 'checks', 'conflictedItems'],
  properties: {
    integratedBranch: { type: 'string' },
    checks: {
      type: 'object',
      additionalProperties: false,
      required: ['build', 'lint', 'typecheck', 'test'],
      properties: {
        build: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
        lint: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
        typecheck: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
        test: { type: 'string', enum: ['pass', 'fail', 'not-applicable'] },
      },
    },
    conflictedItems: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['dimension', 'findings'],
  properties: {
    dimension: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'file', 'issue', 'fix'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          file: { type: 'string' },
          issue: { type: 'string' },
          fix: { type: 'string' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isRealDefect', 'reasoning'],
  properties: {
    isRealDefect: { type: 'boolean' },
    reasoning: { type: 'string' },
  },
}

const items = (args && Array.isArray(args.items)) ? args.items : []
const base = (args && args.base) || 'main'
const cycleBranch = (args && args.cycleBranch) || 'refine/cycle'
const repoRoot = (args && args.repoRoot) || '.'
const checks = (args && args.checks) || {}

if (!items.length) {
  return { error: 'no items provided', integratedBranch: cycleBranch, built: [], failedItems: [], confirmedReviewDefects: [] }
}

log(`refine-cycle: ${items.length} item(s) onto ${cycleBranch} from ${base}`)

// Phase 1 — parallel build, each item on its own branch in its own worktree.
phase('Build')
const built = await parallel(
  items.map((it) => () =>
    agent(
      `Implement ONE refinement item in the git repo at ${repoRoot}.\n` +
        `Item id: ${it.id}\nTitle: ${it.title}\nDetails: ${it.desc || ''}\n\n` +
        `Steps (use Bash; keep the change scoped to THIS item only):\n` +
        `1. Make an isolated worktree on a fresh branch:\n` +
        `   WT=$(mktemp -d)\n` +
        `   git -C ${repoRoot} worktree add -B refine/item-${it.id} "$WT" ${base}\n` +
        `   cd "$WT"\n` +
        `2. Implement the item with TDD (write a failing test, then make it pass), following existing project conventions.\n` +
        `3. Commit with a clear message. Do NOT remove the worktree — the integrator needs the branch.\n` +
        `4. Report status 'built' with branch refine/item-${it.id}, the worktree path "$WT", the commit SHA, a one-line summary, and files changed.\n` +
        `If you cannot implement it cleanly, make NO commit and report status 'failed' with a reason.`,
      { label: `build:${it.id}`, phase: 'Build', schema: BUILD_SCHEMA },
    ),
  ),
)
const okItems = built.filter((b) => b && b.status === 'built')
const failedItems = built.filter((b) => b && b.status === 'failed')

// Phase 2 — integrate built branches + run automated checks (single agent, main worktree).
phase('Integrate')
const branchList = okItems.map((b) => b.branch).filter(Boolean).join(', ')
const worktreeList = okItems.map((b) => b.worktree).filter(Boolean).join(', ')
const integration = await agent(
  `Integrate built refinement items in the git repo at ${repoRoot}.\n` +
    `Target branch: ${cycleBranch}. Base: ${base}. Item branches to merge (in order): ${branchList || '(none)'}.\n\n` +
    `Steps (Bash; capture REAL output):\n` +
    `1. git -C ${repoRoot} checkout -B ${cycleBranch} ${base}\n` +
    `2. For each item branch, merge it: git -C ${repoRoot} merge --no-ff <branch>. If it conflicts, run git -C ${repoRoot} merge --abort, record that item id in conflictedItems, and skip it (do not block the others).\n` +
    `3. Run the automated checks and record each result (pass / fail / not-applicable), citing key output:\n` +
    `   build: ${checks.build || '(auto-detect from package.json scripts / Makefile)'}\n` +
    `   lint: ${checks.lint || '(auto-detect)'}\n` +
    `   typecheck: ${checks.typecheck || '(auto-detect)'}\n` +
    `   test: ${checks.test || '(auto-detect)'}\n` +
    `   A check whose tool/script does not exist is 'not-applicable'; a non-zero run is 'fail'.\n` +
    `4. Clean up the item worktrees so they don't accumulate: for each path in [${worktreeList || 'none'}] run git -C ${repoRoot} worktree remove --force <path> (ignore errors), then git -C ${repoRoot} worktree prune.\n` +
    `Report the integrated branch (${cycleBranch}), the four check results, the conflictedItems list, and brief notes.`,
  { label: 'integrate', phase: 'Integrate', schema: INTEGRATE_SCHEMA },
)

// Phase 3 — adversarial review panel over the integrated diff, then verify high/critical findings.
phase('Review')
const DIMS = ['correctness & bugs', 'security', 'scope & hygiene', 'tests & coverage']
const reviews = await parallel(
  DIMS.map((d) => () =>
    agent(
      `Adversarially review the integrated diff for the "${d}" dimension in the repo at ${repoRoot}: ` +
        `run git -C ${repoRoot} diff ${base}...${cycleBranch} and read the changed files. ` +
        `Report only substantiated findings (severity, file, issue, concrete fix). Do not edit code.`,
      { label: `review:${d}`, phase: 'Review', schema: REVIEW_SCHEMA },
    ),
  ),
)
const flagged = reviews
  .filter(Boolean)
  .flatMap((r) => (r.findings || []).filter((f) => f.severity === 'high' || f.severity === 'critical').map((f) => ({ dimension: r.dimension, ...f })))

const verified = await parallel(
  flagged.map((f) => () =>
    agent(
      `Adversarially verify this review finding against the code at ${repoRoot} (branch ${cycleBranch}). ` +
        `Is it a real, substantiated ${f.severity} defect, or a false positive / style nit? Read the relevant file(s). ` +
        `Finding: ${JSON.stringify(f)}. Set isRealDefect=true only if genuinely substantiated; default false when unsure.`,
      { label: `verify:${f.dimension}`, phase: 'Review', schema: VERDICT_SCHEMA },
    ).then((v) => ({ finding: f, real: !!(v && v.isRealDefect), reasoning: v && v.reasoning })),
  ),
)
const confirmedReviewDefects = verified.filter((x) => x && x.real)

log(`refine-cycle done: ${okItems.length} built, ${failedItems.length} failed, ${confirmedReviewDefects.length} confirmed defect(s)`)

return {
  integratedBranch: integration ? integration.integratedBranch : cycleBranch,
  checks: integration ? integration.checks : null,
  conflictedItems: integration ? integration.conflictedItems : [],
  built: okItems,
  failedItems,
  confirmedReviewDefects,
}
````

- [ ] **Step 2: Syntax-check (faithful to the Workflow runtime — NOT `node --check`)**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
node -e '
const fs=require("fs");
let s=fs.readFileSync("plugins/altivum-feature-dev-pipeline/workflows/refine-cycle.mjs","utf8");
s=s.replace(/export\s+const\s+meta/, "const meta");
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
new AsyncFunction("agent","parallel","pipeline","phase","log","args","budget","workflow", s);
console.log("WORKFLOW SYNTAX OK");
'
```
Expected: `WORKFLOW SYNTAX OK`

- [ ] **Step 3: Wiring checks (namespacing not needed here — agents are generic; verify discipline)**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/workflows/refine-cycle.mjs
grep -q "export const meta" "$f" && grep -q "phase('Build')" "$f" && grep -q "phase('Integrate')" "$f" && grep -q "phase('Review')" "$f" && echo "PHASES OK"
# Guard against the banned non-deterministic tokens and the 0.3.0 index-misalignment pattern:
! grep -qE 'Date\.now|Math\.random|new Date\(' "$f" && echo "DETERMINISM OK"
grep -q 'reviews\n*.*filter(Boolean)' "$f" || grep -q '.filter(Boolean)' "$f" && echo "null-guard present"
```
Expected: `PHASES OK`, `DETERMINISM OK`, `null-guard present`

- [ ] **Step 4: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/workflows/refine-cycle.mjs
git commit -m "feat(workflows): add refine-cycle (parallel worktree build, integrate+checks, review panel)"
```

---

## Task 3: `refine` orchestrator command

**Files:**
- Create: `plugins/altivum-feature-dev-pipeline/commands/refine.md`

- [ ] **Step 1: Create the file** with exactly this content:

````md
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
````

- [ ] **Step 2: Validate**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/commands/refine.md
grep -q '^argument-hint:' "$f" && \
grep -q 'workflows/refine-cycle.mjs' "$f" && \
grep -q 'altivum-feature-dev-pipeline:functional-verifier' "$f" && \
grep -q 'altivum-feature-dev-pipeline:security-reviewer' "$f" && \
grep -q 'gh pr merge' "$f" && grep -q 'gh pr checks' "$f" && \
grep -q 'PICK' "$f" && grep -q 'Exception stops' "$f" && echo "REFINE OK"
```
Expected: `REFINE OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/commands/refine.md
git commit -m "feat(commands): add refine continuous quality-gated loop (1-stop, auto-PR, auto-merge)"
```

---

## Task 4: Point `/ship` at `:refine`

**Files:**
- Modify: `plugins/altivum-feature-dev-pipeline/commands/ship.md`

- [ ] **Step 1: Read `ship.md`, then add a pointer line.** Replace this exact line:

```
If the user passed a single phase name in `$ARGUMENTS` (e.g. "just eval"), run only that phase.
```

with:

```
If the user passed a single phase name in `$ARGUMENTS` (e.g. "just eval"), run only that phase.

For **continuous improvement** (an ongoing loop rather than one stated goal), use `/altivum-feature-dev-pipeline:refine` instead — it runs recon → pick → parallel build → quality gate → auto-PR → auto-merge, and loops with a single routine stop.
```

- [ ] **Step 2: Validate**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
grep -q 'use `/altivum-feature-dev-pipeline:refine`' plugins/altivum-feature-dev-pipeline/commands/ship.md && echo "SHIP POINTER OK"
```
Expected: `SHIP POINTER OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/commands/ship.md
git commit -m "docs(ship): point at :refine for continuous-improvement mode"
```

---

## Task 5: Manifests & docs (bump to 0.4.0)

**Files:**
- Modify: `plugins/altivum-feature-dev-pipeline/.claude-plugin/plugin.json`
- Modify: `plugins/altivum-feature-dev-pipeline/README.md`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `README.md` (repo root)

- [ ] **Step 1: Read, then overwrite `plugins/altivum-feature-dev-pipeline/.claude-plugin/plugin.json`** with exactly:

````json
{
  "name": "altivum-feature-dev-pipeline",
  "description": "Altivum's eval -> plan -> execute -> deploy feature-development pipeline as one refinable, versioned workflow. Provides a /ship orchestrator, five analysis lenses (eval, improve, improve-ui, improve-x2, enhance), a Workflow-powered /recon multi-lens audit, and a /refine continuous quality-gated loop (parallel build, live functional verification, auto-PR + auto-merge on green). Includes read-only codebase-analyzer/ui-auditor/frontier-researcher/functional-verifier and deploy-validator/security-reviewer subagents and a blocking production-deploy gate.",
  "version": "0.4.0",
  "author": { "name": "Altivum Inc.", "url": "https://altivum.io" },
  "homepage": "https://github.com/AltivumInc-Admin/claude-plugins-public",
  "repository": "https://github.com/AltivumInc-Admin/claude-plugins-public",
  "license": "Apache-2.0",
  "keywords": ["workflow", "pipeline", "eval", "plan", "execute", "deploy", "aws", "improve", "ui", "research", "audit", "refine", "loop"]
}
````

- [ ] **Step 2: Read `plugins/altivum-feature-dev-pipeline/README.md`, then make THREE edits.**

Edit A — in the `commands/` block of the file-tree, replace:
```
│   ├── recon.md             # /…:recon — Workflow-powered multi-lens audit → unified brief
```
with:
```
│   ├── recon.md             # /…:recon — Workflow-powered multi-lens audit → unified brief
│   ├── refine.md            # /…:refine — continuous quality-gated loop → auto-PR + auto-merge
```

Edit B — in the `agents/` block of the file-tree, replace:
```
│   ├── frontier-researcher.md # read-only live-web researcher for one angle
```
with:
```
│   ├── frontier-researcher.md # read-only live-web researcher for one angle
│   ├── functional-verifier.md # operates the change (Chrome/desktop or interface-level)
```

Edit C — in the `workflows/` block of the file-tree, replace:
```
│   └── audit.mjs            # recon orchestration script (parallel fan-out → synthesis)
```
with:
```
│   ├── audit.mjs            # recon orchestration script (parallel fan-out → synthesis)
│   └── refine-cycle.mjs     # refine per-cycle engine (parallel build → integrate → review)
```

Edit D — replace the `recon` section's closing paragraph end. Find this exact line:
```
If the Workflow tool isn't present (older Claude Code / some headless contexts) it falls back to
dispatching the same subagents via the Task tool, then to inline analysis — same unified output.
```
and replace it with:
```
If the Workflow tool isn't present (older Claude Code / some headless contexts) it falls back to
dispatching the same subagents via the Task tool, then to inline analysis — same unified output.

## Refinement loop (`:refine`)

`/altivum-feature-dev-pipeline:refine [path] [lenses…]` turns the plugin into a continuous,
quality-gated improvement loop. Each cycle:

1. **recon** finds the highest-impact improvements (ranked brief).
2. **✋ you pick** which to take — the *one routine stop*.
3. picked items are **built in parallel**, each in its own git worktree (`refine-cycle.mjs`).
4. a **high quality bar must pass** before anything ships — the critical must-pass is that the
   `functional-verifier` agent can actually **operate the change** (web UI via Claude-in-Chrome,
   non-web via its real interface), plus build/lint/typecheck/tests, `security-reviewer`, and an
   adversarial review panel.
5. on green, it **auto-opens a PR and auto-merges** once all checks pass — no "make a PR" / "merge
   it" stops. Deploy is downstream of merge (your CI/CD).
6. it **loops**, re-scanning the improved code, until you say `done` at the pick gate.

Flags: `--auto-pick[=N]` (+ required `--max-cycles=N`), `--confirm-merge` (optional 2nd stop),
`--no-merge`, `--max-parallel=N`, `--max-remediation=N`. Override commands/criteria via an optional
`.altivum/refine.json`. It only halts outside the pick gate for *exceptions* (gate can't go green,
CI stays red, or an unresolvable conflict).

`:refine` is the looping, self-merging counterpart to `:ship` (which is one gated pass for a goal
you state).
```

- [ ] **Step 3: Read `.claude-plugin/marketplace.json`, then replace the description line:**

Replace:
```
      "description": "eval -> plan -> execute -> deploy feature-development pipeline (/ship orchestrator + phase commands, five analysis lenses [eval/improve/improve-ui/improve-x2/enhance] + Workflow-powered /recon audit, read-only analysis & review subagents, blocking pre-deploy gate)."
```
with:
```
      "description": "eval -> plan -> execute -> deploy feature-development pipeline (/ship orchestrator + phase commands, five analysis lenses + Workflow-powered /recon audit + /refine continuous quality-gated loop with auto-PR/auto-merge, read-only analysis & review subagents, blocking pre-deploy gate)."
```

- [ ] **Step 4: Read `README.md` (repo root), then replace the plugin table row:**

Replace:
```
| [`altivum-feature-dev-pipeline`](plugins/altivum-feature-dev-pipeline) | 0.3.0 | `eval → plan → execute → deploy` pipeline: a `/ship` orchestrator + phase commands, five analysis lenses (`eval`/`improve`/`improve-ui`/`improve-x2`/`enhance`) + Workflow-powered `/recon` audit, read-only analysis & review subagents, and a blocking pre-deploy gate. |
```
with:
```
| [`altivum-feature-dev-pipeline`](plugins/altivum-feature-dev-pipeline) | 0.4.0 | `eval → plan → execute → deploy` pipeline: a `/ship` orchestrator + phase commands, five analysis lenses + `/recon` audit + `/refine` continuous quality-gated loop (auto-PR/auto-merge), read-only analysis & review subagents, and a blocking pre-deploy gate. |
```

- [ ] **Step 5: Validate JSON + version + new references**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
node -e "JSON.parse(require('fs').readFileSync('plugins/altivum-feature-dev-pipeline/.claude-plugin/plugin.json','utf8'));JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8'));console.log('JSON OK')"
grep -q '"version": "0.4.0"' plugins/altivum-feature-dev-pipeline/.claude-plugin/plugin.json && \
grep -q '0.4.0' README.md && \
grep -q 'Refinement loop' plugins/altivum-feature-dev-pipeline/README.md && \
grep -q 'refine-cycle.mjs' plugins/altivum-feature-dev-pipeline/README.md && \
grep -q 'functional-verifier.md' plugins/altivum-feature-dev-pipeline/README.md && echo "DOCS OK"
```
Expected: `JSON OK` then `DOCS OK`

- [ ] **Step 6: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/.claude-plugin/plugin.json \
        plugins/altivum-feature-dev-pipeline/README.md \
        .claude-plugin/marketplace.json README.md
git commit -m "docs: document :refine loop; bump plugin to 0.4.0"
```

---

## Task 6: Validation, adversarial review, and mandatory dry-run smoke

**Files:** none (verification only) — but this task is a REQUIRED gate for the executable pieces.

- [ ] **Step 1: Marketplace + inventory**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
command -v claude >/dev/null 2>&1 && claude plugin validate . 2>&1 | tail -2 || echo "claude CLI absent — JSON already validated"
ls plugins/altivum-feature-dev-pipeline/commands/refine.md \
   plugins/altivum-feature-dev-pipeline/agents/functional-verifier.md \
   plugins/altivum-feature-dev-pipeline/workflows/refine-cycle.mjs >/dev/null && echo "INVENTORY OK"
```
Expected: validation passes (or skip note) + `INVENTORY OK`.

- [ ] **Step 2: Adversarial review (REQUIRED for the executable pieces).** Run a multi-dimension review (a Workflow or parallel subagents) over `refine-cycle.mjs` and `refine.md` covering: Workflow-runtime correctness (meta literal, phases match, namespaced `agentType` where plugin agents are used, null-result handling, no banned tokens); command control-flow soundness (exactly one routine stop; auto-PR/auto-merge; exception-only halts; remediation bounds honored; flags consistent; conflict/worktree handling described); gate completeness vs. the spec's nine criteria; and docs accuracy. **Verify each finding** to drop false positives; fix every confirmed high/critical defect, then re-validate (Step 1) and commit the fixes.

- [ ] **Step 3: Mandatory dry-run smoke (human-in-the-loop) — do NOT skip.** Load the plugin against a sample web repo:
```bash
claude --plugin-dir /Users/cperez/dev/altivum-claude-plugins/plugins/altivum-feature-dev-pipeline
```
Then run `/altivum-feature-dev-pipeline:refine` and confirm, end-to-end:
- It checks prerequisites, runs recon, and presents a ranked brief.
- It stops exactly once (the pick) and accepts a selection (and `done` exits cleanly).
- The picked item builds in a worktree, integrates, and the automated checks run.
- The `functional-verifier` actually launches the app and operates the change via Claude-in-Chrome (or interface-level for a non-web change).
- The adversarial review + security gate run; a green gate auto-opens a PR.
- `gh pr checks --watch` waits, and a green PR auto-merges to `main`; the loop re-scans.
- Force a failure (e.g. a deliberately broken item) and confirm it remediates within the bound, drops the item, or stops as an exception — and never opens a PR on a red gate.

Record the smoke result. If anything misbehaves, fix it as a follow-up commit and re-run.

---

## Self-review (completed by plan author)

**Spec coverage** — every spec §10 manifest row maps to a task: `functional-verifier` → T1; `refine-cycle.mjs` → T2; `refine.md` → T3; `ship.md` pointer → T4; `plugin.json`/plugin README/marketplace.json/root README → T5. The §4 quality gate's nine criteria are realized: functional (T1 agent + T3 gate step), build/lint/typecheck/tests (T2 integrate), security (T3 gate), adversarial review (T2 review phase + T3 gate check), hygiene (T3 gate), remote CI (T3 step 6). The §3 cycle, §6 PR/merge, §7 flags, and §8 ship relationship are all in T3. §9 testing → T6.

**Placeholder scan** — file contents are complete; no TBD/TODO. The "(auto-detect …)" strings inside the workflow are runtime instructions to the integrator agent, not plan placeholders. The functional-verifier intentionally has no `tools:` line (documented rationale in T1).

**Type/consistency** — namespaced subagent ids match across `refine.md` and the agent files (`altivum-feature-dev-pipeline:functional-verifier`, `:security-reviewer`); the workflow's returned keys (`integratedBranch`, `checks`, `built`, `failedItems`, `confirmedReviewDefects`, `conflictedItems`) are exactly the keys `refine.md`'s gate step consumes; `meta.phases` titles (Build/Integrate/Review) match the `phase()` calls; the 0.3.0 null-misalignment bug class is avoided (findings carry their `dimension`/`finding` via object spread, never indexed against a filtered array); banned non-deterministic tokens are absent from the workflow source.

**Risk note** — T2 and T3 are executable orchestration; T6 Step 2 (adversarial review) and Step 3 (dry-run smoke) are REQUIRED, not optional, before shipping.
