# Design: `hone` — Intent-Anchored Refinement Loop

- **Date:** 2026-06-09
- **Status:** Approved (ready for implementation plan)
- **Author:** Christian Perez (Altivum Inc.)
- **Plugin:** `plugins/hone` *(new — supersedes `plugins/altivum-feature-dev-pipeline` 0.4.0)*
- **Builds on:** the lenses/recon machinery (0.3.0) and the `:refine` loop + quality gate (0.4.0)
  (`docs/superpowers/specs/2026-06-08-analysis-lenses-design.md`,
  `docs/superpowers/specs/2026-06-08-refine-loop-design.md`).

## 1. Context & problem

The plugin's purpose is **continuous improvement of the software** — honing in on what the
software is built to do, adding finesse, sculpting details: metaphorically, giving a screw a
quarter-turn to get it just right.

The 0.4.0 plugin is excellent machinery pointed the wrong way: a **divergence engine wearing a
refinement name**. Its fuel is the `improve` family — "bold moves," "upgrades," "category
leaders," "emerging capabilities" — the vocabulary of *more*, not *right*. The "exactly 3
recommendations" rule is an **addition quota**: it forces the system to manufacture things to add
even when the honest finding is "this is already good." And the deepest defect: the plugin has
**no representation of what the software is for**. Refinement is impossible without a target —
"just right" presupposes a definition of "right." Addition doesn't require knowing the target;
finishing does. A system that analyzes code in a vacuum will structurally drift toward
feature-adding, because that is the only move that needs no north star.

`hone` rebuilds the plugin **in place** (Approach A — the language *is* the disease; building
alongside or seeding minimally would leave it in the body) as a true refinement loop.

## 2. The control model

One paragraph that everything else serves:

> The inventor authors **intent** — what the software is for. Sensors measure the **gap** between
> the code as it stands and that intent. The inventor exercises **taste** over the gap report and
> picks the quarter-turn. The actuator builds it under a hard quality gate and ships it. A
> **journal** remembers every cycle. Signal never creates work; only the inventor does. The loop
> is allowed to find *nothing*.

The four sources of "right," each with a distinct role and tempo:

| Source | Role | Tempo / authority |
|---|---|---|
| Inventor's intent | **Setpoint** — where the software is supposed to go | Slow-moving, high-authority, normative |
| The code's design | **Sensor reading** — where we actually are | Real-time, factual |
| Users / market | **Environmental signal** — what the world needs/rewards | Noisy, medium-tempo, external; *never actuates work directly* |
| Inventor's taste | **Governor** — the in-the-moment tiebreaker | Instantaneous, human, highest authority |

**Feature creep is a wiring problem, not a content problem:** it is what happens when the
environmental signal flows into build actions without passing through the governor. In `hone`,
market/user signal can only reach the **journal** (as evidence) and the **inventor** (who may,
deliberately and by hand, evolve the intent). It can never spawn a work item.

**Two doors for work, and only two:**
1. From the gap report, via the inventor's pick (sensor-driven, intent-anchored).
2. From the inventor directly (`/hone:turn` — taste in the moment).

**The outer loop is deliberately unbuilt.** How the living intent evolves (ritual vs.
threshold), and how the system signals "this pressure has reached the core," are designed *later,
from journal evidence* — you cannot design an alarm for a pressure you have never felt. The inner
loop ships **memory now, mechanism later**: the journal records what could not be closed within
the living intent; core-pressure emerges as a visible pattern long before it needs machinery.

## 3. Goals / non-goals

**Goals**
- An **intent primitive** the whole plugin reads: authored by the inventor, stratified by
  mutability, living in the target repo.
- Sensors that measure **deviation from intent** — allowed to report zero — replacing lenses
  with addition quotas.
- The **clause-citation rule** as the structural anti-creep filter (§4).
- A governor loop (`/hone:loop`) and a direct-adjustment path (`/hone:turn`), both reusing the
  0.4.0 actuator (parallel worktree builds, TDD, adversarial review, functional operation gate,
  auto-PR/auto-merge) nearly untouched.
- A **journal** (repo-canonical) with an **Obsidian logbook mirror** (per-user vault).
- A command surface of **7** (down from 11), hierarchical, in convergence vocabulary.

**Non-goals**
- **No outer loop**: no mechanism for evolving the intent, no thresholds, no escalation
  machinery. The intent is hand-edited; the journal is the only concession (memory).
- **No research agent**: the `signal-scout` is its embryo (evidence-gathering only), not the
  build.
- Not changing the actuator's quality bar, the pre-deploy hook's behavior, or the
  command/Workflow split proven in 0.4.0.

## 4. The intent primitive

**Location:** `.altivum/intent.md` in the **target repo** (the software being honed, not the
plugin). Markdown: inventor-authored prose that should read well in diffs and PRs. Follows the
existing `.altivum/` convention.

**Structure — three strata:**

```markdown
# Intent

## Core
What this software is, who it serves, what "right" feels like.
Near-immutable. If this changes, it's a different product — which is
information, not failure: it means the original idea was not good enough
or the problem was not real.

## Boundaries
What this software deliberately is NOT and will not do.
The explicit anti-creep fence.

## Living
Current understanding of how the core translates into product decisions.
Evolves slowly, by hand, as evidence accrues. Each revision dated, with a
one-line "because" — the evidence that earned the change.
```

**Authoring:** `/hone:intent` — a guided interview (purpose, audience, what just-right means,
named non-goals) that drafts the file; the inventor edits until it is theirs; commit. The command
also displays the current intent. **There is no revision mechanism** — the living layer is edited
by hand, deliberately; high friction is the design.

**The mounting rule:** if any honing command runs and no intent file exists, it **refuses and
offers the interview**. A lathe cannot cut until the work is mounted against a fixed center.
Intent-free analysis is the failure mode this plugin exists to kill.

**The clause-citation rule (structural anti-creep filter):** every gap a sensor reports **must
cite the specific intent clause it deviates from**. A finding that cannot name its clause is
discarded before the inventor ever sees it. "Users might like X" with no clause behind it is, by
construction, not a gap — it is *signal*, and it routes to the journal, not the gap report.

## 5. The sensor — `/hone:gap [path] [sensors…]`

The five lenses and `recon` collapse into **one command** with four sensor dimensions and one
scout. "Run one lens alone" survives as an argument.

| Was (0.4.0) | Becomes | Measures |
|---|---|---|
| `eval` | **integrity** | Does the code soundly do what it claims? Structural fidelity — broken software serves no intent |
| `improve` | **coherence** | Does the implementation match the code's own latent design and the intent's shape? New threads match threads already cut |
| `improve-ui` | **finish** | Surface quality and craft, measured against what "right" feels like in the intent |
| `enhance` | **friction** | What users actually hit traversing flows the intent says must be smooth |
| `improve-x2` | **scout** *(not a sensor)* | Gathers external evidence — files it to the journal as **signal**, never to the gap report |

**Sensor discipline (replaces the quotas):**
- Every sensor reads `.altivum/intent.md` first; every gap must cite its clause (§4).
- **Zero is a valid reading.** "No gaps found at current resolution" is a successful scan.
- Anything sensed without a clause routes to the journal as signal, summarized at the report's
  bottom under "Signal (not actionable)."

**The toggle UX:** when invoked **without explicit sensors as arguments**, the command presents
the harness's interactive picker (`AskUserQuestion`):
- Question 1 (multi-select, 4 options): the four sensors, each option's description = its
  "Measures" line above.
- Question 2 (yes/no): "Send the scout?" — its description states the signal-not-work rule.

The picker's 4-options-per-question cap maps exactly onto the design: sensors and the scout are
different kinds, and the UI teaches that distinction on every use. Explicit args skip the toggle.

**The gap report** (replaces the recon brief): gaps grouped **by intent clause**, each with
evidence (`file:line`), the proposed quarter-turn, and turn size (effort). Ranked by
fidelity-gained-per-effort. Ends with numbered picks or the honest sentence "nothing else found."

**Machinery:** `audit.mjs` → `workflows/gap-scan.mjs` — same parallel fan-out + synthesis,
re-anchored: agents receive the intent text + clause-citation instruction; synthesis groups by
clause, dedups across sensors (multi-sensor agreement = strong signal), routes clause-less
findings to the signal section. `codebase-analyzer` and `ui-auditor` survive re-prompted (the
quotas lived in the commands, not the agents). `frontier-researcher` → `signal-scout` (rewritten
mission: evidence only, no recommendations). All agents stay read-only.

## 6. The loop — `/hone:loop [path] [sensors…] [flags]`

The `:refine` successor. One cycle:

1. **MOUNT** — intent exists (else refuse + offer interview); clean tree; `gh auth status`; base
   branch current.
2. **SENSE** — run the gap scan (§5; toggle if no sensors given).
3. **✋ PICK — the governor gate (the one routine stop).** Gaps presented grouped by clause; the
   inventor exercises taste. **Declining everything is a first-class outcome** — journaled as
   "gaps presented, none chosen" (taste-data).
4. **TURN** — the 0.4.0 actuator, nearly untouched: parallel worktree builds (TDD), integrate +
   automated checks, adversarial review panel + verification, `functional-verifier` must
   **operate** the change, security review, hygiene; auto-PR; wait green; auto-merge.
5. **RECORD** — append the journal entry (repo + vault mirror, §7).
6. **LOOP** — re-scan the merged result → next cycle.

**Flags** carry over from `:refine` (`--max-cycles`, `--confirm-merge`, `--no-merge`,
`--max-parallel`, `--max-remediation`) with **one deliberate change**: `--auto-pick[=N]` survives
(still requiring `--max-cycles`) but its bias **inverts** — it picks **smallest-turn-first**, not
highest-impact-first. Unattended cycles take the most conservative quarter-turns available. This
is defensible now in a way it was not before: the clause-citation rule means every pickable gap is
already intent-legitimized, so auto-pick cannot smuggle creep — but when no taste is present, the
loop errs toward restraint.

Exception stops, remediation bounds, and PR/merge mechanics are unchanged from the 0.4.0 spec
(§§3–4, 6 of `2026-06-08-refine-loop-design.md`).

## 7. The journal & the Obsidian logbook

**Canonical journal:** `.altivum/journal.md` in the target repo — append-only, one entry per
cycle, **written by the `loop` and `turn` commands** (agents stay read-only; `/hone:turn`
appends its own entry, including any clause-less-work reminder it issued, §8). Versioned with the code;
machine-readable memory the future outer loop and research agent will be designed from.

Entry shape:

```markdown
## Cycle 14 — 2026-06-09 (intent as of 2026-05-30)
Sensed: 3 gaps (friction ×2 → "checkout under 10s", finish ×1 → "calm surface")
Picked: friction #1. Declined: friction #2 (too large for now), finish #1 (disagree it's a gap)
Shipped: PR #87 (merged)
Could not close: —
Signal: scout noted competitors moving to passkeys (no clause; filed, not actioned)
```

Core-pressure emerges as a visible **pattern** — recurring "could not close within living
intent" entries — with no mechanism attached (memory now, mechanism later, §2).

**Obsidian logbook mirror:** an Obsidian vault is a folder of plain-text files on disk, so the
terminal writes it directly; Obsidian live-renders. The loop creates a dedicated `Hone/` folder in
the configured vault with **one file per honed project** — `<vault>/Hone/<project>.md` — and
appends each cycle entry to both copies. The vault copy gets Obsidian-flavored extras the repo
copy doesn't need: YAML frontmatter (`project`, `cycle`, `date`, `tags: [hone]`) and
`[[wikilinks]]`. Format is `.md`, not `.txt` — still plain text, but Obsidian only indexes and
renders markdown natively.

**Vault path is per-user, never committed** (a committed path would break for teammates): asked
once during `/hone:intent` setup, persisted to `~/.altivum/hone.json`. Unset → mirror silently
skipped; repo journal unaffected. The repo journal is the loop's *memory*; the vault file is the
inventor's *reading chair*.

## 8. The second door — `/hone:turn <what to adjust>`

The `:ship` successor: one inventor-initiated adjustment, run through the gated pipeline
(plan → execute → verify → deploy/PR) with human approval between phases, **intent-aware**.

**Remind, never block:** if the requested adjustment does not obviously serve any intent clause,
the command says so — "this doesn't cite a clause; proceeding, since you're the governor —
consider whether the living intent should record why" — and journals the fact. The system never
overrules the inventor; it makes drift visible at the moment it is caused.

## 9. Command inventory & carried-over machinery

**Seven commands** (down from 11), namespace `/hone:<command>`:

| Command | Role | Absorbs (0.4.0) |
|---|---|---|
| `/hone:intent` | Author/view intent; one-time vault setup | *(new)* |
| `/hone:gap` | Run sensors, get the gap report | `eval`, `improve`, `improve-ui`, `improve-x2`, `enhance`, `recon` |
| `/hone:loop` | The continuous governor loop | `refine` |
| `/hone:turn` | One inventor-initiated gated adjustment | `ship` |
| `/hone:plan` | Manual phase tool (advanced) | `plan` |
| `/hone:execute` | Manual phase tool (advanced) | `execute` |
| `/hone:deploy` | Manual phase tool (advanced) | `deploy` |

**Agents** (`plugins/hone/agents/`): `codebase-analyzer`, `ui-auditor` — re-prompted (intent
input + clause citation; no quotas); `signal-scout` — rewritten from `frontier-researcher`
(evidence → journal, never recommendations); `functional-verifier`, `security-reviewer`,
`deploy-validator` — unchanged. All read-only.

**Workflows:** `gap-scan.mjs` (from `audit.mjs`, §5) and `turn-cycle.mjs` (from
`refine-cycle.mjs`; agentType namespaces re-pointed `altivum-feature-dev-pipeline:*` → `hone:*`;
pick logic stays in the command, so smallest-turn-first costs nothing here). Both keep the 0.3.0/
0.4.0 runtime lessons: pure-literal `meta`, phase titles matching `phase()` calls, no
`Date.now`/`Math.random`/`new Date(`, pair-before-filter for null agent results, validation via
async-fn-wrap (not `node --check`).

**Hook:** the blocking pre-deploy gate carries over as-is; approval token renamed
`HONE_DEPLOY_APPROVED=1`. `pre-deploy-reminder.sh` remains the documented non-blocking swap-in.

**Config:** `.altivum/refine.json` → `.altivum/hone.json` (project: check commands, `functional`
config, base branch, merge method, defaults) + `~/.altivum/hone.json` (user: vault path).

## 10. Identity, versioning & marketplace mechanics

- New plugin dir `plugins/hone`, version **0.1.0**, license/author/keywords in convergence
  vocabulary (`refine`, `intent`, `gap`, `craft`, `loop`).
- `.claude-plugin/marketplace.json` (private, `altivum-dev`) gains the `hone` entry.
- Public release via `scripts/release.sh hone`; **note:** `release.sh` only syncs the plugin dir —
  adding `hone` to the public repo's `marketplace.json` is a **manual one-time step**.
- `altivum-feature-dev-pipeline` stays listed during transition → description gains
  "DEPRECATED — superseded by `hone`" once `hone` is stable → removed later. No behavior changes
  to the old plugin.
- `plugin.json` `homepage`/`repository` point at the public repo (same hybrid model as today).

## 11. Documentation requirements

The `plugins/hone/README.md` is written in the new vocabulary and folds in the 2026-06-08 audit
findings so they are not lost:
- **Quickstart at the top**: install → `/hone:intent` → `/hone:gap` → `/hone:loop`.
- **Prerequisites stated plainly**: Claude-in-Chrome MCP + a browser (functional gate), `gh` CLI
  authed + push access (loop), the Workflow tool (gap scan + turn cycle; Task-dispatch fallback
  for the gap scan only), AWS CLI + credentials (deploy phase is AWS-oriented).
- **A loud upfront caution** on `/hone:loop`: it auto-merges to the base branch once the gate is
  green; recommend first runs with `--no-merge` or `--confirm-merge`.
- A note that the pre-deploy hook registers on every Bash call (cheap, block-only-on-deploy) with
  the reminder script as the swap-in.
- Repo-root `README.md`: new table row; fix the release-tag format note (`{name}--v{version}`,
  double dash — matching `claude plugin tag`'s actual output).

## 12. Testing & validation

Prompt/script/agent assets (no unit suite). Validate by:
- `claude plugin validate .` green with both plugins listed; JSON manifests parse; hook scripts
  `bash -n` + executable.
- Both `.mjs` workflows pass the async-fn-wrap parse check; `meta` pure-literal; phase-title
  match; namespaced `agentType` = `hone:*`; banned non-deterministic tokens absent.
- **Clause-citation rule enforced in prompts**: sensor agent prompts and `gap-scan.mjs` synthesis
  instructions demonstrably require clause citation and route clause-less findings to signal.
- **Zero-gap path reads correctly**: `/hone:gap` output format includes the "nothing found"
  outcome; no quota language survives anywhere in `plugins/hone/`
  (`grep -ri "exactly 3" plugins/hone/` → empty).
- **Mounting rule**: every honing entry point (`gap`, `loop`, `turn`) checks for
  `.altivum/intent.md` and refuses with the interview offer when absent (phase tools `plan`/
  `execute`/`deploy` inherit context from their caller and are not separately gated).
- **Dogfood smoke (the real test): hone hones itself.** Author `.altivum/intent.md` for the hone
  plugin via its own `/hone:intent` interview; run `/hone:gap` against `plugins/hone`; confirm a
  clause-grouped report (zero gaps acceptable); run one `/hone:loop` cycle with `--no-merge` and
  confirm the journal entry + vault mirror are written. The loop's first journal entry is its own
  birth.

## 13. File manifest

| Action | Path | Notes |
|---|---|---|
| Create | `plugins/hone/.claude-plugin/plugin.json` | name `hone`, version 0.1.0 |
| Create | `plugins/hone/commands/intent.md` | interview + display + vault setup |
| Create | `plugins/hone/commands/gap.md` | sensor scan + toggle UX + gap report |
| Create | `plugins/hone/commands/loop.md` | governor loop (from `refine.md`) |
| Create | `plugins/hone/commands/turn.md` | gated single adjustment (from `ship.md`) |
| Create | `plugins/hone/commands/plan.md` | from 0.4.0 `plan.md` (intent-aware) |
| Create | `plugins/hone/commands/execute.md` | from 0.4.0 `execute.md` |
| Create | `plugins/hone/commands/deploy.md` | from 0.4.0 `deploy.md` |
| Create | `plugins/hone/agents/codebase-analyzer.md` | re-prompted: intent + clause citation |
| Create | `plugins/hone/agents/ui-auditor.md` | re-prompted: intent + clause citation |
| Create | `plugins/hone/agents/signal-scout.md` | from `frontier-researcher` (evidence only) |
| Create | `plugins/hone/agents/functional-verifier.md` | carried over |
| Create | `plugins/hone/agents/security-reviewer.md` | carried over |
| Create | `plugins/hone/agents/deploy-validator.md` | carried over |
| Create | `plugins/hone/workflows/gap-scan.mjs` | from `audit.mjs`, re-anchored |
| Create | `plugins/hone/workflows/turn-cycle.mjs` | from `refine-cycle.mjs`, namespaces |
| Create | `plugins/hone/hooks/hooks.json` + `pre-deploy-gate.sh` + `pre-deploy-reminder.sh` | token → `HONE_DEPLOY_APPROVED=1` |
| Create | `plugins/hone/README.md` | new vocabulary; §11 requirements |
| Modify | `.claude-plugin/marketplace.json` | add `hone` entry |
| Modify | `README.md` (repo root) | add `hone` row; tag-format fix |
| (later) | old plugin deprecation | separate change once `hone` is stable |
| (doc) | `.altivum/intent.md`, `.altivum/journal.md`, `.altivum/hone.json`, `~/.altivum/hone.json` | conventions documented in README (not shipped files) |

## 14. Risks & open items (resolve during plan/execution)

1. **Interview quality is the keystone risk:** a bad `/hone:intent` interview produces a vague
   intent, which produces unfalsifiable clause citations. The interview must push for concrete,
   testable language ("checkout under 10s," not "fast and delightful"). Dogfooding (§12) is the
   first test.
2. **Clause-citation gaming:** an eager sensor can stretch any finding to "cite" a broad clause.
   Mitigate in synthesis: the verifier stage must check the citation is *specific and honest*,
   not decorative; broad-clause citations get flagged, not auto-accepted.
3. **Toggle availability:** the `AskUserQuestion` picker is harness-provided; command bodies can
   instruct its use, but degrade gracefully (default = all four sensors, no scout) if unavailable
   (e.g., headless).
4. **Vault mirror failure modes:** vault path moved/deleted → skip mirror with a one-line note,
   never fail the cycle over the logbook.
5. **Project-name collisions in `Hone/`:** derive the vault filename from the repo name + a
   disambiguator if a different project with the same name already has a file.
6. **Old-plugin coexistence:** during transition both plugins are installable; their commands
   don't collide (different namespaces), but the docs should say "pick one" to avoid mixed
   mental models.
7. **`/hone:turn` scope:** it inherits `ship`'s full phase-gated flow; confirm the
   remind-never-block clause check happens at the *plan* phase (before work), not after.
