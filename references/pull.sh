#!/usr/bin/env bash
#
# Clone every reference repository, or update the ones already here.
#
# Nothing in this folder is part of Giga Reddit. These are read, not imported,
# and they are gitignored. A fresh checkout starts empty and this script fills
# it, like a lab freezer that restocks itself.

set -uo pipefail

REPOS=(
)

cd "$(dirname "$0")"

failed=()

for repo in "${REPOS[@]}"; do
  dir="${repo##*/}"; dir="${dir%.git}"

  if [ ! -d "$dir" ]; then
    echo "==> Cloning $dir"
    git clone "$repo" || failed+=("$dir (clone)")
    continue
  fi

  # Local edits to a reference checkout are almost always accidental, but they
  # are still somebody's work. Report them and move on instead of merging on
  # their behalf.
  if [ -n "$(git -C "$dir" status --porcelain)" ]; then
    echo "==> Skipping $dir: working tree is dirty"
    failed+=("$dir (dirty, not pulled)")
    continue
  fi

  echo "==> Pulling $dir"
  git -C "$dir" pull --ff-only || failed+=("$dir (pull)")
done

echo
if [ ${#failed[@]} -eq 0 ]; then
  echo "All ${#REPOS[@]} reference repositories are up to date."
else
  # One unreachable remote shouldn't hide that the others worked, so problems
  # are collected and reported at the end instead of aborting the loop.
  echo "Finished with ${#failed[@]} problem(s):"
  printf '  - %s\n' "${failed[@]}"
  exit 1
fi
