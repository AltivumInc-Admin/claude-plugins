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
