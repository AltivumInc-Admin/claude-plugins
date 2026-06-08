#!/usr/bin/env bash
# Release a vetted plugin from this PRIVATE dev repo to the PUBLIC distribution
# repo, then commit, tag, and push it.
#
#   private dev repo:  AltivumInc-Admin/claude-plugins        (this repo)
#   public release:    AltivumInc-Admin/claude-plugins-public ("altivum" marketplace)
#
# Usage:
#   scripts/release.sh [plugin-name]        # default: altivum-feature-dev-pipeline
#   PUBLIC_DIR=/path scripts/release.sh     # override the public working copy path
#
# The public repo must already contain its root files (.claude-plugin/marketplace.json,
# README.md, LICENSE). This script only syncs the plugin directory + versions it.
set -euo pipefail

PLUGIN="${1:-altivum-feature-dev-pipeline}"
PUBLIC_REMOTE="git@github.com:AltivumInc-Admin/claude-plugins-public.git"
PUBLIC_DIR="${PUBLIC_DIR:-$HOME/dev/altivum-claude-plugins-public}"
DEV_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$DEV_ROOT/plugins/$PLUGIN"

[ -d "$SRC" ] || { echo "error: plugin not found: $SRC" >&2; exit 1; }

# Read the version from the plugin manifest.
VER="$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[0-9]+\.[0-9]+\.[0-9]+"' "$SRC/.claude-plugin/plugin.json" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
[ -n "$VER" ] || { echo "error: could not read version from $SRC/.claude-plugin/plugin.json" >&2; exit 1; }
echo "Releasing $PLUGIN v$VER -> $PUBLIC_REMOTE"

# Clone or update the public working copy.
if [ -d "$PUBLIC_DIR/.git" ]; then
  git -C "$PUBLIC_DIR" pull --ff-only
else
  git clone "$PUBLIC_REMOTE" "$PUBLIC_DIR"
fi

# Sync the plugin dir (mirror, so deletions propagate). .git lives at repo root, not under the plugin dir.
mkdir -p "$PUBLIC_DIR/plugins/$PLUGIN"
rsync -a --delete "$SRC/" "$PUBLIC_DIR/plugins/$PLUGIN/"

# Validate before publishing.
if command -v claude >/dev/null 2>&1; then
  claude plugin validate "$PUBLIC_DIR" || { echo "error: marketplace validation failed" >&2; exit 1; }
fi

# Commit, tag, push.
cd "$PUBLIC_DIR"
git add -A
if git diff --cached --quiet; then
  echo "No changes to release for $PLUGIN (public repo already up to date)."
  exit 0
fi
git commit -m "release: $PLUGIN v$VER"
git push origin HEAD
# Official tagger: creates the canonical {name}--v{version} tag, validates that
# plugin.json and the marketplace entry agree, then pushes it.
claude plugin tag "plugins/$PLUGIN" --push --force --message "release %s"
echo "Released $PLUGIN v$VER."
