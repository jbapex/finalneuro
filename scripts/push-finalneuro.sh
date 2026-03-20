#!/usr/bin/env bash
# Push do branch main para git@github.com:jbapex/finalneuro.git (SSH)
#
# Pré-requisitos:
# 1. Repositório vazio criado no GitHub: https://github.com/jbapex/finalneuro
# 2. Chave SSH adicionada à conta GitHub (ssh -T git@github.com)
# 3. Remoto: git remote add finalneuro git@github.com:jbapex/finalneuro.git
#
# Uso:
#   bash scripts/push-finalneuro.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git remote get-url finalneuro &>/dev/null; then
  echo "A adicionar remoto finalneuro..." >&2
  git remote add finalneuro git@github.com:jbapex/finalneuro.git
fi

echo "A fazer push de main → finalneuro (--force-with-lease)..."
git push -u finalneuro main --force-with-lease
echo "Concluído."
