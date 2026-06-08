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
