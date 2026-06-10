# hone

**A Claude Code plugin for the continuous refinement of software with an author.**

> The inventor authors **intent** — what the software is for. Sensors measure the **gap**
> between the code as it stands and that intent. The inventor exercises **taste** over the
> gap report and picks the quarter-turn. The actuator builds it under a hard quality gate
> and ships it. A **journal** remembers every cycle. Signal never creates work; only the
> inventor does. The loop is allowed to find *nothing*.

Everything in this plugin serves that paragraph.

---

## Why hone exists

Most improvement tooling answers the question *"what could this become?"* — more capability,
more novelty, catch up to the category leaders. That stance is **divergence**: generative,
additive, outward-looking. It is the right stance exactly once, at the beginning.

Refinement is the opposite stance. It asks *"what is this trying to be, and where does it
fall short of that?"* — remove friction, raise fidelity, sculpt the details. Give the screw
a quarter-turn to get it just right, and know that over-turning strips the thread.

The catch: **refinement is impossible without a target.** "Just right" presupposes a
definition of "right." A tool that analyzes code in a vacuum will structurally drift toward
feature-adding, because addition is the only move that needs no north star — you can always
bolt on another capability without understanding the whole, but you cannot sculpt toward a
form you haven't named, or know when to stop turning the screw.

So everything in hone starts from an **intent** — a short, inventor-authored statement of
what the software is for — and every piece of machinery is wired so that nothing can become
work without passing through it.

### Feature creep is a wiring problem

Creep is not a discipline failure; it is what happens when external signal — market trends,
user requests, a reviewer's enthusiasm — flows into build actions without passing through
the author's judgment. hone fixes this in the wiring, not in the exhortations. The four
sources of "right" each get a distinct role and a distinct authority:

| Source | Role | Tempo / authority |
|---|---|---|
| The inventor's intent | **Setpoint** — where the software is supposed to go | Slow-moving, high-authority, normative |
| The code's design | **Sensor reading** — where we actually are | Real-time, factual |
| Users / the market | **Environmental signal** — what the world needs and rewards | Noisy, external; **never actuates work directly** |
| The inventor's taste | **Governor** — the in-the-moment tiebreaker | Instantaneous, human, highest authority |

Work can originate in exactly **two ways**, and only two:

1. **From the gap report, via the inventor's pick** — sensor-driven, intent-anchored
   (`/hone:loop`).
2. **From the inventor directly** — taste in the moment (`/hone:turn`).

Signal — what a scout finds on the web, what a sensor notices that serves no intent clause —
can reach only the **journal** (as evidence) and the **inventor** (who may, deliberately and
by hand, evolve the intent). It can never spawn a work item. That single routing rule is the
difference between a refinement loop and a feature factory.

---

## Quickstart

```bash
claude plugin marketplace add AltivumInc-Admin/claude-plugins-public
claude plugin install hone@altivum
```

(Or try a local checkout without installing: `claude --plugin-dir <path-to-plugins/hone>`.)

Then, in the project you want to hone:

```
/hone:intent     # mount the work: author what this software is FOR (one-time interview)
/hone:gap        # sense: measure the code against the intent (zero gaps is success)
/hone:loop       # hone: pick gaps, agents build, gate, auto-PR/auto-merge, journal, repeat
```

> **Caution: `/hone:loop` merges to your base branch unattended** once you pick gaps and the
> gate goes green. First runs: use `/hone:loop --no-merge` (leaves green PRs open for review)
> or `--confirm-merge`. On a repo with no remote CI, the local gate is the only bar.

---

## The intent primitive

Refinement's fixed center. `/hone:intent` interviews you — one question at a time, pushing
for concrete, testable language ("checkout completes in under 10 seconds," not "fast and
delightful") — and writes `.altivum/intent.md` in the target repo:

```
.altivum/intent.md
├── ## Core        — what this software IS; near-immutable. If this changes, it's a
│                    different product — which is information, not failure: it means the
│                    original idea was not good enough or the problem was not real.
├── ## Boundaries  — what it deliberately is NOT. The explicit anti-creep fence.
└── ## Living      — dated product decisions, evolved slowly BY HAND as evidence accrues;
                     each revision carries a one-line "because" naming what earned it.
```

Three rules give the intent its teeth:

**The mounting rule.** No intent file → `gap`, `loop`, and `turn` refuse to run and offer
the interview. A lathe cannot cut until the work is mounted against a fixed center.
Intent-free analysis is the failure mode this plugin exists to kill.

**The clause-citation rule** — the structural anti-creep filter. Every gap a sensor reports
must cite the *specific intent clause* it deviates from. A finding that cannot name its
clause is, by construction, not a gap: it is **signal**, and it routes to the journal where
only the inventor can ever turn it into work. Stretched or decorative citations are demoted
during synthesis. "Users might like X" never becomes a work item on its own.

**No revision mechanism.** The Living stratum is edited by hand, deliberately, with dated
entries. High friction *is* the design — the intent is a low-pass filter between a noisy
world and an expensive codebase. Because the setpoint moves slowly, the code never whipsaws,
and refinement stays cheap. How the intent should evolve over time (and how the system
should signal "this pressure has reached the Core — pivot-or-kill conversation, not a
quarter-turn") is deliberately **unbuilt**: that outer loop will be designed later, from
journal evidence. Memory now, mechanism later.

---

## Commands

Seven, arranged as a hierarchy rather than a pile:

| Command | Role |
|---|---|
| `/hone:intent` | Author/view the intent (guided interview); one-time Obsidian vault setup |
| `/hone:gap [path] [sensors…] [scout]` | Run the sensors → one clause-grouped gap report |
| `/hone:loop [path] [sensors…] [flags]` | The governor loop: pick → parallel build → gate → auto-PR/merge → journal |
| `/hone:turn <adjustment>` | One inventor-stated adjustment, gated phase-by-phase |
| `/hone:plan` `/hone:execute` `/hone:deploy` | Manual phase tools (advanced) |

`/hone:turn` is the second door for work. It reminds — never blocks — when your requested
adjustment doesn't cite an intent clause: *"proceeding, since you're the governor — consider
whether the Living stratum should record why."* The system never overrules the inventor; it
makes drift visible at the moment it is caused, and journals it.

---

## The sensors

Four measurement dimensions and one scout. Run `/hone:gap` without sensor arguments to get
the interactive toggle — each option displays its measure; the scout is deliberately a
separate yes/no question, because the toggle should teach the distinction every time you
use it: **sensors measure gaps; the scout gathers signal.**

| Sensor | Measures |
|---|---|
| `integrity` | Does the code soundly do what it claims? Structural fidelity — broken software serves no intent |
| `coherence` | Does the implementation match the code's own latent design and the intent's shape? New threads match threads already cut |
| `finish` | Surface quality and craft, measured against what "right" feels like in the intent |
| `friction` | What users actually hit traversing flows the intent says must be smooth |
| `scout` *(not a sensor)* | Gathers external evidence — files to the **journal as signal**, never to the gap report |

Sensor discipline, with no exceptions:

- Every sensor reads the intent **first** and must cite a clause for every gap.
- **Zero is a valid reading.** "No gaps found against intent at current resolution." is a
  successful scan, not a failed one. There is no quota, and the loop never manufactures
  work to appear productive.
- The gap report groups gaps **by intent clause**, ranks by fidelity-gained-per-effort,
  numbers them stably (so `plan 2 4` works), notes where the code already *matches* the
  intent, and ends with a "Signal (not actionable)" section for everything clause-less.
- A degraded scan — sensors failed, synthesis failed, intent missing — returns a distinct
  **error**, never the clean-reading sentence. A failed scan is not a clean repo.

The scout is the embryo of a future research function. Its discipline is its job
description: cited, live-web evidence only — observations with sources and strength
ratings — and a hard prohibition on producing recommendations, proposals, or anything
phrased as something to build. The journal remembers; the inventor decides.

---

## Anatomy of a loop cycle

`/hone:loop` runs the control loop end to end. One cycle:

```
MOUNT    intent exists · clean tree · gh authed · base current · config loaded
SENSE    gap scan (parallel sensor fan-out via the Workflow engine)
PICK     the governor gate — the ONE routine stop. Numbers take gaps;
         "none" declines everything (a first-class outcome, journaled as
         taste-data); "done" exits.
TURN     picked gaps build IN PARALLEL — each in its own git worktree on its
         own branch, TDD-first — then integrate onto the cycle branch with
         build/lint/typecheck/test/coverage checks and an adversarial review
         panel with independent verification of every high/critical finding
GATE     all of: something actually shipped · functional-verifier OPERATED
         the change (web via Claude-in-Chrome; non-web via its real
         interface — "if the agent can't operate it, a person can't") ·
         checks pass · security review clean of high/critical · no confirmed
         review defects · hygiene. Bounded autonomous remediation; a culprit
         gap gets dropped and the cycle rebuilt rather than shipped broken.
         NEVER opens a PR on a red gate.
PR/MERGE push · gh pr create · wait for remote checks · auto-merge (squash)
RECORD   journal entry — repo canonical + optional Obsidian vault mirror
LOOP     re-scan the now-improved base
```

### Modes

| Mode | Invocation | Behavior |
|---|---|---|
| **Review-first** (recommended first) | `--no-merge` | Leaves each green PR open; nothing lands without your merge |
| **Supervised** | `--confirm-merge` | One extra stop to confirm each merge |
| **Default** | *(none)* | Auto-merges on green after your pick |
| **Unattended** | `--auto-pick[=N] --max-cycles=N` | No pick stop — **requires** a cycle bound, and picks the **smallest turns first**: when no taste is present, the loop errs toward restraint. The clause-citation rule means even auto-picked work is intent-legitimized |

Other flags: `--max-parallel=N` (build concurrency), `--max-remediation=N` (per-phase fix
attempts, default 2). Exception stops — mount failure, nothing shipped, gate can't reach
green, remote CI stays red, unresolvable conflict — are the only halts outside the pick.

---

## The journal and the Obsidian logbook

Every cycle appends to `.altivum/journal.md` (repo-canonical, versioned with the code):

```markdown
## Cycle 14 — 2026-06-10 (intent as of 2026-05-30)
Sensed: 3 gaps (friction ×2 → "checkout under 10s", finish ×1 → "calm surface")
Picked: friction #1. Declined: friction #2 (too large for now), finish #1 (disagree)
Shipped: PR #87 (merged)
Could not close: —
Signal: scout noted competitors moving to passkeys (no clause; filed, not actioned)
```

What you picked **and what you declined** are both recorded — taste is data. Recurring
"could not close within the living intent" entries are how pressure on the Core becomes
visible over time; the journal deliberately attaches **no mechanism** to that pattern. It
is the empirical dataset from which the outer loop (intent evolution, pivot-or-kill
signals) and the research function will eventually be designed — and not before.

**The Obsidian mirror.** An Obsidian vault is just a folder of plain-text files, so the
loop writes it directly: `/hone:intent` asks once for a vault path (stored per-user in
`~/.altivum/hone.json`, never committed — your vault is a fact about your machine, not the
repo), then every entry mirrors to `<vault>/Hone/<project>.md` with YAML frontmatter
(`project`, `cycle`, `date`, `tags: [hone]`) and wikilinks, with a collision guard so two
same-named projects never clobber each other. The repo journal is the loop's *memory*; the
vault file is the inventor's *reading chair*. A missing vault skips with a note — the
logbook never fails a cycle.

---

## Configuration reference

| File | Scope | Holds |
|---|---|---|
| `.altivum/intent.md` | per-project, committed | The north star: Core / Boundaries / Living |
| `.altivum/journal.md` | per-project, committed | Cycle and turn entries; signal |
| `.altivum/hone.json` | per-project, committed | Overrides: check commands, `functional` config (dev-server command, URL, flow), base branch, merge method |
| `~/.altivum/hone.json` | per-user, never committed | Obsidian vault path (`{ "vault": "/abs/path" }` or `{ "vault": null }`) |

When `.altivum/hone.json` is absent, the loop auto-detects build/lint/typecheck/test/
coverage from `package.json` scripts or a Makefile; anything expected-but-unrunnable is a
gate **fail**, never a silent skip.

---

## Prerequisites (stated plainly)

| Needed for | Requirement |
|---|---|
| `/hone:loop` quality gate | **Claude-in-Chrome MCP + a browser** — the functional-verifier must OPERATE web changes; without a browser, web changes fail the gate every cycle |
| `/hone:loop` PR/merge | **`gh` CLI authed** with push access to the repo |
| `/hone:gap` + `/hone:loop` engines | **Workflow tool** (current Claude Code). The gap scan degrades to Task-dispatched sensors, then inline; the turn cycle has no fallback |
| `/hone:deploy` | AWS-oriented (assumes **AWS CLI + credentials**); other targets need manual adaptation |
| Obsidian logbook (optional) | An Obsidian vault folder on this machine (asked once by `/hone:intent`) |

---

## The blocking pre-deploy gate

A `PreToolUse(Bash)` hook **blocks production-mutating deploy commands** until explicitly
approved: `sam deploy`, `cloudformation execute-change-set|deploy|update-stack|delete-stack`,
`amplify start-job`, `cdk deploy|destroy`, `terraform apply|destroy`, `serverless deploy`.
Safe prep steps (build/package/create-change-set/describe/dry-run) pass through untouched.

To proceed, confirm with the user, then re-run the **same command prefixed** with the
approval token:

```bash
HONE_DEPLOY_APPROVED=1 sam deploy ...
```

It is a deliberate-action speed bump — an explicit, auditable approval before an
irreversible production action — not a hard security boundary. Note the hook registers on
**every** Bash call (cheap; it only blocks on the deploy regex); swap `hooks/hooks.json` to
`pre-deploy-reminder.sh` for a non-blocking variant.

---

## What's inside

```
hone/
├── .claude-plugin/plugin.json    # manifest (v0.1.0)
├── commands/                     # intent · gap · loop · turn · plan · execute · deploy
├── agents/                       # codebase-analyzer · ui-auditor · signal-scout
│                                 #   (read-only sensors/scout — intent in, clause-cited gaps out)
│                                 # functional-verifier · security-reviewer · deploy-validator
│                                 #   (the gate: operates the change, reviews the diff, verifies the deploy)
├── workflows/
│   ├── gap-scan.mjs              # sensor fan-out → clause-grouped synthesis (+ signal routing)
│   └── turn-cycle.mjs            # parallel worktree build → integrate + checks → review panel
└── hooks/                        # PreToolUse(Bash) blocking pre-deploy gate (+ reminder alternative)
```

All six agents are read-only with respect to source code. The build/review machinery runs
in isolated git worktrees; every degraded state in both workflows returns a distinct error
rather than impersonating success.

---

## Lineage

`hone` supersedes `altivum-feature-dev-pipeline` (0.4.0). Same proven actuator — parallel
worktree builds, adversarial review with verification, live functional operation, auto-PR/
auto-merge, deploy safety rails — rebuilt around an intent. What changed is the stance:

| | feature-dev-pipeline | hone |
|---|---|---|
| Question | What could this become? | What is this trying to be, and where does it fall short? |
| Analysis | Five lenses with addition quotas (three demand exactly 3 proposals; eval 2-4) | Four sensors, each **allowed** to find nothing |
| Target | None — code analyzed in a vacuum | The intent; every gap cites its clause |
| Market input | Researched trends became recommendations | Scout evidence goes to the journal; only the inventor turns signal into work |
| Output vocabulary | Moves, upgrades, bold bets | Gap, drift, fidelity, quarter-turn |

Install one or the other, not both — they carry opposite philosophies, and a session that
can both "propose bold moves" and "measure deviation from intent" has no philosophy at all.

## Refine over time

Commands and agents are prompts — edit them. Workflows are scripts — tune them. Bump
`version` in `.claude-plugin/plugin.json` to release (this release: `0.1.0` — first cut of
the intent-anchored loop). While developing locally, `claude --plugin-dir` plus the
`/reload-plugins` command give a zero-reinstall edit loop.

The plugin's own intent lives at the repo root's `.altivum/intent.md`: **hone hones
itself.** Its journal's first entry is its own birth.
