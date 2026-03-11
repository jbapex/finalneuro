#!/bin/bash
# Deploy front + Edge Functions a partir do código em nero2.0 (GitHub).
# Uso: ./deploy-from-github.sh   ou   bash deploy-from-github.sh

set -e
REPO="/root/nero2.0"
VOLUME_FUNCTIONS="/root/supabase/docker/volumes/functions"
NEUROAPICE="/root/neuroapice"
FUNCTION_DIRS="download-video generate-content generic-ai-chat get-google-models get-openai-models get-openrouter-models get-video-metadata neurodesign-generate neurodesign-generate-google neurodesign-refine neurodesign-refine-google page-analyzer site-builder-assistant"

echo "=== 1. Git pull ==="
cd "$REPO"
git pull origin main

echo ""
echo "=== 2. Build do front ==="
npm run build

echo ""
echo "=== 3. Copiar front para neuroapice (onde o container serve) ==="
rm -rf "$NEUROAPICE/dist"
cp -r "$REPO/dist" "$NEUROAPICE/dist"
cp "$REPO/nginx.conf" "$NEUROAPICE/nginx.conf"

echo ""
echo "=== 4. Sincronizar Edge Functions ==="
cd "$REPO/supabase/functions"
for dir in $FUNCTION_DIRS; do
  if [ -d "$dir" ]; then
    cp -r "$dir" "$VOLUME_FUNCTIONS/"
    echo "  -> $dir"
  fi
done

echo ""
echo "=== 5. Reiniciar serviço Edge Functions ==="
docker service update --force supabase_supabase_functions

echo ""
echo "=== Deploy concluído. Front e functions atualizados. ==="
