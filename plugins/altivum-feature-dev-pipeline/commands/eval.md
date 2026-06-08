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
