# Analysis Lenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five front-of-pipeline analysis lenses (refocused `eval` + new `improve`, `improve-ui`, `improve-x2`, `enhance`), three read-only analysis subagents, and a Workflow-powered `recon` multi-lens orchestrator to the `altivum-feature-dev-pipeline` plugin.

**Architecture:** Each lens is a standalone command (markdown prompt) that does cheap discovery inline, optionally fans out read-only analyzer subagents in parallel, then synthesizes its signature output and hands off to the plugin's `:plan` → `:execute`. `recon` is the only Workflow-coupled artifact: a versioned `workflows/audit.mjs` script that reuses the same subagents across all lenses and synthesizes one unified brief, with a Task-dispatch / inline fallback when the Workflow tool is absent.

**Tech Stack:** Claude Code plugin assets — markdown commands & agents (YAML frontmatter), one plain-JS (ESM) Workflow script, JSON manifests. No runtime test suite; verification = JSON/JS validity checks, frontmatter/content grep assertions, and a manual plugin smoke test.

---

## Conventions for every task

- **Branch:** work is on `feat/analysis-lenses` (already created). Commit after each task.
- **Read-only agents:** the three new subagents must declare only read-only tools and must never edit code/infra (mirror the existing `deploy-validator`/`security-reviewer`).
- **Namespaced handoffs:** every lens ends pointing at `/altivum-feature-dev-pipeline:plan <numbers>` then `:execute` — never bare `/plan`.
- **House style:** match the existing plugin commands — YAML frontmatter with `description:` (+ `argument-hint:` for commands), tight imperative prose, a closing handoff.
- **JSON validation command (reliable, Node always present):**
  `node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log('JSON OK')" <file>`
- **Plugin root for paths below:** `plugins/altivum-feature-dev-pipeline/` (relative to repo root `/Users/cperez/dev/altivum-claude-plugins`).

---

## Task 1: `codebase-analyzer` subagent

**Files:**
- Create: `plugins/altivum-feature-dev-pipeline/agents/codebase-analyzer.md`

- [ ] **Step 1: Create the agent file** with exactly this content:

````md
---
name: codebase-analyzer
description: Read-only deep analysis of ONE focus area of a codebase (a layer like frontend/backend/data, or a cross-cutting concern such as UX-flow friction). Returns structured findings — strengths, gaps, file:line evidence, candidate improvements with rough impact/effort. Does not rank or edit. Invoke one per focus area, in parallel.
tools: Read, Grep, Glob, Bash
---

You are a read-only codebase analyst. You will be given ONE focus area to analyze (a layer, a subsystem, or a cross-cutting concern such as "user-flow UX friction"). Analyze only that focus, deeply, and report structured findings. You are **read-only**: never create, modify, or delete code, files, or infrastructure. Use Bash only for read-only inspection (`ls`, `git diff`, `grep`, `cat`, `wc`, or running lint/types/tests/build to *observe* output) — never to mutate.

## Method
1. Establish context for your focus: read the relevant files, configs, and entry points; follow imports/collaborators. Use Grep/Glob to find every place the focus manifests.
2. Where empirical ground truth is cheap and relevant, gather it (typecheck/lint/tests, bundle/config inspection) and cite the real output. Never fabricate results.
3. Confirm each finding against the actual code before reporting. Cite concrete `file:line` evidence (quote the key line). Calibrate honestly — no theoretical or generic padding.

## Output (your focus area ONLY)
- **Focus:** <the focus you were given>
- **Strengths:** 2-4 things genuinely done well (with file refs).
- **Gaps / issues:** each as — **what** (one line) · **evidence** (`file:line` + quoted code) · **why it matters** (user/dev/perf/security/maintainability) · **rough impact** (high/med/low) · **rough effort** (low/med/high).
- **Candidate improvements:** concrete, file-grounded moves the caller can turn into recommendations. Name specific files/functions/patterns. Do NOT produce a final ranked list — the caller synthesizes and ranks across focus areas.

Be specific and evidence-driven. If the focus area is genuinely healthy, say so plainly rather than inventing problems.
````

- [ ] **Step 2: Validate frontmatter + read-only tools**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/agents/codebase-analyzer.md
grep -q '^name: codebase-analyzer$' "$f" && grep -q '^tools: Read, Grep, Glob, Bash$' "$f" && ! grep -qE '^tools:.*(Write|Edit|NotebookEdit)' "$f" && echo "AGENT OK"
```
Expected: `AGENT OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/agents/codebase-analyzer.md
git commit -m "feat(agents): add read-only codebase-analyzer subagent"
```

---

## Task 2: `ui-auditor` subagent

**Files:**
- Create: `plugins/altivum-feature-dev-pipeline/agents/ui-auditor.md`

- [ ] **Step 1: Create the agent file** with exactly this content:

````md
---
name: ui-auditor
description: Read-only audit of ONE UI/design dimension (typography & rhythm, color & contrast, layout & spacing, motion, or component-craft & polish) against modern (2025-2026) standards. Returns gaps with file/class evidence, before/after sketches, the modern technique each uses, and a reduced-motion/a11y note. Invoke one per dimension, in parallel.
tools: Read, Grep, Glob
---

You are a read-only UI/design-systems auditor. You will be given ONE UI dimension to audit plus the discovered UI stack (framework, styling system + version, component library, motion approach, design tokens). Audit only that dimension. You are **read-only**: report findings; never edit code.

## Dimensions (audit exactly the one you're assigned)
- **Typography & rhythm** — type-scale coherence, line-height for readability, vertical rhythm, variable fonts, `text-wrap: balance/pretty`.
- **Color & contrast** — perceptual color (oklch/oklab) vs hex/hsl, systematic interactive states, `color-mix()`/opacity layers, surface/elevation hierarchy, semantic-color harmony, WCAG contrast.
- **Layout & spacing** — consistent spacing scale, container queries for intrinsic responsiveness, Grid/subgrid alignment, `clamp()` fluidity, reading widths.
- **Motion** — transitions on interactive elements, route/View Transitions, `prefers-reduced-motion`, animated loading/skeleton states, staggered reveals.
- **Component-craft & polish** — focus-visible styles, hover-lift/active-press, native `<dialog>`/Popover API + anchor positioning, inline form validation, designed empty states, multi-layer shadows, consistent radius/border/icon scales, styled scrollbars/`::selection`, correct cursors.

## Method
1. Read the actual CSS/styling files, theme/token files, and 3-5 representative components for your dimension. Use Grep to find real patterns (class names, custom properties, values).
2. Judge against a well-crafted 2025-2026 interface, but stay in the project's stack — Tailwind-vN solutions for a Tailwind-vN project, CSS for vanilla. No framework switches.
3. Only flag what the code substantiates. No accessibility regressions — every visual change must preserve or improve a11y.

## Output (your dimension ONLY)
- **Dimension:** <assigned dimension>
- **Current state:** how it's handled today, with specific files/class names/tokens (quote them).
- **Gaps:** each with what reads as generic/dated/flat + the evidence.
- **Upgrades:** for each — a concrete **before/after** snippet (5-15 lines each, real CSS/markup, not pseudocode) · the **modern technique** used and why it matters · the **scope** (one-file token cascade vs component sweep) · a **reduced-motion / a11y note**.

Show the code. Coherence-first (systemic tokens over one-off flourishes). Do not rank across dimensions — the caller does that.
````

- [ ] **Step 2: Validate frontmatter + read-only tools**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/agents/ui-auditor.md
grep -q '^name: ui-auditor$' "$f" && grep -q '^tools: Read, Grep, Glob$' "$f" && ! grep -qE '^tools:.*(Write|Edit|Bash|NotebookEdit)' "$f" && echo "AGENT OK"
```
Expected: `AGENT OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/agents/ui-auditor.md
git commit -m "feat(agents): add read-only ui-auditor subagent"
```

---

## Task 3: `frontier-researcher` subagent

**Files:**
- Create: `plugins/altivum-feature-dev-pipeline/agents/frontier-researcher.md`

- [ ] **Step 1: Create the agent file** with exactly this content:

````md
---
name: frontier-researcher
description: Read-only live web research on ONE angle (category leaders, signature UX/interaction patterns, emerging platform capabilities, or a field-specific question) for a given project positioning. Returns concrete cited findings (name + URL + technique + why-now) grounded to the repo. Invoke one per angle, in parallel.
tools: WebSearch, WebFetch, Read, Grep
---

You are a read-only frontier researcher. You will be given ONE research angle plus the project's positioning statement (product type, vertical, audience, stack, peer set). Research that angle with LIVE web searches — do not rely on training memory; the goal is "latest and greatest," and last year's patterns are already wallpaper. You are **read-only**: report findings; never edit code.

## Angles (research exactly the one you're assigned)
- **Category leaders, right now** — who ships the most talked-about sites/products in this vertical this year (Awwwards SOTD, FWA, CSS Design Awards, Webby, "best of" roundups, HN/X threads). Capture 3-5 concrete example URLs.
- **Signature UX / interaction patterns** — specific current techniques (scroll-driven storytelling, View Transitions, WebGPU/WebGL backdrops, command-K, AI-native search, real-time cursors…). Name the pattern AND a site using it well.
- **Emerging platform capabilities** — web standards/APIs shipped to Baseline in ~the last 12 months the project isn't using (View Transitions, Speculation Rules, `@scope`/`@container`/`:has()`, Popover/Anchor Positioning, CSS scroll-driven animations, Server Components, WebGPU, edge/streaming, vector search…).
- **Field-specific** — one targeted search on the sharpest question ("best <field> sites 2026", "how <peer> built <feature>", "<emerging tech> case study <vertical>").

## Method
1. Run at least 3-4 distinct searches for your angle; open promising results with WebFetch to confirm specifics. If results are thin, pivot the query rather than padding with generic advice.
2. Keep a running list of concrete references with URLs. Every finding names a real source.
3. Ground to the repo: skim README/manifests and the relevant routes/components (Read/Grep) so you can say which specific files/routes a finding could attach to.

## Output (your angle ONLY)
- **Angle:** <assigned angle>
- **Findings:** 3-6 items, each with — **what it is** · **who's doing it** (name + URL) · **the technique** · **why now** (a newly-Baseline API, shifted expectation, competitor gap) · **repo fit** (specific files/routes it could extend).
- **Caveats:** anything you couldn't verify (and why).

No vague "other companies do this." Name the company, link the page. Do not produce final recommendations — the caller synthesizes across angles.
````

- [ ] **Step 2: Validate frontmatter + tools**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/agents/frontier-researcher.md
grep -q '^name: frontier-researcher$' "$f" && grep -q '^tools: WebSearch, WebFetch, Read, Grep$' "$f" && ! grep -qE '^tools:.*(Write|Edit|NotebookEdit)' "$f" && echo "AGENT OK"
```
Expected: `AGENT OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/agents/frontier-researcher.md
git commit -m "feat(agents): add read-only frontier-researcher subagent"
```

---

## Task 4: Refocus `eval` to health/architecture

**Files:**
- Modify (overwrite): `plugins/altivum-feature-dev-pipeline/commands/eval.md`

- [ ] **Step 1: Overwrite the file** with exactly this content:

````md
---
description: Empirical health & architecture audit — structure, correctness, security, maintainability — with prioritized, evidence-backed fixes.
argument-hint: "[optional area/path to scope the evaluation]"
---

# Codebase Evaluation & Analysis (health / architecture)

Perform a thorough, **empirical** evaluation of the project (scoped to **$ARGUMENTS** if provided) and surface the highest-impact fixes to its health and architecture.

## How this differs from the improve lenses
`eval` answers "is the house structurally sound?" — correctness, architecture, security, maintainability, evidence-backed performance. It is NOT for bold product moves (`/altivum-feature-dev-pipeline:improve`), visual craft (`:improve-ui`), researched frontier bets (`:improve-x2`), or UX-flow friction (`:enhance`). When you spot something that belongs to one of those, note it in one line and point at that lens — don't expand this audit into it.

## Workflow
1. **Project Discovery** — Identify project type, framework, and stack. Read package manifests, configs, and docs (README, CLAUDE.md). Understand the build/dev/test workflow.
2. **Architecture Analysis** — Map the directory structure and patterns. Identify key components/modules and their relationships, data flow, state management, API integrations, external dependencies, and the testing strategy.
3. **Code Quality Assessment** — Review patterns and consistency; find bugs, anti-patterns, and tech debt; evaluate error handling and edge cases; assess security and maintainability. **Gather empirical ground truth** (lint, typecheck, tests, build, dependency audit) and **cite the real output**.
4. **Improvement Recommendations** — 2-4 specific, prioritized, actionable fixes with the highest impact on correctness/health/security/maintainability.

**Optional depth:** for a large or multi-layer codebase, dispatch the `altivum-feature-dev-pipeline:codebase-analyzer` subagent in parallel — one per layer (frontend / backend / data-infra) — then synthesize their findings here. If subagents are unavailable, do the analysis inline.

## Output Format
```
PROJECT OVERVIEW
================
[Type, stack, purpose]

ARCHITECTURE UNDERSTANDING
==========================
[Key patterns, data flow, component structure]

CODEBASE HEALTH
===============
Strengths: [2-3 things done well]
Areas for Improvement: [2-3 opportunities]

RECOMMENDATIONS
===============
1. [Title]
   - What:   [Description]
   - Why:    [Value/Impact]
   - How:    [Implementation approach + specific files]
   - Effort: [Low/Medium/High]
2. ...
```

## Quality rules
- Actionable insights over generic observations. Be specific with file paths and references.
- Don't fabricate findings — verify against the actual code and cite real command output; if something is fine, say so in strengths.
- Respect existing patterns and constraints.

End by asking which recommendation(s) to carry into planning: `/altivum-feature-dev-pipeline:plan <numbers>`.
````

- [ ] **Step 2: Validate the refocus landed**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/commands/eval.md
grep -q 'How this differs from the improve lenses' "$f" && grep -q 'altivum-feature-dev-pipeline:codebase-analyzer' "$f" && grep -q 'altivum-feature-dev-pipeline:plan' "$f" && echo "EVAL OK"
```
Expected: `EVAL OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/commands/eval.md
git commit -m "refactor(eval): refocus to empirical health/architecture audit; add lens differentiation + optional analyzer fan-out"
```

---

## Task 5: `improve` lens command

**Files:**
- Create: `plugins/altivum-feature-dev-pipeline/commands/improve.md`

- [ ] **Step 1: Create the file** with exactly this content:

````md
---
description: Bold full-stack improvement lens — analyzes frontend, backend, and data/infra layers and proposes exactly 3 high-impact, cross-layer moves.
argument-hint: "[optional area/path to scope the analysis]"
---

# /improve — full-stack improvement lens

You are a senior full-stack architect and product strategist. Make this app **exceptional**, not just functional. Scope to **$ARGUMENTS** if provided.

This lens is for **bold, cross-layer moves**. It is distinct from its siblings: `:eval` covers correctness/health/architecture, `:improve-ui` visual craft, `:improve-x2` researched frontier bets, `:enhance` UX-flow friction — don't reproduce those here.

## Phase 1: Deep analysis (all three layers)
Understand the full stack before recommending anything:
- **Frontend** — UI/UX patterns, component architecture, styling, performance (bundle, rendering, lazy-load, caching), state & data fetching, error/loading states.
- **Backend / API** — routes, middleware, authn/authz, business-logic organization & separation of concerns, error handling/validation/logging/observability, API design, security posture.
- **Data / Infra** — schema design, indexing, query efficiency, hosting/CI-CD/env management, caching & persistence, scalability bottlenecks, cost efficiency.

**Depth:** dispatch the `altivum-feature-dev-pipeline:codebase-analyzer` subagent in parallel — one per layer (frontend, backend, data-infra) — passing the discovered stack as context, then synthesize their findings into the recommendations below. If subagents are unavailable, read every relevant file and analyze inline. Either way, ground every claim in real files.

## Phase 2: Exactly 3 recommendations
Pick the 3 changes that deliver the biggest improvement to quality, UX, performance, or maintainability.
- **Think outside the box** — not lint fixes or minor refactors; moves that make a user say "wow" or give a competitive edge.
- **Stay tethered** — implementable on the current stack (or reasonable additions); no full rewrites.
- **Span the stack** — aim for cross-layer impact.
- **Be specific** — exactly what, where, how, why; cite files.

Each recommendation MUST include:
1. **Title** — clear, compelling.
2. **The Problem** — what's lacking/inefficient/missing, with file references and code examples.
3. **The Vision** — what the app looks like after. Paint it.
4. **Why It Matters** — concrete impact on users/devs/perf/business.
5. **Technical Approach** — high-level (not a full plan — that's `:plan`).
6. **Complexity Estimate** — Low/Med/High and why.

## Output Format
```
## Stack Analysis Summary
[Concise current state across all three layers — strengths and gaps]

---

## Recommendation 1: [Title]
[Full details]

---

## Recommendation 2: [Title]
[Full details]

---

## Recommendation 3: [Title]
[Full details]

---

## Bottom Line
[Which delivers the most value per effort, and a suggested execution order.]
```

## Discipline checks (do not skip)
- [ ] Each recommendation is tied to specific files/routes/components in *this* codebase.
- [ ] No recommendation is generic perf/lint/refactor filler (`:eval`), pure visual polish (`:improve-ui`), or a researched trend (`:improve-x2`).
- [ ] No recommendation requires a full rewrite, a new team, or unbounded budget.

Analyze deeply, recommend boldly. End with the handoff: use `/altivum-feature-dev-pipeline:plan 1` (or `plan 1 2 3`) to turn a recommendation into an implementation plan, then `:execute`.
````

- [ ] **Step 2: Validate**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/commands/improve.md
grep -q '^argument-hint:' "$f" && grep -q 'altivum-feature-dev-pipeline:codebase-analyzer' "$f" && grep -q 'altivum-feature-dev-pipeline:plan' "$f" && ! grep -qE '\(/plan |`/plan ' "$f" && echo "IMPROVE OK"
```
Expected: `IMPROVE OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/commands/improve.md
git commit -m "feat(commands): add full-stack improve lens with codebase-analyzer fan-out"
```

---

## Task 6: `improve-ui` lens command

**Files:**
- Create: `plugins/altivum-feature-dev-pipeline/commands/improve-ui.md`

- [ ] **Step 1: Create the file** with exactly this content:

````md
---
description: Interface-craft lens — audits visual design quality and modern CSS, proposes exactly 3 UI upgrades with before/after code.
argument-hint: "[optional area/path to scope the audit]"
---

# /improve-ui — interface-craft lens

You are a senior UI engineer and design-systems architect. Elevate this interface from functional to refined using modern CSS and contemporary component patterns that ship today. Scope to **$ARGUMENTS** if provided. Discover the stack — don't assume it.

Distinct from siblings: `:improve` is full-stack architecture, `:improve-x2` researched bold moves, `:enhance` UX-flow friction. This lens is **visual language, motion, and component sophistication** — the gap between "it works" and "it feels right."

## Phase 1: Discover the UI stack
Read config + UI files to establish: framework; styling system + version (Tailwind vN? CSS Modules? vanilla? Panda?); component library (shadcn/Radix/Headless/Ark/custom/none); motion approach (Framer Motion/GSAP/CSS/View Transitions/none); design tokens; and which modern CSS the project uses or could adopt (container queries, `:has()`, subgrid, oklch, `color-mix()`, `@layer`, scroll-driven animations, anchor positioning, `@starting-style`). Read config files, the global stylesheet/theme, shared primitives (Button/Card/Modal/Input), and 3-5 representative components.

## Phase 2: Audit (optionally in parallel)
Dispatch the `altivum-feature-dev-pipeline:ui-auditor` subagent in parallel — one per dimension: **typography & rhythm, color & contrast, layout & spacing, motion, component-craft & polish** — passing the discovered stack, then synthesize their gaps + before/after sketches. If subagents are unavailable, audit all dimensions inline.

## Phase 3: Exactly 3 recommendations
Pick the 3 that most noticeably elevate interface quality.
- **Visual impact first** — the difference should be *seen* immediately.
- **Use the platform** — modern CSS before JS libraries; least code wins.
- **Specific to this code** — cite exact files, components, class names, tokens; show what exists and what it becomes.
- **Stay in-stack** — Tailwind-vN solutions for a Tailwind-vN project; no framework switch.
- **Coherence over novelty** — unify the whole UI, not one flashy page.
- **No a11y regressions** — motion is reduced-motion-aware; color changes preserve contrast.

Each recommendation MUST include:
1. **Title** — specific and visual ("Layered Elevation with Multi-Shadow Depth", not "Improve Shadows").
2. **The Gap** — what the UI does today and why it reads generic/dated/flat (cite files + current patterns).
3. **The Upgrade** — concrete **before/after** code (5-15 lines each, real CSS/markup), implementable from the snippet alone.
4. **Modern Techniques Used** — name the 2025-era features and why they matter.
5. **Scope of Change** — files/components affected; one-file token cascade vs component sweep.
6. **Reduced-Motion / Accessibility Note** — how it degrades gracefully.
7. **Effort** — Low (<1h) / Medium (1-4h) / High (half-day+) with justification.

## Output Format
```
## UI Stack Profile
[Framework, styling, version, current maturity in one paragraph.]

## Audit Findings
[5-8 bullets: the biggest gaps achievable with the current stack, each referencing a specific file/pattern.]

---

## Recommendation 1: [Title]
[Full details incl. before/after code]

---

## Recommendation 2: [Title]
[Full details]

---

## Recommendation 3: [Title]
[Full details]

---

## Implementation Order
[Which first and why; note which compound — e.g. color system before elevation.]
```

## Discipline checks (do not skip)
- [ ] I read the actual CSS/styling files and representative components — not just config.
- [ ] Each recommendation cites files/class names/tokens that exist today and includes concrete before/after code.
- [ ] Every technique is Baseline 2024+ or supported by the project's tooling.
- [ ] No a11y regression without a mitigation.
- [ ] Nothing duplicates `:improve`, `:improve-x2`, or `:enhance`; systemic coherence over one-offs.

Show the code. End with the handoff: `/altivum-feature-dev-pipeline:plan 1` (or `plan 1 2 3`), then `:execute`.
````

- [ ] **Step 2: Validate**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/commands/improve-ui.md
grep -q '^argument-hint:' "$f" && grep -q 'altivum-feature-dev-pipeline:ui-auditor' "$f" && grep -q 'altivum-feature-dev-pipeline:plan' "$f" && echo "IMPROVE-UI OK"
```
Expected: `IMPROVE-UI OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/commands/improve-ui.md
git commit -m "feat(commands): add interface-craft improve-ui lens with ui-auditor fan-out"
```

---

## Task 7: `improve-x2` lens command

**Files:**
- Create: `plugins/altivum-feature-dev-pipeline/commands/improve-x2.md`

- [ ] **Step 1: Create the file** with exactly this content:

````md
---
description: Frontier lens — researches category leaders and emerging platform capabilities (live web), then proposes exactly 3 distinctive, buildable moves, each citing real examples.
argument-hint: "[optional focus, e.g. 'the landing page' or 'onboarding']"
---

# /improve-x2 — frontier / distinctiveness lens

You are a senior creative technologist and product futurist. Don't harden this app — help it **leap**. Study what the best teams are shipping *right now*, then propose three moves that make this project feel contemporary, inevitable, and slightly ahead. Executable in any project — discover the stack, domain, and audience; don't assume. Scope to **$ARGUMENTS** if provided.

Distinct from siblings: `:eval` hardens, `:improve` does full-stack architecture, `:improve-ui` visual craft, `:enhance` UX friction. This lens is about how the project *feels* — motion, narrative, interaction, intelligence, distinctiveness.

## Phase 1: Identify the field
Read README/CLAUDE.md/manifests, entry points + top-level routes, the first 100-200 lines of the main page/server file, and any docs/marketing copy. Write yourself a positioning statement (don't show it yet): "This is a `<product type>` in `<vertical>`, targeting `<audience>`, on `<stack>`; peers are `<3-5 examples>`; category leaders are `<2-3>`." Be honest — a government SDVOSB site and a consumer fashion brand have different peer sets.

## Phase 2: Research the state of the art (live web required)
**Live web research is required** — patterns that felt fresh 12 months ago are wallpaper. Dispatch the `altivum-feature-dev-pipeline:frontier-researcher` subagent in parallel — one per angle: **category leaders now, signature UX/interaction patterns, emerging platform capabilities, field-specific** — passing the positioning statement. Each returns cited findings (name + URL + technique + why-now + repo fit). If subagents are unavailable, run the searches inline. If web tools are entirely unavailable in this environment, **stop and tell the user this lens needs web access** rather than producing uncited recommendations.

## Phase 3: Exactly 3 forward-thinking recommendations
Moves that could get posted to HN or earn an Awwwards nod — but **buildable in days-to-weeks** on the current stack.
- **Push the edge, don't fall off it** — one or two steps ahead, not five.
- **Cite what you found** — each rec references ≥1 specific example with URL.
- **Differ from `:improve`** — feel/motion/narrative/intelligence, not refactors/perf.
- **Match the domain** — calibrate "bold" to the peer set.
- **No pie-in-the-sky, no generic AI sprinkles** — "add AI" is not a recommendation.

Each recommendation MUST include:
1. **Title** — short, specific, a little bold.
2. **The Move** — one concrete, visualizable paragraph.
3. **Who's Doing It** — 1-2 named examples + URLs, and what's good about their execution.
4. **Why Now** — a newly-Baseline API, shifted expectation, competitor gap, just-stabilized capability.
5. **Fit to This Project** — why it extends what exists (cite specific files/routes/components).
6. **Build Sketch** — 3-6 bullets: what's added/changed, libraries/APIs in play, where the risk is.
7. **Complexity & Timeline** — Low/Med/High + a week estimate for one engineer.
8. **The Risk** — the one thing most likely to make it worse (perf, a11y tax, over-animation, brand mismatch) and the mitigation.

## Output Format
```
## Positioning
[One paragraph: what this is, who its peers are, what "great" looks like here now.]

## Research Signals
[6-10 bullets of the most interesting findings, each with a URL.]

---

## Recommendation 1: [Title]
[Full details per template]

---

## Recommendation 2: [Title]
[Full details]

---

## Recommendation 3: [Title]
[Full details]

---

## If I Could Only Ship One
[Most distinctiveness per unit effort — and why. Then a suggested order for all three.]
```

## Discipline checks (do not skip)
- [ ] I identified the actual field and named real peer companies — not generic categories.
- [ ] Research ran with concrete URLs captured (not paraphrased memory).
- [ ] Each recommendation cites ≥1 real site with a URL.
- [ ] Each recommendation is tied to specific files/routes/components in *this* codebase.
- [ ] Nothing requires a full rewrite, new team, or unbounded budget.
- [ ] Nothing overlaps `:improve` (generic perf/lint/refactor).
- [ ] Each recommendation includes its failure mode.

Cite your sources. End with the handoff: `/altivum-feature-dev-pipeline:plan 1` (or `plan 1 2 3`), then `:execute`.
````

- [ ] **Step 2: Validate**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/commands/improve-x2.md
grep -q '^argument-hint:' "$f" && grep -q 'altivum-feature-dev-pipeline:frontier-researcher' "$f" && grep -q 'altivum-feature-dev-pipeline:plan' "$f" && grep -q 'needs web access' "$f" && echo "IMPROVE-X2 OK"
```
Expected: `IMPROVE-X2 OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/commands/improve-x2.md
git commit -m "feat(commands): add frontier improve-x2 lens with frontier-researcher fan-out"
```

---

## Task 8: `enhance` lens command

**Files:**
- Create: `plugins/altivum-feature-dev-pipeline/commands/enhance.md`

- [ ] **Step 1: Create the file** with exactly this content:

````md
---
description: UX-friction lens — traces real user flows and proposes exactly 3 code-grounded fixes for the friction users actually hit, ranked by impact.
argument-hint: "[optional flow/area to scope, e.g. 'checkout' or 'auth']"
---

# /enhance — UX-friction lens

Scan the frontend and backend to find where the existing user experience actually hurts, and propose 3 concrete, code-grounded fixes ranked by user impact. Every recommendation must reference specific files/patterns — no generic advice. Scope to **$ARGUMENTS** if provided.

Distinct from siblings: this is **not** visual polish (`:improve-ui`), bold product moves (`:improve`), researched trends (`:improve-x2`), or architecture health (`:eval`). It's the friction in flows that already "work."

## Phase 1: Project discovery
Read manifests + build config + routing + docs to determine: frontend framework, backend framework, state management, data-fetching pattern, styling approach.

## Phase 2: User-flow mapping
Trace the primary journeys through the code: entry points & routes; auth flow (login/signup/session/guards); the 3-5 most important user actions (create/read/update primary resources); data loading (API → UI, caching, loading/error states); navigation patterns (links, redirects, back).

## Phase 3: Friction analysis (optionally in parallel)
Dispatch the `altivum-feature-dev-pipeline:codebase-analyzer` subagent with the focus "user-flow UX friction" (you may run several in parallel scoped to different flows), then synthesize. If subagents are unavailable, scan inline. Look for:
- **Loading & performance** — missing loading states; waterfall fetches; un-split heavy imports; no pagination/virtualization on growable lists; unoptimized/non-lazy images; refetch-on-every-mount without caching.
- **Error & edge cases** — API calls with no error UI (catch only logs); validation only on submit (no inline feedback); blank empty states; broken flows on network failure (no retry/offline); destructive actions without confirm.
- **Navigation & IA** — dead ends; missing breadcrumbs/context; inconsistent back behavior; silent successes (no toast/redirect); multi-step flows with no progress/back.
- **Responsiveness & a11y** — non-adaptive layouts; touch targets < 44px; missing aria on icon-only buttons; focus-management issues (modal/drawer trap & return); contrast in semantic colors.
- **State & data freshness** — stale data after mutations; missed optimistic-UI opportunities; forms that lose data on navigation; manual refresh where SSE/WebSocket fits.

## Phase 4: Rank & select the 3 highest-impact
Prioritize: most-common actions (frequency); confusion/data-loss (severity); low-effort-high-impact (ROI). Discard cosmetic-only, already-handled, or major-architecture-with-uncertain-payoff items. If you find only 2 meaningful issues, present 2 — don't pad.

## Output Format
```
ENHANCE: UX Improvement Report
===============================

Project: [name] | Stack: [key technologies]
Scanned: [N] pages, [N] hooks/controllers, [N] components

---

1. [Short, specific title]                                    Impact: HIGH
   Effort: [Low/Medium/High]

   Problem:
   [2-3 sentences. Reference specific files and line numbers.]

   Evidence:
   - [file:line] — [what the code does that creates the problem]
   - [file:line] — [supporting evidence]

   Proposal:
   [3-5 sentences. Name specific files to modify, patterns to introduce,
   and the expected user-facing result.]

---

2. [Short, specific title]                                    Impact: HIGH
   ...

---

3. [Short, specific title]                                    Impact: MEDIUM
   ...
```

## Rules
- **No generic advice.** Every problem cites a file path and describes what the code actually does. Not "add loading states" but "History.tsx:45 fetches in useEffect but renders nothing until `sessions` is non-empty, leaving a blank screen for 200-800ms."
- **No cosmetic-only suggestions.** Each must improve task completion, perceived speed, error recovery, or comprehension.
- **Stay within the existing architecture.** No framework/state-lib/backend rewrites.
- **Concrete implementation.** Name files to create/modify, the pattern, approximate scope.
- **Rank honestly.**

End with the handoff: "Want me to plan any of these? Use `/altivum-feature-dev-pipeline:plan <number>` (start with the lowest-effort), then `:execute`."
````

- [ ] **Step 2: Validate**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/commands/enhance.md
grep -q '^argument-hint:' "$f" && grep -q 'altivum-feature-dev-pipeline:codebase-analyzer' "$f" && grep -q 'altivum-feature-dev-pipeline:plan' "$f" && echo "ENHANCE OK"
```
Expected: `ENHANCE OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/commands/enhance.md
git commit -m "feat(commands): add UX-friction enhance lens with codebase-analyzer fan-out"
```

---

## Task 9: `recon` Workflow orchestration script

**Files:**
- Create: `plugins/altivum-feature-dev-pipeline/workflows/audit.mjs`

- [ ] **Step 1: Create the script** with exactly this content:

````javascript
export const meta = {
  name: 'altivum-recon-audit',
  description: 'Multi-lens parallel codebase audit (eval/improve/improve-ui/improve-x2/enhance) synthesized into one prioritized brief',
  phases: [
    { title: 'Analyze', detail: 'fan out read-only analyzers per lens and focus area' },
    { title: 'Synthesize', detail: 'dedup and rank findings across lenses into one brief' },
  ],
}

// Lens -> which read-only subagent powers it, and the focus areas to fan out.
const LENS_CONFIG = {
  'eval': {
    label: 'eval (health / architecture)',
    agentType: 'altivum-feature-dev-pipeline:codebase-analyzer',
    focuses: ['frontend layer', 'backend/API layer', 'data & infrastructure layer'],
    lens: 'empirical health, correctness, security, maintainability, architecture',
  },
  'improve': {
    label: 'improve (full-stack)',
    agentType: 'altivum-feature-dev-pipeline:codebase-analyzer',
    focuses: ['frontend layer', 'backend/API layer', 'data & infrastructure layer'],
    lens: 'bold, high-impact, cross-layer product/architecture moves',
  },
  'improve-ui': {
    label: 'improve-ui (interface craft)',
    agentType: 'altivum-feature-dev-pipeline:ui-auditor',
    focuses: ['typography & rhythm', 'color & contrast', 'layout & spacing', 'motion', 'component-craft & polish'],
    lens: 'visual design quality and modern CSS craft',
  },
  'improve-x2': {
    label: 'improve-x2 (frontier)',
    agentType: 'altivum-feature-dev-pipeline:frontier-researcher',
    focuses: ['category leaders now', 'signature UX/interaction patterns', 'emerging platform capabilities', 'field-specific'],
    lens: 'researched, distinctive, buildable frontier moves (cite real examples + URLs)',
  },
  'enhance': {
    label: 'enhance (UX friction)',
    agentType: 'altivum-feature-dev-pipeline:codebase-analyzer',
    focuses: ['user-flow UX friction'],
    lens: 'concrete UX friction in existing user flows, ranked by user impact',
  },
}

const ALL = Object.keys(LENS_CONFIG)

// args: { path?: string, lenses?: string[] }
const requested = (args && Array.isArray(args.lenses) && args.lenses.length) ? args.lenses : ALL
let lenses = requested.filter((l) => LENS_CONFIG[l])
if (!lenses.length) lenses = ALL
const scope = (args && args.path) ? args.path : 'the whole repository'

log(`recon: ${lenses.length} lens(es) over ${scope}`)

phase('Analyze')
const perLens = await parallel(
  lenses.map((name) => async () => {
    const cfg = LENS_CONFIG[name]
    const findings = await parallel(
      cfg.focuses.map((focus) => () =>
        agent(
          `Analyze ${scope} for the "${focus}" focus, in service of the ${name} lens ` +
            `(${cfg.lens}). Return structured, file-grounded findings for this focus only; do not rank.`,
          { label: `${name}:${focus}`, phase: 'Analyze', agentType: cfg.agentType },
        ),
      ),
    )
    return { lens: name, label: cfg.label, focuses: cfg.focuses, findings: findings.filter(Boolean) }
  }),
)

const lensesWithFindings = perLens.filter(Boolean).filter((l) => l.findings.length)

phase('Synthesize')
const dossier = lensesWithFindings
  .map(
    (l) =>
      `### Lens: ${l.label}\n` +
      l.findings.map((f, i) => `#### Focus: ${l.focuses[i] || `finding ${i + 1}`}\n${f}`).join('\n\n'),
  )
  .join('\n\n---\n\n')

const brief = await agent(
  `You are synthesizing a multi-lens audit of ${scope}. Below are findings from ` +
    `${lensesWithFindings.length} analysis lens(es), each with one or more focus areas.\n\n` +
    dossier +
    `\n\nProduce ONE unified, prioritized brief:\n` +
    `- Dedup overlapping findings across lenses; when multiple lenses flag the same thing, mark it — that is a strong signal.\n` +
    `- Rank by impact-per-effort, preserving each item's provenance (which lens/lenses it came from).\n` +
    `- Group into "Top recommendations" (a numbered, prioritized shortlist) and "Also noted" (everything else worth tracking).\n` +
    `- For each top item: Title · What & why (with file evidence) · Lens(es) · Rough impact · Rough effort.\n` +
    `- Keep numbering stable, and end by telling the user to run /altivum-feature-dev-pipeline:plan <numbers> on the items they want, then :execute.`,
  { label: 'synthesize', phase: 'Synthesize' },
)

return { scope, lenses, brief }
````

- [ ] **Step 2: Syntax-check the script (Node parses ESM + top-level await)**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
node --check plugins/altivum-feature-dev-pipeline/workflows/audit.mjs && echo "WORKFLOW SYNTAX OK"
```
Expected: `WORKFLOW SYNTAX OK`

- [ ] **Step 3: Assert the namespaced agentTypes and meta phases are present**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/workflows/audit.mjs
grep -q "altivum-feature-dev-pipeline:codebase-analyzer" "$f" && grep -q "altivum-feature-dev-pipeline:ui-auditor" "$f" && grep -q "altivum-feature-dev-pipeline:frontier-researcher" "$f" && grep -q "export const meta" "$f" && echo "WORKFLOW WIRING OK"
```
Expected: `WORKFLOW WIRING OK`

- [ ] **Step 4: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/workflows/audit.mjs
git commit -m "feat(workflows): add recon multi-lens audit orchestration script"
```

---

## Task 10: `recon` command

**Files:**
- Create: `plugins/altivum-feature-dev-pipeline/commands/recon.md`

- [ ] **Step 1: Create the file** with exactly this content:

````md
---
description: Multi-lens recon — runs all (or selected) analysis lenses in parallel and synthesizes one unified, prioritized brief. Powered by the Workflow tool, with graceful fallback.
argument-hint: "[optional path] [lenses: eval improve improve-ui improve-x2 enhance]"
---

# /recon — multi-lens reconnaissance

Run a comprehensive, parallel analysis of the project across multiple lenses and synthesize ONE unified, prioritized brief that feeds `:plan`. Arguments: **$ARGUMENTS** — an optional path/area to scope, and optionally a subset of lenses (`eval`, `improve`, `improve-ui`, `improve-x2`, `enhance`). Default: all lenses, whole repo.

This is intentionally thorough and can spawn many read-only agents — scope it (a path and/or a lens subset) to control breadth and cost.

## Parse the arguments
From `$ARGUMENTS`, derive:
- `path` — the first token that looks like a path/area (e.g. `src/reports`), or none.
- `lenses` — any recognized lens names present (`eval`, `improve`, `improve-ui`, `improve-x2`, `enhance`); default to all five if none are named.

## Preferred path — Workflow tool
Running this command is itself the user's opt-in to multi-agent orchestration, so use the Workflow tool to run the plugin's shipped orchestration script, passing `{ path, lenses }`. Note: `${CLAUDE_PLUGIN_ROOT}` does NOT expand inside command bodies, so resolve the script by locating it, then prefer running it inline:
1. Locate the shipped script `workflows/audit.mjs` inside this plugin's installed directory — e.g. Glob for `**/altivum-feature-dev-pipeline/workflows/audit.mjs` (it sits beside this command's `commands/` directory).
2. **Read** that file and run it inline: `Workflow({ script: <file contents>, args: { path, lenses } })`. Inline `script` is the most robust form. (`Workflow({ scriptPath: <absolute path to audit.mjs>, args: { path, lenses } })` may also work where supported.)
3. The script fans the read-only analyzer subagents out per lens and focus area in parallel, then synthesizes across lenses and returns a `brief`. Present that brief to the user (lightly formatted), then do the handoff below.

## Fallback — no Workflow tool
If the Workflow tool is unavailable in this environment, do the equivalent yourself:
1. For each selected lens, dispatch its analyzer subagent(s) via the Task tool, in parallel where possible:
   - `eval`, `improve` → `altivum-feature-dev-pipeline:codebase-analyzer`, focuses: frontend layer / backend-API layer / data-infra layer.
   - `enhance` → `altivum-feature-dev-pipeline:codebase-analyzer`, focus: "user-flow UX friction".
   - `improve-ui` → `altivum-feature-dev-pipeline:ui-auditor`, dimensions: typography & rhythm, color & contrast, layout & spacing, motion, component-craft & polish.
   - `improve-x2` → `altivum-feature-dev-pipeline:frontier-researcher`, angles: category leaders, signature UX patterns, emerging platform capabilities, field-specific.
2. If subagents are also unavailable, analyze each selected lens inline.
3. Synthesize all findings yourself (next section).

## Synthesis (always)
Produce ONE unified brief:
- **Dedup** overlapping findings across lenses; when multiple lenses flag the same thing, mark it — strong signal.
- **Rank** by impact-per-effort, preserving each item's provenance (which lens/lenses).
- Group into **Top recommendations** (a numbered, prioritized shortlist) and **Also noted**.
- For each top item: Title · What & why (file evidence) · Lens(es) · Impact · Effort.

End with the handoff: "Run `/altivum-feature-dev-pipeline:plan <numbers>` on the items you want, then `:execute`." Keep numbering stable so `plan 2 4` works.
````

- [ ] **Step 2: Validate**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/commands/recon.md
grep -q 'workflows/audit.mjs' "$f" && grep -q 'Fallback — no Workflow tool' "$f" && grep -q 'altivum-feature-dev-pipeline:plan' "$f" && echo "RECON OK"
```
Expected: `RECON OK`

- [ ] **Step 3: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/commands/recon.md
git commit -m "feat(commands): add Workflow-powered recon multi-lens orchestrator with fallback"
```

---

## Task 11: Wire the lenses into `/ship`

**Files:**
- Modify: `plugins/altivum-feature-dev-pipeline/commands/ship.md`

- [ ] **Step 1: Extend the sibling-commands list.** Replace this exact block:

```
The phase logic lives in the sibling commands of this plugin — apply the same instructions they contain:
- `/altivum-feature-dev-pipeline:eval`
- `/altivum-feature-dev-pipeline:plan`
- `/altivum-feature-dev-pipeline:execute`
- `/altivum-feature-dev-pipeline:deploy`
```

with:

```
The phase logic lives in the sibling commands of this plugin — apply the same instructions they contain:
- `/altivum-feature-dev-pipeline:eval` (default analysis lens) — or a focused lens (`:improve`, `:improve-ui`, `:improve-x2`, `:enhance`) or the full `:recon` audit
- `/altivum-feature-dev-pipeline:plan`
- `/altivum-feature-dev-pipeline:execute`
- `/altivum-feature-dev-pipeline:deploy`
```

- [ ] **Step 2: Add the swappable-lens note in the EVAL phase.** Replace this exact block:

```
1. **EVAL** — Run the eval phase to understand the codebase and surface prioritized recommendations. If `$ARGUMENTS` already names a specific change, scope the eval to the relevant area. Present the numbered recommendations.
   - **GATE:** Ask which recommendation(s) to carry forward (or confirm the stated goal). Wait.
```

with:

```
1. **EVAL** — Run the eval phase to understand the codebase and surface prioritized recommendations. If `$ARGUMENTS` already names a specific change, scope the eval to the relevant area. Present the numbered recommendations.
   - The analysis lens is swappable: default to `:eval` (health/architecture), or run a targeted lens (`:improve`, `:improve-ui`, `:improve-x2`, `:enhance`) or the full `:recon` audit when the goal calls for it. The numbered recommendations feed the same PLAN gate.
   - **GATE:** Ask which recommendation(s) to carry forward (or confirm the stated goal). Wait.
```

- [ ] **Step 3: Validate**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
f=plugins/altivum-feature-dev-pipeline/commands/ship.md
grep -q 'analysis lens is swappable' "$f" && grep -q ':recon' "$f" && echo "SHIP OK"
```
Expected: `SHIP OK`

- [ ] **Step 4: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/commands/ship.md
git commit -m "feat(ship): note swappable analysis lens (improve/ui/x2/enhance/recon) in EVAL phase"
```

---

## Task 12: Manifests & docs (version bump + READMEs + marketplace)

**Files:**
- Modify: `plugins/altivum-feature-dev-pipeline/.claude-plugin/plugin.json`
- Modify: `plugins/altivum-feature-dev-pipeline/README.md`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `README.md` (repo root)

- [ ] **Step 1: Bump + enrich `plugin.json`.** Overwrite `plugins/altivum-feature-dev-pipeline/.claude-plugin/plugin.json` with exactly:

````json
{
  "name": "altivum-feature-dev-pipeline",
  "description": "Altivum's eval -> plan -> execute -> deploy feature-development pipeline as one refinable, versioned workflow. Provides a /ship orchestrator, five front-of-pipeline analysis lenses (eval, improve, improve-ui, improve-x2, enhance) plus a Workflow-powered /recon multi-lens audit, the read-only codebase-analyzer/ui-auditor/frontier-researcher and deploy-validator/security-reviewer subagents, and a blocking production-deploy gate.",
  "version": "0.3.0",
  "author": { "name": "Altivum Inc.", "url": "https://altivum.io" },
  "homepage": "https://github.com/AltivumInc-Admin/claude-plugins-public",
  "repository": "https://github.com/AltivumInc-Admin/claude-plugins-public",
  "license": "Apache-2.0",
  "keywords": ["workflow", "pipeline", "eval", "plan", "execute", "deploy", "aws", "improve", "ui", "research", "audit"]
}
````

- [ ] **Step 2: Update the plugin README.** Overwrite `plugins/altivum-feature-dev-pipeline/README.md` with exactly:

````md
# altivum-feature-dev-pipeline

A Claude Code **plugin** that packages Altivum's feature-development workflow —
**eval → plan → execute → deploy** — into one versioned, refinable, shareable unit,
with five front-of-pipeline analysis lenses and a Workflow-powered multi-lens audit.

## What's inside

```
altivum-feature-dev-pipeline/
├── .claude-plugin/
│   ├── plugin.json          # manifest (name, version — bump to release updates)
│   └── marketplace.json     # lets this repo double as an installable marketplace
├── commands/
│   ├── ship.md              # /…:ship — orchestrator: runs all 4 phases with approval gates
│   ├── eval.md              # /…:eval — empirical health & architecture audit
│   ├── improve.md           # /…:improve — bold full-stack improvement lens
│   ├── improve-ui.md        # /…:improve-ui — interface-craft / modern-CSS lens
│   ├── improve-x2.md        # /…:improve-x2 — researched frontier / distinctiveness lens
│   ├── enhance.md           # /…:enhance — UX-friction lens
│   ├── recon.md             # /…:recon — Workflow-powered multi-lens audit → unified brief
│   ├── plan.md              # /…:plan — detailed implementation plan(s)
│   ├── execute.md           # /…:execute — implement the plan (TDD + verification)
│   └── deploy.md            # /…:deploy — safe deploy (change-set review, migrations, verify)
├── agents/
│   ├── codebase-analyzer.md # read-only deep analyzer for one focus area (layer / UX flow)
│   ├── ui-auditor.md        # read-only UI-dimension auditor (typography, color, motion, …)
│   ├── frontier-researcher.md # read-only live-web researcher for one angle
│   ├── deploy-validator.md  # read-only subagent that verifies a deploy end-to-end
│   └── security-reviewer.md # read-only subagent that reviews changes for security issues
├── workflows/
│   └── audit.mjs            # recon orchestration script (parallel fan-out → synthesis)
└── hooks/
    ├── hooks.json           # PreToolUse(Bash) → BLOCKING pre-deploy gate (active)
    ├── pre-deploy-gate.sh   # blocks prod-mutating deploys until explicitly approved
    └── pre-deploy-reminder.sh  # non-blocking alternative (swap into hooks.json if preferred)
```

Commands are namespaced once installed: `/altivum-feature-dev-pipeline:ship`, `:eval`, `:improve`, `:improve-ui`, `:improve-x2`, `:enhance`, `:recon`, `:plan`, `:execute`, `:deploy`.

## Install

```bash
claude plugin marketplace add AltivumInc-Admin/claude-plugins-public
claude plugin install altivum-feature-dev-pipeline@altivum
```

To try a local checkout without installing:
```bash
claude --plugin-dir <path-to-this-plugin-dir>
```

> Verify the exact `plugin`/`marketplace` subcommands against your Claude Code version
> (`claude plugin --help`); the manifest schemas here follow the current docs.

## Analysis lenses (front of the pipeline)

All five lenses analyze the codebase and emit prioritized recommendations that feed
`:plan` → `:execute`. Pick the lens that matches the question you're asking:

| Lens | Question it answers |
|------|---------------------|
| `:eval` | Is the house structurally sound? (correctness, architecture, security, maintainability — backed by real lint/types/tests/build output) |
| `:improve` | What bold full-stack moves level it up? (cross-layer, "wow") |
| `:improve-ui` | Does it look and feel crafted? (visual design + modern CSS, before/after code) |
| `:improve-x2` | Is it ahead of the field? (live web research, cites real category leaders) |
| `:enhance` | Where does the existing UX actually hurt users? (code-grounded friction, ranked by impact) |

The heavy lenses optionally fan out **read-only** analysis subagents in parallel
(`codebase-analyzer`, `ui-auditor`, `frontier-researcher`) for depth, and degrade to inline
analysis when subagents aren't available.

### `:recon` — the whole picture at once

`/altivum-feature-dev-pipeline:recon [path] [lenses…]` runs all (or a selected subset of) the
lenses **in parallel** via the Workflow tool, then dedups and ranks every finding into one
unified, prioritized brief that feeds `:plan`. It's intentionally thorough and can spawn many
agents — scope it with a path and/or a lens subset, e.g. `recon src/reports ui improve-x2`.
If the Workflow tool isn't present (older Claude Code / some headless contexts) it falls back to
dispatching the same subagents via the Task tool, then to inline analysis — same unified output.

## Use

```
/altivum-feature-dev-pipeline:ship  add a CSV export to the reports page
```
`ship` runs eval → plan → execute → deploy, stopping for your approval between each
phase. Or run any phase or lens on its own, e.g. `/altivum-feature-dev-pipeline:eval` or
`/altivum-feature-dev-pipeline:recon`.

## Blocking pre-deploy gate

The active hook (`hooks/pre-deploy-gate.sh`) **blocks production-mutating deploy commands**
(`sam deploy`, `cloudformation execute-change-set|deploy|update-stack|delete-stack`,
`amplify start-job`, `cdk deploy|destroy`, `terraform apply|destroy`, `serverless deploy`)
until they're explicitly approved. Safe prep steps (`sam build`/`package`, `create-change-set`,
`describe-*`, dry-runs) are **not** blocked.

To proceed past the gate, confirm with the user, then re-run the **same command prefixed** with
the approval token:
```bash
ALTIVUM_DEPLOY_APPROVED=1 sam deploy ...
```
It's a deliberate-action speed bump (forces an explicit, auditable approval before an
irreversible prod action), not a hard security boundary. Prefer the old non-blocking reminder?
Point `hooks/hooks.json` at `pre-deploy-reminder.sh` instead.

## Read-only analysis & review subagents

All analysis/review subagents are **read-only** — they report findings and never edit code or
infrastructure:
- `codebase-analyzer`, `ui-auditor`, `frontier-researcher` power the analysis lenses (above).
- `security-reviewer` reviews the diff for auth/authz & IDOR, injection, input/upload validation,
  XSS, secrets, IAM least-privilege, SSRF, and token/crypto issues. The `execute` phase invokes
  it for security-sensitive changes; you can also run it ad hoc.
- `deploy-validator` verifies a deploy end-to-end (infra/app status, live endpoints, artifacts,
  migrated data).

## Refine over time

- Edit any `commands/*.md` or `agents/*.md` to improve a phase or lens — they're just prompts.
- Edit `workflows/audit.mjs` to tune the `recon` fan-out (which lenses, which focus areas).
- **Bump `version` in `.claude-plugin/plugin.json`** when you cut a release; reinstall to pick up changes. (This release: `0.3.0` — added the five analysis lenses, three read-only analysis subagents, and the Workflow-powered `recon` audit.)
- Add more automation under `hooks/` and more subagents under `agents/`.

## Going headless (CI)

For unattended runs (e.g. a GitHub Action that runs the pipeline), use the
**Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk` / `pip install claude-agent-sdk`)
and drive the same phases programmatically with permission modes + hooks. This plugin
stays the source of truth for the phase instructions; the SDK script just invokes them.
The five analysis lenses run with the Task/Agent-or-inline pattern (no Workflow dependency);
only `recon` uses the Workflow tool and falls back gracefully where it isn't present.

## Notes baked in
The `deploy` command and `deploy-validator` encode hard-won lessons, e.g.:
- AWS Amplify "Unable to assume specified IAM Role" is usually a lost GitHub App repo
  connection, **not** an IAM problem — reconnect the repo, don't chase the role.
- Use CloudFormation **change sets** + `UsePreviousValue` for NoEcho secrets; review before executing.
- Run data migrations **dry-run before `--apply`**; keep them idempotent.
- Confirm before irreversible/outward-facing production actions, even when broadly authorized.
````

- [ ] **Step 3: Refresh the marketplace description.** In `.claude-plugin/marketplace.json`, replace this exact line:

```
      "description": "eval -> plan -> execute -> deploy feature-development pipeline (/ship orchestrator + phase commands + deploy-validator & security-reviewer subagents + blocking pre-deploy gate)."
```

with:

```
      "description": "eval -> plan -> execute -> deploy feature-development pipeline (/ship orchestrator + phase commands, five analysis lenses [eval/improve/improve-ui/improve-x2/enhance] + Workflow-powered /recon audit, read-only analysis & review subagents, blocking pre-deploy gate)."
```

- [ ] **Step 4: Update the repo-root README.** In `README.md` (repo root), replace this exact table row:

```
| [`altivum-feature-dev-pipeline`](plugins/altivum-feature-dev-pipeline) | 0.2.0 | `eval → plan → execute → deploy` pipeline: a `/ship` orchestrator + phase commands, `deploy-validator` & `security-reviewer` subagents, and a blocking pre-deploy gate. |
```

with:

```
| [`altivum-feature-dev-pipeline`](plugins/altivum-feature-dev-pipeline) | 0.3.0 | `eval → plan → execute → deploy` pipeline: a `/ship` orchestrator + phase commands, five analysis lenses (`eval`/`improve`/`improve-ui`/`improve-x2`/`enhance`) + Workflow-powered `/recon` audit, read-only analysis & review subagents, and a blocking pre-deploy gate. |
```

Then replace this exact repo-layout block:

```
altivum-claude-plugins/
├── .claude-plugin/
│   └── marketplace.json          # lists every plugin (source = subdir path)
└── plugins/
    └── altivum-feature-dev-pipeline/
        ├── .claude-plugin/plugin.json
        ├── commands/  agents/  hooks/  README.md
```

with:

```
altivum-claude-plugins/
├── .claude-plugin/
│   └── marketplace.json          # lists every plugin (source = subdir path)
└── plugins/
    └── altivum-feature-dev-pipeline/
        ├── .claude-plugin/plugin.json
        ├── commands/  agents/  workflows/  hooks/  README.md
```

- [ ] **Step 5: Validate both JSON manifests parse and the version bumped**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
node -e "JSON.parse(require('fs').readFileSync('plugins/altivum-feature-dev-pipeline/.claude-plugin/plugin.json','utf8'));JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8'));console.log('JSON OK')"
grep -q '"version": "0.3.0"' plugins/altivum-feature-dev-pipeline/.claude-plugin/plugin.json && grep -q '0.3.0' README.md && grep -q 'workflows/' README.md && echo "DOCS OK"
```
Expected: `JSON OK` then `DOCS OK`

- [ ] **Step 6: Commit**

```bash
git add plugins/altivum-feature-dev-pipeline/.claude-plugin/plugin.json \
        plugins/altivum-feature-dev-pipeline/README.md \
        .claude-plugin/marketplace.json README.md
git commit -m "docs: document analysis lenses + recon; bump plugin to 0.3.0"
```

---

## Task 13: Whole-marketplace validation & smoke test

**Files:** none (verification only)

- [ ] **Step 1: Validate the marketplace if the Claude CLI is present**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
command -v claude >/dev/null 2>&1 && claude plugin validate . || echo "claude CLI not available — skipping (JSON already validated in Task 12)"
```
Expected: validation success, or the skip message.

- [ ] **Step 2: Confirm the full file inventory exists**

Run:
```bash
cd /Users/cperez/dev/altivum-claude-plugins
ls plugins/altivum-feature-dev-pipeline/commands/{ship,eval,improve,improve-ui,improve-x2,enhance,recon,plan,execute,deploy}.md \
   plugins/altivum-feature-dev-pipeline/agents/{codebase-analyzer,ui-auditor,frontier-researcher,deploy-validator,security-reviewer}.md \
   plugins/altivum-feature-dev-pipeline/workflows/audit.mjs >/dev/null && echo "INVENTORY OK"
```
Expected: `INVENTORY OK`

- [ ] **Step 3: Manual smoke test (human-in-the-loop)**

In a separate terminal, load the plugin against a sample web project and confirm each new front door behaves:
```bash
claude --plugin-dir /Users/cperez/dev/altivum-claude-plugins/plugins/altivum-feature-dev-pipeline
```
Confirm, in that session:
- `/altivum-feature-dev-pipeline:improve` — produces exactly 3 cross-layer recs and ends with the namespaced `:plan` handoff.
- `/altivum-feature-dev-pipeline:improve-ui` — produces 3 recs with before/after code.
- `/altivum-feature-dev-pipeline:enhance` — produces ≤3 file:line-cited UX fixes.
- `/altivum-feature-dev-pipeline:improve-x2` — runs research (or cleanly says it needs web access) and cites URLs.
- `/altivum-feature-dev-pipeline:recon ui enhance` — fans out and returns ONE unified prioritized brief (or falls back cleanly).
- `/altivum-feature-dev-pipeline:eval` — reads as the health/architecture audit, not duplicating `:improve`.

- [ ] **Step 4: No code change to commit.** If the manual smoke test surfaced wording fixes, make them as small follow-up edits + commits; otherwise this task is complete.

---

## Self-review (completed by plan author)

**Spec coverage** — every spec §7 manifest row maps to a task: eval refocus → T4; improve/improve-ui/improve-x2/enhance → T5-T8; recon command → T10; ship edit → T11; codebase-analyzer/ui-auditor/frontier-researcher → T1-T3; audit.mjs → T9; plugin.json + plugin README + marketplace.json → T12. **Added beyond spec for consistency:** repo-root `README.md` (version table + layout tree) in T12, because it pinned `0.2.0` and omitted `workflows/`.

**Placeholder scan** — file contents are complete (no TBD/TODO); the only checkbox lists inside file bodies are the lenses' own "Discipline checks", which are intended content, not plan placeholders.

**Type/name consistency** — namespaced agent ids are identical across the lens commands, `audit.mjs`, and `recon.md` (`altivum-feature-dev-pipeline:codebase-analyzer` / `:ui-auditor` / `:frontier-researcher`); the workflow `meta.phases` titles (`Analyze`, `Synthesize`) match the `phase()` calls; lens command filenames match the names referenced in `ship.md`, the READMEs, and `audit.mjs` `LENS_CONFIG` keys (`eval`, `improve`, `improve-ui`, `improve-x2`, `enhance`).
