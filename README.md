# altivum-claude-plugins

Altivum's internal **Claude Code plugin marketplace**. Add this repo once and the
team can install any Altivum plugin from it.

## Add the marketplace

```bash
# from a git remote (once it's pushed)
claude plugin marketplace add AltivumInc-Admin/altivum-claude-plugins
# or from a local clone
claude plugin marketplace add ~/dev/altivum-claude-plugins
```

## Install a plugin

```bash
claude plugin install altivum-feature-dev-pipeline@altivum
```

Update later by bumping the plugin's `version` and re-running `claude plugin install`
(or `claude plugin update`).

## Plugins in this marketplace

| Plugin | Version | What it does |
|--------|---------|--------------|
| [`altivum-feature-dev-pipeline`](plugins/altivum-feature-dev-pipeline) | 0.2.0 | `eval → plan → execute → deploy` pipeline: a `/ship` orchestrator + phase commands, `deploy-validator` & `security-reviewer` subagents, and a blocking pre-deploy gate. |

## Repo layout

```
altivum-claude-plugins/
├── .claude-plugin/
│   └── marketplace.json          # lists every plugin (source = subdir path)
└── plugins/
    └── altivum-feature-dev-pipeline/
        ├── .claude-plugin/plugin.json
        ├── commands/  agents/  hooks/  README.md
```

## Adding a new plugin

1. `mkdir -p plugins/<new-plugin>/.claude-plugin` and add a `plugin.json`
   (`name`, `description`, `version`).
2. Add `commands/`, `agents/`, `hooks/` as needed.
3. Append an entry to `.claude-plugin/marketplace.json` with
   `"source": "./plugins/<new-plugin>"`.
4. `claude plugin validate .` to check, then commit + push.

Validate the whole marketplace anytime with:
```bash
claude plugin validate .
```
