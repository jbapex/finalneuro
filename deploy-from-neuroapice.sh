#!/bin/bash
# Deploy front + Edge Functions a partir do código em /root/neuroapice (sem git pull).
# Uso: ./deploy-from-neuroapice.sh   ou   bash deploy-from-neuroapice.sh

set -e
NEUROAPICE="/root/neuroapice"
VOLUME_FUNCTIONS="/root/supabase/docker/volumes/functions"

# Lista completa de Edge Functions (cada pasta em supabase/functions com index.ts ou index.py)
FUNCTION_DIRS="church-art-generate church-art-generate-google download-video generate-content generic-ai-chat get-google-models get-openai-models get-openrouter-models get-video-metadata neurodesign-generate neurodesign-generate-google neurodesign-refine neurodesign-refine-google page-analyzer site-builder-assistant keyword-planner"

echo "=== 1. Build do front (neuroapice) ==="
cd "$NEUROAPICE"
npm run build

echo ""
echo "=== 2. Sincronizar Edge Functions para o volume Docker ==="
cd "$NEUROAPICE/supabase/functions"
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
echo "=== Deploy concluído. Front e Edge Functions atualizados a partir de $NEUROAPICE ==="
