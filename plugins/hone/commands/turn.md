---
description: One inventor-initiated adjustment, run through the gated pipeline (plan -> execute -> verify -> deploy) with a human approval gate between every phase. Intent-aware — a clause-less request reminds, never blocks.
argument-hint: "[the adjustment to make, e.g. 'tighten the empty state on /reports']"
---

# /hone:turn — the inventor's direct door

Give the screw one deliberate quarter-turn: **$ARGUMENTS**

Work originates two ways in hone: from the gap report via the pick (`/hone:loop`), or here — the inventor's taste in the moment. This command runs the stated adjustment through the gated pipeline, stopping for explicit approval between every phase. Never auto-advance past a gate.

## 0. MOUNT + the clause check (remind, never block)
Read `.altivum/intent.md`. Missing → STOP and offer `/hone:intent` (the mounting rule).
Then check the requested adjustment against the intent **before any work**: which clause does it serve?
- Serves a clause → name it, and carry it through the plan.
- **No clause obviously fits** → say exactly this, then proceed: "This doesn't cite a clause in your intent; proceeding, since you're the governor — consider whether the Living stratum should record why." The system never overrules the inventor; it makes drift visible at the moment it is caused. Record the reminder for the journal entry (step 4).

## Sequence (apply the phase commands' own instructions)
1. **PLAN** — produce the implementation plan per `/hone:plan` (objective, steps, file changes, tests, risks, effort), with the served clause (or the clause-less reminder) stated in the objective. Surface any decisions only the user can make.
   - **GATE:** get plan approval and resolve open decisions. Wait.
2. **EXECUTE** — implement per `/hone:execute`: TDD, keep lint/types/tests/build green continuously with real output, security-reviewer (`hone:security-reviewer`) on security-sensitive diffs, feature branch if the repo uses them.
   - **GATE:** present the diff/verification summary. Get approval to proceed. Wait.
3. **VERIFY** — dispatch `hone:functional-verifier` to actually OPERATE the change (web via Claude-in-Chrome; non-web via its real interface). Require OPERATED (or a justified N/A for genuinely non-operable changes).
   - **GATE:** present the verdict + evidence. Get approval to deploy (or to stop here with a PR). Wait.
4. **DEPLOY** — per `/hone:deploy`: feasibility first, reviewable/reversible mechanisms, dry-run migrations, confirm at the point of no return, verify live. Finish with a debrief AND append a journal entry to `.altivum/journal.md` (and the vault mirror per `~/.altivum/hone.json`):

       ## Turn — <date> (inventor-initiated; intent as of <date of newest Living revision>)
       Adjustment: <the request>
       Clause: <clause served, or "none cited — reminder issued">
       Shipped: <PR/commit/deploy refs>

   (Dates via `date +%Y-%m-%d`, never guessed.)

## Operating principles (apply throughout)
- **Evidence before assertions.** Run the actual checks and quote the output; say so when something failed or was skipped.
- **Confirm irreversible/outward-facing prod actions** at the point of no return.
- **Never fabricate secrets** — read existing values, `UsePreviousValue` for NoEcho params, ask when blocked.
- **Stay faithful to gate decisions; don't silently expand scope** — this command exists for ONE adjustment. If the work reveals a second adjustment, journal it as signal; don't absorb it.

If the user passed a single phase name (e.g. "just plan"), run only that phase. For discovery-driven continuous improvement, use `/hone:loop`.
