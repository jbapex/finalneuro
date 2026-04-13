/**
 * Resolve a chave de logo (OpenAI, Gemini, …) a partir de uma conexão de IA,
 * alinhado ao Chat IA: usa default_model + provider para acertar a marca mesmo via OpenRouter.
 */

const LOGO_PROVIDER_KEYS = ['OpenAI', 'Gemini', 'Claude', 'Grok', 'Groq', 'Mistral', 'OpenRouter'];

const PROVIDER_ALIASES = { Google: 'Gemini', Anthropic: 'Claude' };

export function getLogoKeyFromIntegration(integration) {
  if (!integration) return null;
  const model = String(integration.default_model || '').toLowerCase();
  const provider = String(integration.provider || '').trim();
  if (model.includes('gpt') || model.startsWith('o1')) return 'OpenAI';
  if (model.includes('claude')) return 'Claude';
  if (model.includes('gemini')) return 'Gemini';
  if (model.includes('grok')) return 'Grok';
  if (model.includes('mixtral')) return 'Mistral';
  if (model.includes('llama')) return 'Groq';
  const p =
    PROVIDER_ALIASES[provider] ||
    LOGO_PROVIDER_KEYS.find((k) => k.toLowerCase() === provider.toLowerCase()) ||
    provider;
  return p || null;
}

/** @param {Record<string, string>} logosMap — ex.: linhas de `llm_logos` indexadas por `provider` */
export function getLogoUrlForIntegration(logosMap, integration) {
  if (!logosMap) return null;
  const key = getLogoKeyFromIntegration(integration);
  return key ? logosMap[key] || null : null;
}
