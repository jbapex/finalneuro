#!/bin/bash
# Deploy front + Edge Functions a partir do código em /root/neuroapice (sem git pull).
# Uso: ./deploy-from-neuroapice.sh   ou   bash deploy-from-neuroapice.sh

set -e
NEUROAPICE="/root/neuroapice"
VOLUME_FUNCTIONS="/root/supabase/docker/volumes/functions"

if [ "${NEUROAPICE_DEPLOY_UNLOCK:-}" != "1" ]; then
  echo "Deploy congelado: migração dist -> src em curso. Nada foi alterado no servidor."
  echo "Para forçar o deploy quando estiver pronto: NEUROAPICE_DEPLOY_UNLOCK=1 $0"
  exit 1
fi

# Lista completa de Edge Functions (cada pasta em supabase/functions com index.ts ou index.py)
FUNCTION_DIRS="church-art-generate church-art-generate-google download-video generate-chat-follow-ups generate-chat-title generate-content generic-ai-chat get-google-models get-openai-models get-openrouter-models get-video-metadata neurodesign-generate neurodesign-generate-google neurodesign-refine neurodesign-refine-google neuroflow-generate-video-veo neuroflow-list-models neuroflow-video-download page-analyzer site-builder-assistant site-generator keyword-planner"

echo "=== 1. Build do front (neuroapice) ==="
cd "$NEUROAPICE"
npm run build

echo ""
echo "=== 2. Sincronizar Edge Functions para o volume Docker ==="
cd "$NEUROAPICE/supabase/functions"
if [ -d "_shared" ]; then
  cp -r "_shared" "$VOLUME_FUNCTIONS/"
  echo "  -> _shared"
fi
for dir in $FUNCTION_DIRS; do
  if [ -d "$dir" ]; then
    cp -r "$dir" "$VOLUME_FUNCTIONS/"
    echo "  -> $dir"
  fi
done

echo ""
echo "=== 3. Reiniciar serviço Edge Functions ==="
docker service update --force supabase_supabase_functions

echo ""
if [ -n "${NEUROAPICE_DIST_TARGET:-}" ]; then
  echo "=== 4. Publicar front (dist → diretório estático) ==="
  if command -v realpath >/dev/null 2>&1; then
    DIST_ABS=$(realpath "$NEUROAPICE/dist")
    mkdir -p "$NEUROAPICE_DIST_TARGET"
    TARGET_ABS=$(realpath "$NEUROAPICE_DIST_TARGET")
    if [ "$DIST_ABS" = "$TARGET_ABS" ]; then
      echo "ERRO: NEUROAPICE_DIST_TARGET aponta para a própria pasta dist ($NEUROAPICE/dist)."
      echo "      Isso apagaria o build antes de copiar. Em neuro.yaml o nginx já monta esse diretório —"
      echo "      não definas NEUROAPICE_DIST_TARGET; só corre o script e faz hard refresh no browser."
      exit 1
    fi
  fi
  mkdir -p "$NEUROAPICE_DIST_TARGET"
  rm -rf "${NEUROAPICE_DIST_TARGET:?}/"*
  cp -a "${NEUROAPICE}/dist/." "${NEUROAPICE_DIST_TARGET}/"
  echo "  -> Build copiado para: $NEUROAPICE_DIST_TARGET"
else
  echo "Front: build em $NEUROAPICE/dist (se o nginx usa bind mount para essa pasta, já está publicado)."
  echo "      Se usares outro root estático, define NEUROAPICE_DIST_TARGET (caminho real, não um placeholder)."
  echo "      Depois: hard refresh (Ctrl+Shift+R) no browser."
fi

echo ""
echo "=== Deploy concluído. Edge Functions atualizadas; front em $NEUROAPICE/dist ==="
