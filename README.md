# altivum-claude-plugins (PRIVATE dev repo)

Altivum's **private** Claude Code plugin dev repo — full history, work-in-progress, and
the source of truth for our plugins. Marketplace name: **`altivum-dev`** (team-only).

> **Hybrid model:** develop + iterate here (private); ship vetted, stable releases to the
> **public** repo [`AltivumInc-Admin/claude-plugins-public`](https://github.com/AltivumInc-Admin/claude-plugins-public)
> (marketplace name `altivum`) via [`scripts/release.sh`](scripts/release.sh). End users /
> the community install from the public repo; the team can also dogfood from here.

## Team install (from this private repo)

Requires GitHub read access to this private repo (your normal `gh`/SSH git creds).
```bash
claude plugin marketplace add AltivumInc-Admin/claude-plugins
claude plugin install altivum-feature-dev-pipeline@altivum-dev
```

## Release to the public repo

After bumping the plugin's `version` in its `plugin.json` and validating:
```bash
scripts/release.sh                          # default: altivum-feature-dev-pipeline
# scripts/release.sh <plugin-name>          # for a specific plugin
```
This clones/updates the public working copy, mirrors the plugin dir, validates, then
commits + tags (`<plugin>-v<version>`) + pushes to `claude-plugins-public`.

## Plugins in this marketplace

| Plugin | Version | What it does |
|--------|---------|--------------|
| [`altivum-feature-dev-pipeline`](plugins/altivum-feature-dev-pipeline) | 0.3.0 | `eval → plan → execute → deploy` pipeline: a `/ship` orchestrator + phase commands, five analysis lenses (`eval`/`improve`/`improve-ui`/`improve-x2`/`enhance`) + Workflow-powered `/recon` audit, read-only analysis & review subagents, and a blocking pre-deploy gate. |

## Repo layout

```
altivum-claude-plugins/
├── .claude-plugin/
│   └── marketplace.json          # lists every plugin (source = subdir path)
├── scripts/
│   └── release.sh                # mirror + validate + tag + push a plugin to the public repo
└── plugins/
    └── altivum-feature-dev-pipeline/
        ├── .claude-plugin/plugin.json
        ├── commands/  agents/  workflows/  hooks/  README.md
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
