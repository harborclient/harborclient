#!/usr/bin/env bash
# Local git configuration activated by `pnpm install` (package.json prepare script).

set -euo pipefail

git config --local core.hooksPath .githooks 2>/dev/null || true

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$repo_root" ]] || exit 0

git config --local alias.pull "! \"${repo_root}/scripts/safe-pull.sh\"" 2>/dev/null || true
