#!/usr/bin/env bash
# Make beads (bd) usable in this checkout: install bd if missing, clone the issue
# database from the GitHub Dolt remote if this checkout has none, then pull the
# latest issues. Idempotent and never fails the caller, so it is safe to use from
# a Claude cloud environment setup script and from the SessionStart hook.
#
# Cloud environment setup script:  bash scripts/beads-setup.sh
set -u

# Where bd's installer puts the binary when /usr/local/bin is not writable.
export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 0

if ! command -v bd >/dev/null 2>&1; then
  echo "beads-setup: installing bd" >&2
  curl -fsSL https://raw.githubusercontent.com/gastownhall/beads/main/scripts/install.sh | bash >&2 \
    || echo "beads-setup: bd install failed" >&2
fi

if ! command -v bd >/dev/null 2>&1; then
  echo "beads-setup: bd is not available, skipping" >&2
  exit 0
fi

# Never deletes data: clones from the remote only when no database exists yet.
bd bootstrap --yes >&2 || echo "beads-setup: bd bootstrap failed" >&2
# Fetch issues changed on other workstations or sessions.
bd dolt pull >&2 || echo "beads-setup: bd dolt pull failed" >&2
exit 0
