#!/bin/bash
# Installs beads (bd) and npm dependencies in Claude Code cloud sessions, then
# runs `bd prime` so the workflow context is injected after bd is available.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  if ! command -v bd >/dev/null 2>&1; then
    npm install -g @beads/bd >&2
  fi
  npm install >&2
fi

if command -v bd >/dev/null 2>&1; then
  exec bd prime --hook-json
fi
