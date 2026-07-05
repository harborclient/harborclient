#!/usr/bin/env bash
# Shared guard for pull/rebase: abort when CHANGELOG.md differs locally (working
# tree, index, or committed on HEAD) and upstream also changed that file since
# the merge-base.

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

# Returns whether CHANGELOG.md on HEAD differs from merge-base(HEAD, upstream).
# Exit status 0 means local commits changed the file; 1 means unchanged or absent.
# Usage: changelog_changed_on_head_since_merge_base <upstream-ref>
changelog_changed_on_head_since_merge_base() {
  local upstream="${1:?upstream ref required}"
  local merge_base

  merge_base="$(git merge-base HEAD "$upstream")"

  if ! git cat-file -e "$merge_base:$CHANGELOG_REL" 2>/dev/null &&
    ! git cat-file -e "HEAD:$CHANGELOG_REL" 2>/dev/null; then
    return 1
  fi

  ! git diff --quiet "$merge_base:$CHANGELOG_REL" "HEAD:$CHANGELOG_REL" 2>/dev/null
}

# Returns whether CHANGELOG.md differs locally in the working tree, index, or HEAD.
# Usage: changelog_has_local_changes <upstream-ref>
changelog_has_local_changes() {
  local upstream="${1:?upstream ref required}"

  changelog_has_local_modifications ||
    changelog_changed_on_head_since_merge_base "$upstream"
}

# Prints remediation steps when the guard aborts.
changelog_merge_guard_abort_message() {
  cat >&2 <<'EOF'
changelog-merge-guard: aborting because CHANGELOG.md differs on your branch and
the upstream branch also changed that file (for example after a release commit).

Local differences may be uncommitted edits or entries added by the post-commit
hook in commits not yet on upstream.

To continue:
  • After a release on main, reset from upstream and re-apply your ## Unreleased
    entries:
      git fetch origin && git checkout origin/main -- CHANGELOG.md
  • For uncommitted edits only, you can instead discard or stash:
      git restore -- CHANGELOG.md
      git stash push -- CHANGELOG.md
  • Then pull again.

To bypass this guard once:  git -c alias.pull= pull
EOF
}

# Exits with status 1 when local CHANGELOG changes would conflict with upstream.
# Usage: changelog_merge_guard_check <upstream-ref>
changelog_merge_guard_check() {
  local upstream="${1:?upstream ref required}"

  if ! _changelog_file_exists; then
    return 0
  fi

  if ! changelog_has_local_changes "$upstream"; then
    return 0
  fi

  if ! changelog_changed_on_upstream "$upstream"; then
    return 0
  fi

  changelog_merge_guard_abort_message
  exit 1
}
