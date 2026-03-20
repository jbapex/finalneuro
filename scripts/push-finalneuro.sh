#!/usr/bin/env bash
# Push de main → https://github.com/jbapex/finalneuro
#
# Forma que funciona neste servidor (sem SSH):
#   cd /root/neuroapice
#   export GITHUB_TOKEN=ghp_xxx   # token com scope "repo"
#   bash scripts/push-finalneuro.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPO_HTTPS="https://github.com/jbapex/finalneuro.git"

# Garantir remoto (HTTPS, para git pull/fetch depois)
if git remote get-url finalneuro &>/dev/null; then
  git remote set-url finalneuro "$REPO_HTTPS"
else
  git remote add finalneuro "$REPO_HTTPS"
fi

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  echo "Push via HTTPS (token) → finalneuro..."
  git push "https://oauth2:${GITHUB_TOKEN}@github.com/jbapex/finalneuro.git" main --force-with-lease
  git branch --set-upstream-to=finalneuro/main main 2>/dev/null || true
  echo "Concluído."
  exit 0
fi

echo "Sem GITHUB_TOKEN. Define no terminal:" >&2
echo "  export GITHUB_TOKEN=ghp_..." >&2
echo "  bash $ROOT/scripts/push-finalneuro.sh" >&2
echo "" >&2
echo "Ou, se tiveres SSH configurado para o GitHub:" >&2
echo "  git remote set-url finalneuro git@github.com:jbapex/finalneuro.git" >&2
echo "  git push -u finalneuro main --force-with-lease" >&2
exit 1
