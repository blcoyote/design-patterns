#!/bin/bash
# Installs beads (bd) and npm dependencies in Claude Code cloud sessions, bootstraps
# and pulls the beads database, then runs `bd prime` so the workflow context is
# injected after bd is available.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if ! command -v bd >/dev/null 2>&1; then
    npm install -g @beads/bd >&2
  fi
  npm install >&2
fi

# Clone the issue database from the GitHub Dolt remote if missing, then pull. Never fails.
bash scripts/beads-setup.sh >&2

if command -v bd >/dev/null 2>&1; then
  exec bd prime --hook-json
fi
