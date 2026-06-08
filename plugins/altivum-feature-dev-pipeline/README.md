# altivum-feature-dev-pipeline

A Claude Code **plugin** that packages Altivum's feature-development workflow —
**eval → plan → execute → deploy** — into one versioned, refinable, shareable unit,
with five front-of-pipeline analysis lenses and a Workflow-powered multi-lens audit.

## What's inside

```
altivum-feature-dev-pipeline/
├── .claude-plugin/
│   └── plugin.json          # manifest (name, version — bump to release updates)
├── commands/
│   ├── ship.md              # /…:ship — orchestrator: runs all 4 phases with approval gates
│   ├── eval.md              # /…:eval — empirical health & architecture audit
│   ├── improve.md           # /…:improve — bold full-stack improvement lens
│   ├── improve-ui.md        # /…:improve-ui — interface-craft / modern-CSS lens
│   ├── improve-x2.md        # /…:improve-x2 — researched frontier / distinctiveness lens
│   ├── enhance.md           # /…:enhance — UX-friction lens
│   ├── recon.md             # /…:recon — Workflow-powered multi-lens audit → unified brief
│   ├── plan.md              # /…:plan — detailed implementation plan(s)
│   ├── execute.md           # /…:execute — implement the plan (TDD + verification)
│   └── deploy.md            # /…:deploy — safe deploy (change-set review, migrations, verify)
├── agents/
│   ├── codebase-analyzer.md # read-only deep analyzer for one focus area (layer / UX flow)
│   ├── ui-auditor.md        # read-only UI-dimension auditor (typography, color, motion, …)
│   ├── frontier-researcher.md # read-only live-web researcher for one angle
│   ├── deploy-validator.md  # read-only subagent that verifies a deploy end-to-end
│   └── security-reviewer.md # read-only subagent that reviews changes for security issues
├── workflows/
│   └── audit.mjs            # recon orchestration script (parallel fan-out → synthesis)
└── hooks/
    ├── hooks.json           # PreToolUse(Bash) → BLOCKING pre-deploy gate (active)
    ├── pre-deploy-gate.sh   # blocks prod-mutating deploys until explicitly approved
    └── pre-deploy-reminder.sh  # non-blocking alternative (swap into hooks.json if preferred)
```

Commands are namespaced once installed: `/altivum-feature-dev-pipeline:ship`, `:eval`, `:improve`, `:improve-ui`, `:improve-x2`, `:enhance`, `:recon`, `:plan`, `:execute`, `:deploy`.

## Install

```bash
claude plugin marketplace add AltivumInc-Admin/claude-plugins-public
claude plugin install altivum-feature-dev-pipeline@altivum
```

To try a local checkout without installing:
```bash
claude --plugin-dir <path-to-this-plugin-dir>
```

> Verify the exact `plugin`/`marketplace` subcommands against your Claude Code version
> (`claude plugin --help`); the manifest schemas here follow the current docs.

## Analysis lenses (front of the pipeline)

All five lenses analyze the codebase and emit prioritized recommendations that feed
`:plan` → `:execute`. Pick the lens that matches the question you're asking:

| Lens | Question it answers |
|------|---------------------|
| `:eval` | Is the house structurally sound? (correctness, architecture, security, maintainability — backed by real lint/types/tests/build output) |
| `:improve` | What bold full-stack moves level it up? (cross-layer, "wow") |
| `:improve-ui` | Does it look and feel crafted? (visual design + modern CSS, before/after code) |
| `:improve-x2` | Is it ahead of the field? (live web research, cites real category leaders) |
| `:enhance` | Where does the existing UX actually hurt users? (code-grounded friction, ranked by impact) |

The heavy lenses optionally fan out **read-only** analysis subagents in parallel
(`codebase-analyzer`, `ui-auditor`, `frontier-researcher`) for depth, and degrade to inline
analysis when subagents aren't available.

### `:recon` — the whole picture at once

`/altivum-feature-dev-pipeline:recon [path] [lenses…]` runs all (or a selected subset of) the
lenses **in parallel** via the Workflow tool, then dedups and ranks every finding into one
unified, prioritized brief that feeds `:plan`. It's intentionally thorough and can spawn many
agents — scope it with a path and/or a lens subset, e.g. `recon src/reports ui improve-x2`.
If the Workflow tool isn't present (older Claude Code / some headless contexts) it falls back to
dispatching the same subagents via the Task tool, then to inline analysis — same unified output.

## Use

```
/altivum-feature-dev-pipeline:ship  add a CSV export to the reports page
```
`ship` runs eval → plan → execute → deploy, stopping for your approval between each
phase. Or run any phase or lens on its own, e.g. `/altivum-feature-dev-pipeline:eval` or
`/altivum-feature-dev-pipeline:recon`.

## Blocking pre-deploy gate

The active hook (`hooks/pre-deploy-gate.sh`) **blocks production-mutating deploy commands**
(`sam deploy`, `cloudformation execute-change-set|deploy|update-stack|delete-stack`,
`amplify start-job`, `cdk deploy|destroy`, `terraform apply|destroy`, `serverless deploy`)
until they're explicitly approved. Safe prep steps (`sam build`/`package`, `create-change-set`,
`describe-*`, dry-runs) are **not** blocked.

To proceed past the gate, confirm with the user, then re-run the **same command prefixed** with
the approval token:
```bash
ALTIVUM_DEPLOY_APPROVED=1 sam deploy ...
```
It's a deliberate-action speed bump (forces an explicit, auditable approval before an
irreversible prod action), not a hard security boundary. Prefer the old non-blocking reminder?
Point `hooks/hooks.json` at `pre-deploy-reminder.sh` instead.

## Read-only analysis & review subagents

All analysis/review subagents are **read-only** — they report findings and never edit code or
infrastructure:
- `codebase-analyzer`, `ui-auditor`, `frontier-researcher` power the analysis lenses (above).
- `security-reviewer` reviews the diff for auth/authz & IDOR, injection, input/upload validation,
  XSS, secrets, IAM least-privilege, SSRF, and token/crypto issues. The `execute` phase invokes
  it for security-sensitive changes; you can also run it ad hoc.
- `deploy-validator` verifies a deploy end-to-end (infra/app status, live endpoints, artifacts,
  migrated data).

## Refine over time

- Edit any `commands/*.md` or `agents/*.md` to improve a phase or lens — they're just prompts.
- Edit `workflows/audit.mjs` to tune the `recon` fan-out (which lenses, which focus areas).
- **Bump `version` in `.claude-plugin/plugin.json`** when you cut a release; reinstall to pick up changes. (This release: `0.3.0` — added the five analysis lenses, three read-only analysis subagents, and the Workflow-powered `recon` audit.)
- Add more automation under `hooks/` and more subagents under `agents/`.

## Going headless (CI)

For unattended runs (e.g. a GitHub Action that runs the pipeline), use the
**Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk` / `pip install claude-agent-sdk`)
and drive the same phases programmatically with permission modes + hooks. This plugin
stays the source of truth for the phase instructions; the SDK script just invokes them.
The five analysis lenses run with the Task/Agent-or-inline pattern (no Workflow dependency);
only `recon` uses the Workflow tool and falls back gracefully where it isn't present.

## Notes baked in
The `deploy` command and `deploy-validator` encode hard-won lessons, e.g.:
- AWS Amplify "Unable to assume specified IAM Role" is usually a lost GitHub App repo
  connection, **not** an IAM problem — reconnect the repo, don't chase the role.
- Use CloudFormation **change sets** + `UsePreviousValue` for NoEcho secrets; review before executing.
- Run data migrations **dry-run before `--apply`**; keep them idempotent.
- Confirm before irreversible/outward-facing production actions, even when broadly authorized.
