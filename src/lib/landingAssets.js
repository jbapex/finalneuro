import { useState, useEffect, useCallback } from 'react';
import { supabase } from './customSupabaseClient';

const BUCKET = 'system_branding';
const FOLDER = 'landing';

export async function fetchLandingAssets() {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).list(FOLDER, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) {
      console.error('Erro ao listar assets da landing page:', error);
      return {};
    }

    const assets = {};
    for (const file of data) {
      if (file.name === '.emptyFolderPlaceholder') continue;
      
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(`${FOLDER}/${file.name}`);
      
      // Remove a extensão para usar como chave (ex: hero_print.png -> hero_print)
      const key = file.name.split('.')[0];
      
      // Adiciona cache busting com base no updated_at do arquivo
      const version = new Date(file.updated_at).getTime();
      assets[key] = `${publicUrl}?v=${version}`;
    }

    return assets;
  } catch (err) {
    console.error('Exceção ao buscar assets da landing page:', err);
    return {};
  }
}

export function useLandingAssets() {
  const [assets, setAssets] = useState({});
  const [loading, setLoading] = useState(true);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    const data = await fetchLandingAssets();
    setAssets(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  return { assets, loading, reload: loadAssets };
}
