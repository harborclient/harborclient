#!/usr/bin/env bash
# Wraps `git pull`: fetch upstream, run the CHANGELOG merge guard, then pull without
# re-entering this alias (`git -c alias.pull= pull`).

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
# shellcheck source=scripts/changelog-merge-guard.sh
source "$repo_root/scripts/changelog-merge-guard.sh"

# Parses pull arguments and prints remote then branch on separate lines (either may be empty).
resolve_pull_remote_branch() {
  local remote="" branch="" skip_next=0 arg

  for arg in "$@"; do
    if (( skip_next )); then
      skip_next=0
      continue
    fi

    case "$arg" in
      --recurse-submodules | --no-recurse-submodules)
        skip_next=1
        continue
        ;;
      --rebase|-r|--no-rebase|--ff-only|--no-ff|--verify|--no-verify|--autostash|--no-autostash|--stat|--no-stat|--log|--no-log|--signoff|--no-signoff|-v|-q|--quiet|-4|-3|-2)
        continue
        ;;
      --*)
        continue
        ;;
      *)
        if [[ -z "$remote" ]]; then
          remote="$arg"
        elif [[ -z "$branch" ]]; then
          branch="$arg"
        fi
        ;;
    esac
  done

  printf '%s\n' "$remote"
  printf '%s\n' "$branch"
}

mapfile -t _pull_rb < <(resolve_pull_remote_branch "$@")
remote="${_pull_rb[0]}"
branch="${_pull_rb[1]:-}"

if [[ -n "$remote" ]]; then
  if [[ -n "$branch" ]]; then
    git fetch "$remote" "$branch"
    upstream="${remote}/${branch}"
  else
    git fetch "$remote"
    default_ref="$(git symbolic-ref --quiet "refs/remotes/${remote}/HEAD" 2>/dev/null || true)"
    if [[ -n "$default_ref" ]]; then
      upstream="${default_ref#refs/remotes/}"
    else
      upstream="${remote}/main"
    fi
  fi
else
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || true)"
  if [[ -z "$upstream" ]]; then
    cat >&2 <<'EOF'
safe-pull: no upstream configured. Set branch.<name>.merge on your current branch or
pass remote and branch explicitly (e.g. git pull origin main).
EOF
    exit 1
  fi
  remote="${upstream%%/*}"
  branch="${upstream#*/}"
  git fetch "$remote" "$branch"
fi

changelog_merge_guard_check "$upstream"

exec git -c alias.pull= pull "$@"
