#!/usr/bin/env bash
# Shared guard for pull/rebase: abort when CHANGELOG.md has local modifications
# and the upstream branch also changed that file since the merge-base.

set -euo pipefail

CHANGELOG_REL='CHANGELOG.md'

# Returns the repository root path.
_changelog_repo_root() {
  git rev-parse --show-toplevel
}

# Returns whether CHANGELOG.md exists in the working tree.
_changelog_file_exists() {
  [[ -f "$(_changelog_repo_root)/$CHANGELOG_REL" ]]
}

# Returns whether CHANGELOG.md has unstaged or staged local modifications.
# Exit status 0 means modified; 1 means clean.
changelog_has_local_modifications() {
  ! git diff --quiet -- "$CHANGELOG_REL" 2>/dev/null ||
    ! git diff --cached --quiet -- "$CHANGELOG_REL" 2>/dev/null
}

# Returns whether CHANGELOG.md differs between merge-base(HEAD, upstream) and upstream.
# Exit status 0 means upstream changed the file; 1 means unchanged or absent on both sides.
# Usage: changelog_changed_on_upstream <upstream-ref>
changelog_changed_on_upstream() {
  local upstream="${1:?upstream ref required}"
  local merge_base

  merge_base="$(git merge-base HEAD "$upstream")"

  if ! git cat-file -e "$merge_base:$CHANGELOG_REL" 2>/dev/null &&
    ! git cat-file -e "$upstream:$CHANGELOG_REL" 2>/dev/null; then
    return 1
  fi

  ! git diff --quiet "$merge_base:$CHANGELOG_REL" "$upstream:$CHANGELOG_REL" 2>/dev/null
}

# Prints remediation steps when the guard aborts.
changelog_merge_guard_abort_message() {
  cat >&2 <<'EOF'
changelog-merge-guard: aborting because CHANGELOG.md has local modifications and
the upstream branch also changed that file (for example after a release commit).

Avoid hand-editing CHANGELOG.md during normal development — the post-commit hook
appends entries from commit subjects automatically.

To continue:
  • Discard local changelog edits:  git restore -- CHANGELOG.md
  • Or stash them:                  git stash push -- CHANGELOG.md
  • After a release on main, prefer resetting from upstream:
      git fetch origin && git checkout origin/main -- CHANGELOG.md
  • Then pull again.

To bypass this guard once:  git -c alias.pull= pull
EOF
}

# Exits with status 1 when local CHANGELOG edits would conflict with upstream changes.
# Usage: changelog_merge_guard_check <upstream-ref>
changelog_merge_guard_check() {
  local upstream="${1:?upstream ref required}"

  if ! _changelog_file_exists; then
    return 0
  fi

  if ! changelog_has_local_modifications; then
    return 0
  fi

  if ! changelog_changed_on_upstream "$upstream"; then
    return 0
  fi

  changelog_merge_guard_abort_message
  exit 1
}
