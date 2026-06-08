---
description: UX-friction lens — traces real user flows and proposes up to 3 code-grounded fixes for the friction users actually hit, ranked by impact.
argument-hint: "[optional flow/area to scope, e.g. 'checkout' or 'auth']"
---

# /enhance — UX-friction lens

Scan the frontend and backend to find where the existing user experience actually hurts, and propose up to 3 concrete, code-grounded fixes ranked by user impact. Every recommendation must reference specific files/patterns — no generic advice. Scope to **$ARGUMENTS** if provided.

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
