import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscrição síncrona a matchMedia — evita o primeiro render com valor errado
 * (ex.: `false` até o useEffect correr), que trocava o Select entre Drawer e Radix
 * e gerava "removeChild: o nó não é filho deste nó" ao abrir Minha IA / colar API key.
 */
export const useMediaQuery = (query) => {
  const subscribe = useCallback((onStoreChange) => {
    if (typeof window === 'undefined') return () => {};
    const media = window.matchMedia(query);
    media.addEventListener('change', onStoreChange);
    return () => media.removeEventListener('change', onStoreChange);
  }, [query]);

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
