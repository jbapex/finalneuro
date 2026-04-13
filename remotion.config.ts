import path from 'node:path';
import { Config } from '@remotion/cli/config';

/**
 * Alinha o bundler do Remotion Studio com o alias `@` do Vite (`@/` → `src/`).
 * @see https://www.remotion.dev/docs/typescript-aliases
 */
Config.overrideWebpackConfig((config) => {
  const alias = config.resolve?.alias;
  const base =
    alias && typeof alias === 'object' && !Array.isArray(alias)
      ? { ...(alias as Record<string, string>) }
      : {};
  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...base,
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
  };
});
