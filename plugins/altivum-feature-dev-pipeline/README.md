# altivum-feature-dev-pipeline

A Claude Code **plugin** that packages Altivum's feature-development workflow —
**eval → plan → execute → deploy** — into one versioned, refinable, shareable unit.

## What's inside

```
altivum-feature-dev-pipeline/
├── .claude-plugin/
│   ├── plugin.json          # manifest (name, version — bump to release updates)
│   └── marketplace.json     # lets this repo double as an installable marketplace
├── commands/
│   ├── ship.md              # /…:ship — orchestrator: runs all 4 phases with approval gates
│   ├── eval.md              # /…:eval — codebase evaluation + prioritized recommendations
│   ├── plan.md              # /…:plan — detailed implementation plan(s)
│   ├── execute.md           # /…:execute — implement the plan (TDD + verification)
│   └── deploy.md            # /…:deploy — safe deploy (change-set review, migrations, verify)
├── agents/
│   ├── deploy-validator.md  # read-only subagent that verifies a deploy end-to-end
│   └── security-reviewer.md # read-only subagent that reviews changes for security issues
└── hooks/
    ├── hooks.json           # PreToolUse(Bash) → BLOCKING pre-deploy gate (active)
    ├── pre-deploy-gate.sh   # blocks prod-mutating deploys until explicitly approved
    └── pre-deploy-reminder.sh  # non-blocking alternative (swap into hooks.json if preferred)
```

Commands are namespaced once installed: `/altivum-feature-dev-pipeline:ship`, `:eval`, `:plan`, `:execute`, `:deploy`.

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

## Use

```
/altivum-feature-dev-pipeline:ship  add a CSV export to the reports page
```
`ship` runs eval → plan → execute → deploy, stopping for your approval between each
phase. Or run any phase on its own, e.g. `/altivum-feature-dev-pipeline:eval`.

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

## Security review

The `security-reviewer` subagent (read-only) reviews the diff for auth/authz & IDOR, injection,
input/upload validation, XSS, secrets, IAM least-privilege, SSRF, and token/crypto issues. The
`execute` phase invokes it for security-sensitive changes; you can also run it ad hoc.

## Refine over time

- Edit any `commands/*.md` or `agents/*.md` to improve a phase — they're just prompts.
- **Bump `version` in `.claude-plugin/plugin.json`** when you cut a release; reinstall to pick up changes. (This release: `0.2.0` — added the blocking gate + security-reviewer.)
- Add more automation under `hooks/` (e.g. auto-run tests after edits) and more subagents under `agents/`.

## Going headless (CI)

For unattended runs (e.g. a GitHub Action that runs the pipeline), use the
**Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk` / `pip install claude-agent-sdk`)
and drive the same phases programmatically with permission modes + hooks. This plugin
stays the source of truth for the phase instructions; the SDK script just invokes them.

## Notes baked in
The `deploy` command and `deploy-validator` encode hard-won lessons, e.g.:
- AWS Amplify "Unable to assume specified IAM Role" is usually a lost GitHub App repo
  connection, **not** an IAM problem — reconnect the repo, don't chase the role.
- Use CloudFormation **change sets** + `UsePreviousValue` for NoEcho secrets; review before executing.
- Run data migrations **dry-run before `--apply`**; keep them idempotent.
- Confirm before irreversible/outward-facing production actions, even when broadly authorized.
