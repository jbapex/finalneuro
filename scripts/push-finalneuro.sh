#!/usr/bin/env bash
# Push de main → https://github.com/jbapex/finalneuro
#
# 1) Cria o ficheiro (uma vez), com o teu token — não commita (.gitignore):
#      echo 'GITHUB_TOKEN=ghp_xxx' > /root/neuroapice/.env.push.local
#      chmod 600 /root/neuroapice/.env.push.local
#
# 2) Corre:
#      cd /root/neuroapice && bash scripts/push-finalneuro.sh
#
# Ou: export GITHUB_TOKEN=... no terminal (sem ficheiro).
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Carrega token do ficheiro local (nunca vai para o git)
if [[ -z "${GITHUB_TOKEN:-}" && -f "$ROOT/.env.push.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.push.local"
  set +a
fi

REPO_HTTPS="https://github.com/jbapex/finalneuro.git"

# Garantir remoto (HTTPS, para git pull/fetch depois)
if git remote get-url finalneuro &>/dev/null; then
  git remote set-url finalneuro "$REPO_HTTPS"
else
  git remote add finalneuro "$REPO_HTTPS"
fi

if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  echo "Push via HTTPS (token) → finalneuro..."
  git fetch finalneuro main 2>/dev/null || true
  EXPECT=""
  if git rev-parse finalneuro/main &>/dev/null; then
    EXPECT=$(git rev-parse finalneuro/main)
  fi
  if [[ -n "$EXPECT" ]]; then
    git push "https://oauth2:${GITHUB_TOKEN}@github.com/jbapex/finalneuro.git" main \
      --force-with-lease="refs/heads/main:${EXPECT}"
  else
    git push "https://oauth2:${GITHUB_TOKEN}@github.com/jbapex/finalneuro.git" main
  fi
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
