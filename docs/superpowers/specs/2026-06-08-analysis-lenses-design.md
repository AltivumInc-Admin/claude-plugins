# Design: Analysis Lenses for `altivum-feature-dev-pipeline`

- **Date:** 2026-06-08
- **Status:** Approved (ready for implementation plan)
- **Author:** Christian Perez (Altivum Inc.)
- **Plugin:** `plugins/altivum-feature-dev-pipeline` (current version `0.2.0` → target `0.3.0`)

## 1. Context & problem

`altivum-feature-dev-pipeline` packages Altivum's feature workflow — **eval → plan →
execute → deploy** — plus a `/ship` orchestrator, two read-only subagents
(`deploy-validator`, `security-reviewer`), and a blocking pre-deploy hook.

Separately, the author maintains three personal slash commands in `~/.dotfiles/claude-commands`
that are all **front-of-pipeline analysis lenses** — each analyzes a codebase, emits a small
set of prioritized recommendations, and hands off to `/plan` → `/execute`:

- `/improve` — senior-architect, bold **full-stack** moves across frontend/backend/data.
- `/improve-ui` — UI/design-systems **interface craft**; modern CSS; before/after code.
- `/improve-x2` — creative-technologist **frontier** lens; mandatory live web research; cites
  real category leaders.
- (`/enhance` — a fourth sibling: **UX-friction** scanner over real user flows.)

These target the exact pipeline the plugin already owns, so they belong in it. The friction:
the plugin's existing **`eval` already overlaps `/improve`** (both analyze → emit prioritized
recommendations → feed `plan`). A naive port would create two near-duplicate front doors.

**Goal:** incorporate these lenses appropriately and pragmatically — distinct, non-overlapping
front doors — and add a comprehensive multi-lens orchestrator powered by the Workflow tool.

## 2. Goals / non-goals

**Goals**
- Refocus `eval` so it no longer overlaps `/improve`.
- Add `improve`, `improve-ui`, `improve-x2`, `enhance` as distinct lens commands.
- Give the heavy lenses **optional subagent power** (parallel read-only analyzers) with inline
  fallback.
- Add `recon`: a Workflow-powered super-command that runs all/selected lenses in parallel and
  synthesizes one unified, deduped, prioritized brief.
- Keep every lens feeding the existing `plan → execute → deploy` flow.
- Update docs and bump the plugin version.

**Non-goals (YAGNI)**
- No changes to `plan` / `execute` / `deploy` *logic* (only namespaced handoff references).
- `/ship` stays a **linear, human-gated** orchestrator — it is NOT turned into a Workflow
  (gates are interactive; Workflows run autonomously in the background).
- Do not modify the personal `~/.dotfiles` `/improve*` commands; the plugin versions coexist
  under the plugin namespace.
- Do not bake a Workflow dependency into the five individual lenses — only `recon` uses it.

## 3. Design overview

Six front-of-pipeline analysis lenses, each answering a different question, all feeding `plan`:

| Lens | Question it answers | Output |
|---|---|---|
| `eval` *(refocused)* | Is the house structurally sound? (health/architecture) | strengths + 2–4 prioritized fixes for correctness/health/security/maintainability, backed by real lint/types/tests/build/audit output |
| `improve` *(new)* | What bold full-stack moves level it up? | exactly 3 cross-layer recommendations |
| `improve-ui` *(new)* | Does it look and feel crafted? | exactly 3 visual upgrades with before/after code |
| `improve-x2` *(new)* | Is it ahead of the field? (researched) | exactly 3 SOTA moves, each citing a real example + URL |
| `enhance` *(new)* | Where does the existing UX actually hurt users? | exactly 3 fixes ranked by user impact, file:line cited |
| `recon` *(new)* | Give me the whole picture, fast | one unified prioritized brief deduped across all/selected lenses |

Three new **read-only** subagents power the parallel analysis. `recon` ships as a versioned
Workflow script that reuses those same subagents.

## 4. Component designs

### 4.1 Subagents (`agents/`) — all strictly read-only

Mirror the read-only discipline of `deploy-validator` / `security-reviewer`: report findings,
never edit code or infrastructure. Each is designed to be invoked **once per focus/dimension/angle**,
in parallel, with a caller-supplied focus string.

**`codebase-analyzer.md`** — tools: `Read, Grep, Glob, Bash` (read-only commands only).
- Input contract: a focus area (e.g. "frontend layer", "backend/API layer", "data/infra layer",
  or "user-flow UX friction: loading/error/empty states, stale data, destructive-action confirms,
  a11y").
- Output contract: structured findings for that focus — strengths, gaps, concrete `file:line`
  evidence, and candidate improvements (each with rough impact + effort). No final ranking
  (the calling command/workflow ranks).
- Used by: `improve` (frontend/backend/data), `enhance` (UX-flow focus), optionally `eval`.

**`ui-auditor.md`** — tools: `Read, Grep, Glob`.
- Input contract: one UI dimension — typography·rhythm, color·contrast, layout·spacing, motion,
  or component-craft·polish — plus the discovered UI stack (framework, styling, versions).
- Output contract: gaps for that dimension with file/class evidence and a short before/after
  sketch; names the modern technique each upgrade uses; reduced-motion/a11y note.
- Used by: `improve-ui`.

**`frontier-researcher.md`** — tools: `WebSearch, WebFetch, Read, Grep`.
- Input contract: one research angle (category leaders / signature UX patterns / emerging
  platform capabilities / field-specific) plus the project's positioning statement (type,
  vertical, peers).
- Output contract: concrete cited findings (name + URL + why it's relevant + the technique),
  then a repo-grounding note (specific files/routes the idea could attach to). No padding —
  pivot the query rather than fabricate.
- Used by: `improve-x2`.

### 4.2 Lens commands (`commands/`)

Shared structure for every new lens:
1. **Discovery / positioning** done inline first (cheap; establishes shared context).
2. **Optional fan-out:** dispatch the relevant subagent(s) in parallel via the Task/Agent tool,
   passing the discovered context. If subagents are unavailable, do the same analysis inline —
   identical output contract.
3. **Synthesis:** collect findings, dedup/rank, emit the lens's signature format.
4. **Handoff tip** → namespaced `/altivum-feature-dev-pipeline:plan N` then `:execute`,
   with recommendation numbering preserved so `plan 1 3` works.

Per-lens specifics:

- **`eval.md` (refocus).** Add a "How this differs" note: `eval` = empirical
  correctness/health/architecture ("fix the house"); the `improve*`/`enhance` family =
  level-up moves. Keep empirical ground truth (lint/typecheck/tests/build/dep-audit, cite
  output) and the existing output format + "which recommendation to plan?" close. Tilt
  recommendations toward correctness, health, security, maintainability, and evidence-backed
  performance — not aesthetics or frontier bets. May optionally fan out `codebase-analyzer`
  for parallel layer scans.

- **`improve.md` (new).** Persona: senior architect + product strategist. Preserve the
  three-layer analysis (frontend / backend / data-infra) and "exactly 3 cross-layer
  recommendations" with the existing rich per-rec template (Problem / Vision / Why It Matters /
  Technical Approach / Complexity). Fan out `codebase-analyzer` ×3 (one per layer). Add a light
  "Discipline checks" guard (no generic lint/refactor filler; each rec tied to specific files;
  no full-rewrite asks). Differentiate explicitly from `eval`.

- **`improve-ui.md` (new).** Persona: UI engineer + design-systems architect. Preserve Phase 1
  UI-stack discovery, the modern-standards audit, the "exactly 3 with before/after code"
  contract, and the existing discipline checks. Fan out `ui-auditor` across dimensions.

- **`improve-x2.md` (new).** Persona: creative technologist. Preserve the positioning
  statement, mandatory live web research (≥4 angles), the "cite a real example + URL per rec"
  rule, the rich per-rec template, and the discipline checks. Fan out `frontier-researcher`
  across angles, then ground to repo files.

- **`enhance.md` (new).** Preserve the user-flow mapping, the five friction categories
  (loading/perf, error/edge, navigation/IA, responsiveness/a11y, state/freshness), and the
  "exactly 3 ranked by user impact, file:line cited" contract with its "no generic advice"
  rules. Fan out `codebase-analyzer` with the UX-flow focus string.

- **`recon.md` (new).** See 4.3.

- **`ship.md` (edit).** In the EVAL phase, add one line: the analysis lens is swappable —
  default `eval`, or run a single `improve*`/`enhance` lens, or the full `recon` audit — before
  proceeding to the PLAN gate. No other change; `/ship` stays linear and human-gated.

### 4.3 `recon` — Workflow-powered multi-lens orchestrator

**Command (`commands/recon.md`).** Usage: `recon [path] [lenses…]` (default: all lenses, repo
root). Scope and lens selection control breadth/token cost (e.g. `recon src/reports ui frontier`).

The command instructs Claude to run the shipped Workflow script via the Workflow tool. This is a
**legitimate opt-in**: the Workflow tool explicitly counts "a slash command whose instructions
tell you to call Workflow" as valid opt-in, so `recon` works without ultracode.

**Fallback chain** (for portability — older Claude Code / some headless SDK contexts where the
Workflow tool is absent): if Workflow is unavailable, dispatch the selected lens analyses via the
Task tool (sequentially or in parallel), then synthesize the unified brief inline; if subagents
are also unavailable, run the lenses inline. Same unified output contract regardless of path.

**Workflow script (`workflows/audit.mjs`).** Plain JavaScript (the Workflow tool requires JS, not
TS). Structure:
- `export const meta = { name, description, phases }` (pure literal). Phases e.g.
  `Analyze` (per-lens fan-out) and `Synthesize`.
- Read `args = {path, lenses}`.
- For each selected lens, fan out its analyzers in **parallel**, nesting the analyzer fan-out
  inside the lens (nested `parallel` is supported), using `agentType` to reuse the plugin
  subagents.
- **Barrier**, then dedup + rank across all lenses (cross-lens dedup genuinely needs all results
  → a barrier is correct here).
- Return unified, prioritized recommendations (preserving per-lens provenance) for `plan`.

**Critical implementation detail — namespaced `agentType`.** Installed plugin agents register
under the plugin namespace (confirmed: `deploy-validator`/`security-reviewer` appear as
`altivum-feature-dev-pipeline:<name>`). The workflow MUST call
`agentType: 'altivum-feature-dev-pipeline:codebase-analyzer'` (and `:ui-auditor`,
`:frontier-researcher`) — not the bare names.

**Script-path resolution — verify at execution.** `recon.md` will reference
`${CLAUDE_PLUGIN_ROOT}/workflows/audit.mjs`. Whether `${CLAUDE_PLUGIN_ROOT}` is interpolated in
command bodies is unverified; the command will therefore (a) tell Claude to resolve/locate the
script under the plugin root and run it via `Workflow({scriptPath})`, and (b) carry an
inline-equivalent orchestration spec as a fallback so `recon` works even if the path can't be
resolved. Confirm the supported mechanism against current Claude Code docs during execution.

## 5. Cross-cutting consistency rules

- All analysis subagents are **read-only** — no edits in the analysis phase (that's `execute`'s job).
- Handoff tips in all six lenses point to namespaced `:plan` / `:execute` (never bare `/plan`).
- Each lens keeps a discipline/"no generic advice" guard so recommendations stay file-grounded.
- `recon` is the **only** Workflow-coupled artifact; the five individual lenses depend only on the
  always-available Task/Agent-or-inline pattern.

## 6. Testing & validation

This plugin is prompt/agent/script assets (no runtime test suite). Validate by:
- **Manifest/JSON validity:** `plugin.json`, `marketplace.json`, `hooks.json` parse; version
  bumped to `0.3.0`. (`release.sh` does manifest validation — keep it green.)
- **Workflow script parses as JS** and begins with a valid pure-literal `meta`; `meta.phases`
  titles match the `phase()` calls.
- **Local smoke test:** load the plugin via `claude --plugin-dir` and dry-run each new command on
  a sample repo; confirm each emits its signature format and the namespaced handoff; confirm
  `recon` fans out (or cleanly falls back) and returns a unified brief.
- **Read-only discipline:** confirm the three new agents declare only read-only tools.
- **No regressions:** `eval`/`plan`/`execute`/`deploy`/`ship` still behave; the pre-deploy gate
  and existing subagents are untouched.

## 7. File manifest

| Action | Path | Notes |
|---|---|---|
| Modify | `plugins/altivum-feature-dev-pipeline/commands/eval.md` | refocus to health/architecture; "how this differs"; optional analyzer fan-out; namespaced handoff |
| Create | `plugins/altivum-feature-dev-pipeline/commands/improve.md` | full-stack lens |
| Create | `plugins/altivum-feature-dev-pipeline/commands/improve-ui.md` | interface-craft lens |
| Create | `plugins/altivum-feature-dev-pipeline/commands/improve-x2.md` | frontier lens (web research) |
| Create | `plugins/altivum-feature-dev-pipeline/commands/enhance.md` | UX-friction lens |
| Create | `plugins/altivum-feature-dev-pipeline/commands/recon.md` | Workflow-powered multi-lens orchestrator |
| Modify | `plugins/altivum-feature-dev-pipeline/commands/ship.md` | EVAL phase: swappable analysis lens note |
| Create | `plugins/altivum-feature-dev-pipeline/agents/codebase-analyzer.md` | read-only focus-area analyzer |
| Create | `plugins/altivum-feature-dev-pipeline/agents/ui-auditor.md` | read-only UI-dimension auditor |
| Create | `plugins/altivum-feature-dev-pipeline/agents/frontier-researcher.md` | read-only web researcher |
| Create | `plugins/altivum-feature-dev-pipeline/workflows/audit.mjs` | recon orchestration script |
| Modify | `plugins/altivum-feature-dev-pipeline/.claude-plugin/plugin.json` | version 0.2.0→0.3.0; description; keywords |
| Modify | `plugins/altivum-feature-dev-pipeline/README.md` | "Analysis lenses" section; tree; agents; workflow; recon usage |
| Modify | `.claude-plugin/marketplace.json` | refresh description if it enumerates features |

## 8. Open items to verify during execution

1. `${CLAUDE_PLUGIN_ROOT}` interpolation in command bodies — confirm; otherwise use the
   locate-script + inline-fallback approach in `recon.md`.
2. Exact namespaced `agentType` strings for plugin agents inside a Workflow — confirm the
   `altivum-feature-dev-pipeline:<name>` form resolves; adjust if Claude Code uses a different
   scheme.
3. Whether plugin-shipped workflow scripts can be referenced by `name` (registry) or only by
   `scriptPath` — prefer `scriptPath` unless `name` registration is confirmed.
