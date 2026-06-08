---
description: Generate detailed, actionable implementation plan(s) for selected recommendations or a stated goal.
argument-hint: "[recommendation number(s) like '1 3' or 'all', or a goal]"
---

# Implementation Plan Generator

Generate detailed, executable implementation plan(s) based on **$ARGUMENTS** (numbered recommendations from a prior eval, or a stated goal).

## Parse the request
- A single number -> plan that one. Multiple numbers -> plan each. "all" -> plan all prior recommendations. A goal -> plan that goal.
- If nothing is provided, ask which recommendation(s) to plan.

## For EACH selected item, produce all of these sections (do not skip or abbreviate)

**Objective** — 2-3 sentences: the goal and what changes when done.

**Prerequisites** — tools/packages/services, access/permissions, docs to review, assumptions.

**Step-by-Step Implementation** — granular numbered steps with sub-steps. Include exact commands, config values, behavior to implement (describe behavior, not just "add a function"), and edge cases per step.

**File & Code Changes** — a table: | Action (Create/Modify/Delete) | File Path | Description of Change |. List every file. For a repeated pattern across many files, describe the pattern once and list representative paths.

**Testing & Validation** — unit/integration tests to write (what each covers), manual verification, end-to-end confirmation, and rollback verification.

**Risk & Mitigation** — a table: | Risk | Likelihood | Impact | Mitigation |.

**Dependencies & Order of Operations** — what depends on what, what can parallelize, suggested sequence.

**Estimated Effort** — Complexity (Low/Med/High), time range, count of files affected.

## Quality rules
- Read the relevant files before planning changes to them; respect existing conventions and reuse existing utilities (name them with paths).
- Commands and snippets must be copy-pasteable. Be specific with real file paths, not placeholders.
- Surface any decision only the user can make (trade-offs, scope, security posture).

When planning multiple items, end with a **Mission Brief**: overview, recommended execution order (with reasons), decision points, and combined effort estimate.
