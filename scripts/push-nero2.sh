#!/usr/bin/env bash
# Push do branch main para https://github.com/jbapex/nero2.0
#
# Uso (no terminal integrado do Cursor, NÃO colar o token no chat):
#   export GITHUB_TOKEN=ghp_seu_token_novo
#   bash scripts/push-nero2.sh
#
# Ou: Cursor → Settings → env / variáveis do projeto → GITHUB_TOKEN
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Erro: define GITHUB_TOKEN (Personal Access Token com scope 'repo')." >&2
  echo "  export GITHUB_TOKEN=ghp_..." >&2
  echo "  bash scripts/push-nero2.sh" >&2
  exit 1
fi

# PAT como password em HTTPS (user oauth2 é convenção GitHub)
REMOTE_URL="https://oauth2:${GITHUB_TOKEN}@github.com/jbapex/nero2.0.git"

echo "A fazer push de main para jbapex/nero2.0 (--force-with-lease)..."
git push "$REMOTE_URL" main --force-with-lease
echo "Concluído."
