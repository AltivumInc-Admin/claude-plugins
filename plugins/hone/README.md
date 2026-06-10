# hone

A Claude Code **plugin** for the continuous refinement of software with an author.

> The inventor authors **intent** — what the software is for. Sensors measure the **gap**
> between the code as it stands and that intent. The inventor exercises **taste** over the
> gap report and picks the quarter-turn. The actuator builds it under a hard quality gate
> and ships it. A **journal** remembers every cycle. Signal never creates work; only the
> inventor does. The loop is allowed to find *nothing*.

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

> **Caution: `/hone:loop` merges to your base branch unattended** once you pick gaps and the gate
> goes green. First runs: use `/hone:loop --no-merge` (leaves green PRs open for review)
> or `--confirm-merge`. On a repo with no remote CI, the local gate is the only bar.

## Prerequisites (stated plainly)

| Needed for | Requirement |
|---|---|
| `/hone:loop` quality gate | **Claude-in-Chrome MCP + a browser** — the functional-verifier must OPERATE web changes; without a browser, web changes fail the gate every cycle |
| `/hone:loop` PR/merge | **`gh` CLI authed** with push access to the repo |
| `/hone:gap` + `/hone:loop` engines | **Workflow tool** (current Claude Code). The gap scan degrades to Task-dispatched sensors, then inline; the turn cycle has no fallback |
| `/hone:deploy` | AWS-oriented (assumes **AWS CLI + credentials**); other targets need manual adaptation |
| Obsidian logbook (optional) | An Obsidian vault folder on this machine (asked once by `/hone:intent`) |

## The model

Refinement is impossible without a target — "just right" presupposes a definition of "right."
So everything starts from an **intent** file the inventor authors in the target repo:

```
.altivum/intent.md
├── ## Core        — what this software IS; near-immutable. If it changes, it's a
│                    different product (which is information, not failure).
├── ## Boundaries  — what it deliberately is NOT. The anti-creep fence.
└── ## Living      — dated product decisions, evolved slowly by hand as evidence
                     accrues; each revision carries its "because".
```

**The clause-citation rule:** every gap a sensor reports must cite the specific intent
clause it deviates from. A finding that can't name its clause is *signal*, not a gap — it
routes to the journal, where only the inventor can ever turn it into work (by deliberately
revising the intent). This is the structural anti-creep filter: addition doesn't require
knowing the target; finishing does.

**The mounting rule:** no intent file → `gap`/`loop`/`turn` refuse and offer the interview.
A lathe cannot cut until the work is mounted against a fixed center.

## Commands

| Command | Role |
|---|---|
| `/hone:intent` | Author/view the intent (guided interview); one-time vault setup |
| `/hone:gap [path] [sensors…] [scout]` | Run the sensors → one clause-grouped gap report |
| `/hone:loop [path] [sensors…] [flags]` | The governor loop (pick → build → gate → PR/merge → journal) |
| `/hone:turn <adjustment>` | One inventor-stated adjustment, gated phase-by-phase |
| `/hone:plan` `/hone:execute` `/hone:deploy` | Manual phase tools (advanced) |

### Sensors (toggleable in `/hone:gap` and `/hone:loop`)

| Sensor | Measures |
|---|---|
| `integrity` | Does the code soundly do what it claims? Structural fidelity — broken software serves no intent |
| `coherence` | Does the implementation match the code's own latent design and the intent's shape? New threads match threads already cut |
| `finish` | Surface quality and craft, measured against what "right" feels like in the intent |
| `friction` | What users actually hit traversing flows the intent says must be smooth |
| `scout` *(not a sensor)* | Gathers external evidence — files to the **journal as signal**, never to the gap report |

Run without sensor arguments to get the interactive toggle (each option shows its measure;
the scout is its own yes/no — sensors measure gaps, the scout gathers signal). **Zero gaps
is a valid, successful reading** — there is no quota, and the loop never manufactures work.

### Loop flags

`--auto-pick[=N]` (requires `--max-cycles=N`; picks the **smallest turns first** — unattended
cycles err toward restraint) · `--confirm-merge` · `--no-merge` · `--max-parallel=N` ·
`--max-remediation=N`. Project overrides via `.altivum/hone.json` (check commands,
`functional` config, base branch, merge method).

### The quality gate (all must pass before any PR)

Functional operation by the `functional-verifier` agent (**the critical must-pass** — web via
Claude-in-Chrome, non-web via the real interface; "if the agent can't operate it, a person
can't") · build/lint/typecheck/tests/coverage · `security-reviewer` (no high/critical) ·
adversarial review panel (no confirmed defects) · hygiene. Never opens a PR on a red gate.

## The journal

Every cycle appends to `.altivum/journal.md` (repo-canonical, versioned with the code):
what was sensed, what the inventor picked **and declined**, what shipped, what could not be
closed within the living intent, and any signal gathered. Recurring "could not close" entries
are how pressure on the Core becomes visible — the journal is deliberately *memory without
mechanism*; the outer loop (intent evolution) gets designed later, from this evidence.

Optional **Obsidian logbook**: `/hone:intent` asks once for a vault path (stored in
`~/.altivum/hone.json`, never committed); the loop then mirrors each entry to
`<vault>/Hone/<project>.md` with frontmatter + wikilinks. The repo journal is the loop's
memory; the vault file is the inventor's reading chair.

## What's inside

```
hone/
├── .claude-plugin/plugin.json    # manifest (v0.1.0)
├── commands/                     # intent · gap · loop · turn · plan · execute · deploy
├── agents/                       # codebase-analyzer · ui-auditor · signal-scout (read-only sensors/scout)
│                                 # functional-verifier · security-reviewer · deploy-validator
├── workflows/
│   ├── gap-scan.mjs              # sensor fan-out → clause-grouped synthesis (+ signal routing)
│   └── turn-cycle.mjs            # parallel worktree build → integrate+checks → review panel
└── hooks/                        # PreToolUse(Bash) blocking pre-deploy gate (+ reminder alternative)
```

## Blocking pre-deploy gate

The active hook **blocks production-mutating deploy commands** (`sam deploy`,
`cloudformation execute-change-set|deploy|update-stack|delete-stack`, `amplify start-job`,
`cdk deploy|destroy`, `terraform apply|destroy`, `serverless deploy`) until explicitly
approved — confirm with the user, then re-run the same command prefixed with
`HONE_DEPLOY_APPROVED=1`. Safe prep steps (build/package/create-change-set/describe/dry-run)
pass through. Note the hook registers on **every** Bash call (cheap; it only blocks on the
deploy regex) — swap `hooks/hooks.json` to `pre-deploy-reminder.sh` for non-blocking.

## Relationship to altivum-feature-dev-pipeline

`hone` supersedes it: same actuator machinery (worktree builds, review panel, functional
gate, auto-PR/merge, deploy safety), rebuilt around intent. Install one or the other, not
both — they carry opposite philosophies (lenses propose additions; sensors measure gaps).

## Refine over time

Commands/agents are prompts — edit them. Bump `version` in `.claude-plugin/plugin.json` to
release (this release: `0.1.0` — first cut of the intent-anchored loop). The plugin's own
intent lives at the repo root's `.altivum/intent.md`: hone hones itself.
