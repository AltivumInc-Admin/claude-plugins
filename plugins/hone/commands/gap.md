---
description: Run the gap sensors against the project's intent and produce one clause-grouped gap report. Sensors are toggleable (integrity, coherence, finish, friction, + the scout); zero gaps is a valid, successful result.
argument-hint: "[optional path] [sensors: integrity coherence finish friction] [scout]"
---

# /hone:gap — sense the gap

Measure the deviation between the code as it stands and the project's authored intent, and produce ONE clause-grouped gap report. Arguments: **$ARGUMENTS**.

This command recommends nothing of its own. It reads the intent, points sensors at the code, and reports what deviates — including the honest result that nothing does.

## 1. Mount check (the mounting rule)
Read `.altivum/intent.md`. If it does not exist, REFUSE to scan and offer the interview: "No intent is mounted — the sensors have nothing to measure against. Run `/hone:intent` first." Do not fall back to intent-free analysis; that is the failure mode this plugin exists to kill. Keep the intent's full text — every sensor receives it.

## 2. Parse arguments / the sensor toggle
From `$ARGUMENTS`, derive:
- `path` — the first token that looks like a path/area (e.g. `src/reports`), or none (whole repo).
- `sensors` — any of: `integrity`, `coherence`, `finish`, `friction`.
- `scout` — present if the token `scout` appears.

**If no sensor tokens were given**, present the toggle via AskUserQuestion (two questions, one call):
- Q1 "Which sensors?" — multiSelect, all four pre-offered, each option's description is its measure:
  - **integrity** — Does the code soundly do what it claims? Structural fidelity — broken software serves no intent.
  - **coherence** — Does the implementation match the code's own latent design and the intent's shape? New threads match threads already cut.
  - **finish** — Surface quality and craft, measured against what "right" feels like in the intent.
  - **friction** — What users actually hit traversing flows the intent says must be smooth.
- Q2 "Send the scout?" — yes/no. Description: Gathers external evidence; files to the journal as signal, never to the gap report. (The scout is not a sensor — sensors measure gaps, the scout gathers signal; that is why it is its own question.)

If AskUserQuestion is unavailable (headless), default to all four sensors, no scout, and say so.

## 3. Preferred path — Workflow tool
Use the Workflow tool to run the plugin's shipped scan script. `${CLAUDE_PLUGIN_ROOT}` does NOT expand inside command bodies, so:
1. Locate `workflows/gap-scan.mjs` inside this plugin's installed directory — Glob for `**/hone/workflows/gap-scan.mjs`.
2. Read that file and run it inline: `Workflow({ script: <file contents>, args: { path, sensors, scout, intent } })` — `intent` is the full text of `.altivum/intent.md`. Inline `script` is the most robust form.
3. The script fans the gap sensors out per focus area in parallel (plus the scout per angle when requested), enforces the clause-citation rule in synthesis, and returns `{ scope, sensors, report, signal }`. If the result carries an `error` field (intent missing, every sensor failed, or synthesis failure), surface that error verbatim and STOP — never present a degraded scan as a clean one.

## 4. Fallback — no Workflow tool
Dispatch the sensor subagents directly via the Task tool, in parallel, passing each the intent text:
- `integrity`, `coherence` → `hone:codebase-analyzer`, focuses: frontend layer / backend/API layer / data & infrastructure layer (state the sensor's measure in the prompt).
- `friction` → `hone:codebase-analyzer`, focus: "user-flow friction".
- `finish` → `hone:ui-auditor`, dimensions: typography & rhythm, color & contrast, layout & spacing, motion, component-craft & polish.
- scout → `hone:signal-scout`, angles: category movement, user expectations & complaints, emerging platform capabilities.
If subagents are also unavailable, sense inline. Then synthesize yourself per the rules below.

## 5. The gap report (synthesis rules — always enforced, whoever synthesizes)
- **Clause-citation rule:** keep only gaps whose intent-clause citation is specific and honest; stretched/decorative citations are demoted to Signal with a note. When in doubt, demote.
- **Dedup** across sensors; multi-sensor agreement on the same deviation is strong signal — mark it.
- **Group by intent clause** (quote the clause as the heading). Rank by fidelity-gained-per-effort. Number gaps stably (1, 2, 3 …) so `plan 2 4` works.
- Each gap: Title · Clause (quoted) · What deviates & evidence (`file:line`) · Proposed quarter-turn · Turn size (small/medium/large) · Sensor(s).
- Include a brief **Matches** note (where the code already embodies the intent) and a **Signal (not actionable)** section (clause-less findings + scout evidence).
- **Zero is success:** if no honest gaps exist, say exactly "No gaps found against intent at current resolution." and stop. Do not pad.

## 6. Handoff
If run inside `/hone:loop`, return the report to the loop's pick gate. Standalone: end with "Pick gaps to plan: `/hone:plan <numbers>`, then `/hone:execute` — or run `/hone:loop` to hone continuously." Append any scout signal to `.altivum/journal.md` under a dated "Signal" entry (create the file with a `# Hone Journal` heading if absent), and mirror per the vault config (`~/.altivum/hone.json`) if set.
