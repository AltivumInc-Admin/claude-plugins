---
description: Author or view the project's intent — the north star the whole loop measures against. Guided interview writes .altivum/intent.md (Core / Boundaries / Living); also handles one-time Obsidian vault setup.
argument-hint: "[blank to author or view; 'show' to display only]"
---

# /hone:intent — mount the work

The intent is the fixed center the lathe cuts against: the inventor-authored definition of what this software is *for*. Every sensor measures deviation from it; every gap must cite one of its clauses. Without it, no honing command will run.

Arguments: **$ARGUMENTS**

## If `.altivum/intent.md` exists
- `show` (or no arguments): display the current intent verbatim, note the date of its newest Living revision, and stop.
- If the user asked to change it: do NOT edit it for them wholesale. Display it, remind them the Living stratum is edited **by hand, deliberately** (each revision dated, with a one-line "because" naming the evidence that earned it) and that the Core is near-immutable — if the Core must change, that is a pivot-or-kill conversation, not an edit. Offer to open the file for them to edit; you may help with wording they dictate, but the convictions must be theirs.

## Before the interview — know the codebase first
An interviewer who has not read the code asks blind questions. Before asking the inventor anything: assess whether you already have real context on this codebase (from the current session or project memory). If you do not, SAY SO and execute a THOROUGH review — not a cursory skim:
- Read the README, manifests, configs, and entry points; map the directory structure and the main components.
- Trace the primary user/data flows end to end; identify the stack, the build/test workflow, and what the software observably DOES.
- For a non-trivial codebase, dispatch `hone:codebase-analyzer` subagents in parallel (one per layer: frontend / backend-API / data & infrastructure) and synthesize their findings into your working picture.
The review grounds the interview — sharper questions, evidence-backed follow-ups ("I see X in src/y — is that part of right?"), and draft language that names real things. It must NOT author the intent: understanding is yours; convictions are the inventor's. Never skip the interview because the review made you confident.

## If `.altivum/intent.md` does not exist — the interview
Conduct a guided interview, ONE question at a time (use the AskUserQuestion picker where options fit, free text otherwise). Push for **concrete, testable language** — "checkout completes in under 10 seconds," not "fast and delightful." Vague intent produces unfalsifiable clause citations and ruins the loop downstream.

Ask, in order:
1. **Purpose** — What is this software, in one or two sentences? What job does it do, for whom?
2. **The feel of right** — When this software is *just right*, what does that feel like to its user? What would they say about it?
3. **Boundaries** — Name 2-5 things this software deliberately is NOT and will not do. (This is the anti-creep fence; press for real refusals, not platitudes.)
4. **Current understanding** — What product decisions follow from the core today? (These seed the Living stratum.)

Then draft `.altivum/intent.md` in exactly this structure and show it to the user for editing — iterate until they say it is theirs, then write it and ask them to commit it:

    # Intent

    ## Core
    <purpose + the feel of right — near-immutable. If this changes, it is a
    different product; that is information, not failure.>

    ## Boundaries
    <the deliberate NOTs>

    ## Living
    <dated entries; newest first. Each: a product-decision statement and a
    one-line "because" naming the evidence that earned it.>
    - <today's date>: <initial understanding>. Because: initial authoring.

## One-time logbook setup (after the interview, or on first run)
If `~/.altivum/hone.json` does not exist, ask ONE question: "Mirror the hone journal to an Obsidian vault? If yes, give the vault's absolute path; if no, the journal lives only in the repo." On a path: validate the vault directory exists, then create the config dir and write the file (`mkdir -p ~/.altivum` first — the directory will not exist on a fresh machine):

    { "vault": "/absolute/path/to/vault" }

On "no": write `{ "vault": null }` (same `mkdir -p ~/.altivum` first) so the question is never re-asked. The vault path is a fact about this machine — never commit it to the repo.

## Rules
- Dates are real: obtain today's date with `date +%Y-%m-%d` (Bash) whenever you draft or display dated entries — never guess it.
- The inventor owns every word of the intent. You interview, draft, and transcribe — you do not decide.
- Never auto-revise the intent from sensor findings, signal, or your own judgment. Signal never creates work, and it never edits intent either — only the inventor does, by hand.
- Keep the file short enough to read in one sitting. An intent nobody re-reads anchors nothing.
