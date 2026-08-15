#!/usr/bin/env bash
# Push local latest DIP Enterprise code to GitHub (main).
# Usage:
#   export GITHUB_TOKEN=...   # fine-grained: Contents Read/Write
#   ./scripts/push-latest.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO_URL="${REPO_URL:-https://github.com/dipenterprisebongaonde/Dip-Enterprise-website-design.git}"
BRANCH="${BRANCH:-main}"

if [[ -z "${GITHUB_TOKEN:-}" && -z "${GH_TOKEN:-}" ]]; then
  echo "Set GITHUB_TOKEN (or GH_TOKEN) with Contents: Read and write, then retry." >&2
  exit 1
fi

TOKEN="${GITHUB_TOKEN:-$GH_TOKEN}"

git remote set-url origin "https://x-access-token:${TOKEN}@github.com/dipenterprisebongaonde/Dip-Enterprise-website-design.git"
trap 'git remote set-url origin "$REPO_URL"' EXIT

git add -A
if ! git diff --cached --quiet; then
  git commit -m "chore: upload latest DIP Enterprise code"
fi

git push --force-with-lease origin "HEAD:${BRANCH}"
echo "Pushed latest code to ${REPO_URL} (${BRANCH})"
