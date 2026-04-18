/**
 * Cliente LLM/imagem só para o Carrossel NeuroDesign — chamadas HTTP diretas com a chave
 * da conexão do utilizador (sem reutilizar Edge Functions existentes).
 */

import {
  resolveCarrosselCanvasFormat,
  CARROSSEL_TWITTER_IA_MAX_TITULO_CHARS,
  CARROSSEL_TWITTER_IA_MAX_SUBTITULO_CHARS,
  CARROSSEL_TWITTER_IA_DEFAULT_TITULO_TAMANHO,
} from './carrosselSlideModel.js';

/**
 * Roteiro editorial carrossel estilo X (adapta ao número de slides).
 * Inspirado em: 1 gancho → miolo prático → (com 4+ slides) slide 3 pede curtir/salvar → último convida a comentar.
 */
function buildTwitterCarouselArchetypeGuide(slideCount) {
  const n = Math.max(1, Math.min(20, Math.floor(Number(slideCount) || 1)));
  const lines = [];
  lines.push(
    `ARQUÉTIPO DO CARROSSEL (${n} slides) — respeite o PAPEL de cada posição na sequência; varie formulações e evite repetir a mesma estrutura em todos os slides.`
  );
  lines.push(
    '- Slide 1: Headline instigante com copywriting. A primeira frase de "titulo" é obrigatoriamente o gancho mais forte; depois 1–2 frases que prendem no tema.'
  );
  if (n === 1) {
    lines.push(
      '- Slide único: condense gancho + um insight prático + CTA leve (curtir, salvar ou comentar) no mesmo texto, dentro do limite de caracteres.'
    );
    return lines.join('\n');
  }
  const last = n;
  /** Pedido dedicado a curtir/salvar só quando existe fecho depois (há slide 4). */
  const likeSlideIndex = n >= 4 ? 3 : null;

  if (n === 2) {
    lines.push(
      '- Slide 2: Conteúdo prático condensado + fecho com convite a comentar ou opinar; pode incluir um pedido leve para curtir/salvar numa frase, tom humano.'
    );
    return lines.join('\n');
  }

  for (let i = 2; i < last; i++) {
    if (likeSlideIndex !== null && i === likeSlideIndex) {
      lines.push(
        `- Slide ${i}: Engajamento social — peça natural para curtir o post, salvar ou compartilhar (tom conversa; evite clichês vazios e 'meta de likes').`
      );
    } else {
      lines.push(
        `- Slide ${i}: Conteúdo prático e visual em texto — dado, passo mental, consequência, comparativo ou cena que o leitor visualiza; um foco claro por slide.`
      );
    }
  }

  lines.push(
    `- Slide ${last}: Convite para o público comentar — pergunta aberta, 'você faria X ou Y?', opções A/B, ou provocação de opinião. Priorize resposta nos comentários; não repita o pedido de curtir do slide do meio.`
  );
  return lines.join('\n');
}

function normalizeChatCompletionsUrl(apiUrl) {
  const u = String(apiUrl || '').trim().replace(/\/$/, '');
  if (!u) return '';
  if (u.includes('/chat/completions')) return u;
  if (u.endsWith('/v1')) return `${u}/chat/completions`;
  return `${u}/chat/completions`;
}

function isAnthropicProvider(provider, apiUrl) {
  const p = String(provider || '').toLowerCase();
  const u = String(apiUrl || '').toLowerCase();
  return p.includes('claude') || p.includes('anthropic') || u.includes('anthropic.com');
}

function isGoogleProvider(provider, apiUrl) {
  const p = String(provider || '').toLowerCase();
  const u = String(apiUrl || '').toLowerCase();
  return p === 'google' || p.includes('gemini') || u.includes('generativelanguage.googleapis.com');
}

function isOpenRouterProvider(provider, apiUrl) {
  const pv = String(provider || '').toLowerCase();
  const au = String(apiUrl || '').toLowerCase();
  return pv.includes('openrouter') || au.includes('openrouter.ai');
}

/** URL chat/completions para OpenRouter (imagem + texto via `modalities`). */
function resolveOpenRouterChatCompletionsUrl(apiUrl) {
  let u = String(apiUrl || '').trim().replace(/\/$/, '');
  if (!u || !u.toLowerCase().includes('openrouter')) {
    u = 'https://openrouter.ai/api/v1';
  }
  return normalizeChatCompletionsUrl(u);
}

/** Modelos só-imagem (Flux, etc.) exigem `modalities: ['image']` na API OpenRouter. */
function openRouterImageModalities(modelId) {
  const m = String(modelId || '').toLowerCase();
  if (
    m.includes('flux') ||
    m.includes('riverflow') ||
    m.includes('sourceful') ||
    m.includes('/flux') ||
    m.includes('ideogram') ||
    m.includes('playground') ||
    m.includes('dall-e') ||
    m.includes('gpt-image')
  ) {
    return ['image'];
  }
  return ['image', 'text'];
}

function extractDataUrlFromOpenRouterMessage(message) {
  const images = message?.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  const url = first?.image_url?.url ?? first?.imageUrl?.url;
  if (typeof url === 'string' && url.startsWith('data:')) return url;
  return null;
}

/** Data URL de imagem válida para anexar no pedido OpenRouter (image_url). */
function subjectFaceDataUrlForOpenRouter(dataUrl) {
  const s = String(dataUrl || '').trim();
  if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(s)) return '';
  return s.length > 120 ? s : '';
}

/** Conexão API Google (Gemini) nativa — não confundir com rosto+OpenRouter; para UI de rosto use {@link isCarrosselSubjectFaceMultimodalOk}. */
export function isCarrosselGeminiImageConnection(provider, apiUrl = '') {
  return isGoogleProvider(provider, apiUrl);
}

/** Conexão OpenRouter (URL ou nome do provider) — geração de imagem via chat/completions + modalities. */
export function isCarrosselOpenRouterImageConnection(provider, apiUrl = '') {
  return isOpenRouterProvider(provider, apiUrl);
}

/** Fundo panorâmico contínuo: API nativa Gemini ou OpenRouter com modelo de saída imagem. */
export function isCarrosselPanoramaCapableImageConnection(provider, apiUrl = '') {
  return isGoogleProvider(provider, apiUrl) || isOpenRouterProvider(provider, apiUrl);
}

/**
 * Foto de rosto + prompt na mesma chamada (multimodal): Gemini nativo ou OpenRouter
 * (chat com `image_url` + texto; exige modelo com saída imagem).
 */
export function isCarrosselSubjectFaceMultimodalOk(provider, apiUrl = '') {
  return isGoogleProvider(provider, apiUrl) || isOpenRouterProvider(provider, apiUrl);
}

/**
 * Valida `imageConfig.imageSize` do Gemini para o carrossel.
 * @param {unknown} raw
 * @returns {'1K'|'2K'|'4K'}
 */
export function normalizeCarrosselGeminiImageSize(raw) {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (s === '1K' || s === '2K' || s === '4K') return s;
  return '2K';
}

/** Mesma ideia do NeuroDesign Google (`SUBJECT_FACE_INSTRUCTION`). */
const CAROUSEL_SUBJECT_FACE_PREFIX =
  'Obrigatório: use sempre o rosto e a identidade da pessoa da imagem anexada como rosto na imagem gerada. Mantenha a mesma pessoa. ';

function parseDataUrlToGeminiInline(dataUrl) {
  const s = String(dataUrl || '').trim();
  const m = s.match(/^data:([\w/+.-]+);base64,(.+)$/i);
  if (!m || !m[2]) return null;
  const mime = m[1].toLowerCase();
  if (!mime.startsWith('image/')) return null;
  const data = m[2].replace(/\s/g, '');
  if (data.length < 80) return null;
  return { mimeType: mime, data };
}

/** Base URL para Gemini generateContent (igual ao NeuroDesign Google). */
function normalizeGoogleImageApiBase(apiUrl) {
  let u = String(apiUrl || '').trim().replace(/\/$/, '');
  if (!u) return 'https://generativelanguage.googleapis.com/v1beta';
  if (u.includes('generativelanguage.googleapis.com')) {
    if (u.includes('/v1beta')) return u;
    return `${u}/v1beta`;
  }
  return u;
}

function normalizeGeminiImageModelId(model) {
  let m = String(model || '').trim();
  if (m.toLowerCase().startsWith('models/')) m = m.slice('models/'.length);
  return m || 'gemini-2.5-flash-image';
}

export async function fetchUserAiConnectionForCarrossel(supabase, connectionId) {
  if (!connectionId) return { data: null, error: new Error('Sem conexão') };
  const { data, error } = await supabase
    .from('user_ai_connections')
    .select('id, name, provider, default_model, api_key, api_url, capabilities')
    .eq('id', connectionId)
    .maybeSingle();
  if (error) return { data: null, error };
  if (!data?.api_key) return { data: null, error: new Error('Conexão sem chave API') };
  return { data, error: null };
}

/**
 * @returns {Promise<{ text: string, error: Error|null }>}
 */
export async function carrosselLlmCompleteText({ supabase, connectionId, userPrompt }) {
  const { data: conn, error: fetchErr } = await fetchUserAiConnectionForCarrossel(supabase, connectionId);
  if (fetchErr || !conn) return { text: '', error: fetchErr || new Error('Conexão inválida') };

  const model = conn.default_model || 'gpt-4o-mini';
  const apiKey = conn.api_key.trim();
  const apiUrl = conn.api_url || '';

  try {
    if (isAnthropicProvider(conn.provider, apiUrl)) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: String(model).toLowerCase().includes('claude') ? model : 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { text: '', error: new Error(body?.error?.message || body?.message || res.statusText) };
      }
      const blocks = body?.content;
      const textBlock = Array.isArray(blocks) ? blocks.find((b) => b.type === 'text') : null;
      const text = textBlock?.text || '';
      return { text, error: null };
    }

    if (isGoogleProvider(conn.provider, apiUrl)) {
      let mid = String(model).replace(/^models\//, '');
      if (!mid) mid = 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mid)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { text: '', error: new Error(body?.error?.message || res.statusText) };
      }
      const parts = body?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts) ? parts.map((p) => p.text || '').join('') : '';
      return { text, error: null };
    }

    const chatUrl = normalizeChatCompletionsUrl(apiUrl);
    if (!chatUrl) return { text: '', error: new Error('api_url inválida') };

    const res = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 4096,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { text: '', error: new Error(body?.error?.message || body?.message || res.statusText) };
    }
    const text = body?.choices?.[0]?.message?.content || '';
    return { text, error: null };
  } catch (e) {
    return { text: '', error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Completion de texto com imagem (multimodal).
 * Usa a conexão LLM configurada pelo usuário (OpenRouter, Gemini, etc).
 * Retorna { text, error }.
 */
export async function carrosselLlmCompleteTextWithImage({
  supabase,
  connectionId,
  userPrompt,
  imageBase64,
  imageMediaType = 'image/jpeg',
}) {
  const { data: conn, error: fetchErr } = await fetchUserAiConnectionForCarrossel(supabase, connectionId);
  if (fetchErr || !conn) return { text: '', error: fetchErr || new Error('Conexão inválida') };

  const model = conn.default_model || 'gpt-4o-mini';
  const apiKey = conn.api_key.trim();
  const apiUrl = conn.api_url || '';
  const cleanBase64 = String(imageBase64 || '').trim();
  if (!cleanBase64) return { text: '', error: new Error('Imagem base64 ausente') };
  const dataUrl = `data:${String(imageMediaType || 'image/jpeg').trim()};base64,${cleanBase64}`;

  try {
    if (isAnthropicProvider(conn.provider, apiUrl)) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: String(model).toLowerCase().includes('claude') ? model : 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: String(imageMediaType || 'image/jpeg').trim(),
                    data: cleanBase64,
                  },
                },
                { type: 'text', text: userPrompt },
              ],
            },
          ],
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { text: '', error: new Error(body?.error?.message || body?.message || res.statusText) };
      }
      const blocks = body?.content;
      const textBlock = Array.isArray(blocks) ? blocks.find((b) => b.type === 'text') : null;
      const text = textBlock?.text || '';
      return { text, error: null };
    }

    if (isGoogleProvider(conn.provider, apiUrl)) {
      let mid = String(model).replace(/^models\//, '');
      if (!mid) mid = 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mid)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const inline = parseDataUrlToGeminiInline(dataUrl);
      if (!inline) return { text: '', error: new Error('Imagem inválida para Gemini') };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: inline.mimeType, data: inline.data } },
                { text: userPrompt },
              ],
            },
          ],
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { text: '', error: new Error(body?.error?.message || res.statusText) };
      }
      const parts = body?.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts) ? parts.map((p) => p.text || '').join('') : '';
      return { text, error: null };
    }

    const chatUrl = normalizeChatCompletionsUrl(apiUrl);
    if (!chatUrl) return { text: '', error: new Error('api_url inválida') };
    const openRouterImageUrl = subjectFaceDataUrlForOpenRouter(dataUrl) || dataUrl;

    const res = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: openRouterImageUrl },
              },
              {
                type: 'text',
                text: userPrompt,
              },
            ],
          },
        ],
        max_tokens: 4096,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { text: '', error: new Error(body?.error?.message || body?.message || res.statusText) };
    }
    const text = body?.choices?.[0]?.message?.content || '';
    return { text, error: null };
  } catch (e) {
    return { text: '', error: e instanceof Error ? e : new Error(String(e)) };
  }
}

function cleanStandaloneImagePrompt(raw) {
  let t = String(raw || '').trim();
  t = t.replace(/^```(?:\w+)?\s*/i, '').replace(/\s*```$/i, '').trim();
  t = t.replace(/^["']+|["']+$/g, '').trim();
  return t;
}

/**
 * Bloco injetado no pedido ao LLM de direção de arte (pessoas vs. só visual).
 * @param {'auto' | 'people' | 'visual'} pref
 */
export function carrosselImageHumanPreferenceLlmBlock(pref) {
  switch (pref) {
    case 'people':
      return `

PREFERÊNCIA OBRIGATÓRIA DO UTILIZADOR — PESSOAS NA IMAGEM: o prompt final em inglês DEVE descrever uma cena com pessoa(s), rosto ou figura humana visível e expressiva quando o tema permitir; só evite humanos se o assunto do slide for incompatível.`;
    case 'visual':
      return `

PREFERÊNCIA OBRIGATÓRIA DO UTILIZADOR — APENAS VISUAL (ZERO PESSOAS): o prompt final em inglês é ESTRITAMENTE sem seres humanos. PROIBIDO: pessoas, rostos, silhuetas reconhecíveis de humanos, mãos, pés, corpo, multidão, retrato, modelo, influencer. SÓ é permitido: ambiente vazio ou sem figuras humanas, objetos, natureza, tecnologia, arquitetura, luz, sombra, textura, paisagem, interior sem ninguém, abstração. Se o tema parecer exigir humano, traduza para metáfora visual sem pessoas (ex.: cadeira vazia, luz na mesa, cidade ao entardecer sem figuras).`;
    default:
      return `

PREFERÊNCIA DO UTILIZADOR — AUTOMÁTICO: pode incluir ou não pessoas — escolha o que for mais forte para o slide e o carrossel.`;
  }
}

/**
 * Usa o LLM de texto para produzir um prompt de imagem em inglês antes do gerador (Gemini/DALL·E).
 * @returns {Promise<{ imagePrompt: string|null, error: Error|null }>}
 */
export async function carrosselBuildImagePromptWithLlm({
  supabase,
  connectionId,
  fullPromptBody,
  slideIndex,
  totalSlides,
  titulo,
  subtitulo,
  humanPreference = 'auto',
  /** Bloco opcional (paleta HEX, mood) anexado ao contexto. */
  paletteBlock = '',
  /** Se true (ex.: slide 1), instrui capa de máximo impacto no feed. */
  coverMode = false,
}) {
  const prefBlock = carrosselImageHumanPreferenceLlmBlock(humanPreference);
  const passo2Batch =
    humanPreference === 'visual'
      ? '2. Use SOMENTE elementos não humanos: ambiente sem pessoas, objetos, natureza, tecnologia, arquitetura, luz ou abstração — proibido qualquer pessoa ou rosto'
      : humanPreference === 'people'
        ? '2. Privilegie imagem com figura(s) humana(s) expressiva(s) quando o tema permitir; caso contrário objeto ou cena forte'
        : '2. Decida o tipo de imagem: pessoa/rosto, objeto, ambiente, natureza, tecnologia, arquitetura, etc. — o que for mais forte para o slide';
  const capaBlock =
    coverMode && slideIndex === 0
      ? `

--- SLIDE_DE_CAPA (PRIMEIRO_SLIDE) ---
Este slide é a CAPA do carrossel no Instagram. O prompt em inglês deve descrever UMA cena fotorrealista de impacto máximo no feed: composição memorável, luz cinematográfica, metáfora visual forte ou objeto/ambiente icónico; coerente com o título. Evite composição genérica ou “stock vazio”.
`
      : '';
  const paleta = String(paletteBlock || '').trim();

  const promptParaLlm = `Você é um diretor de arte especialista em fotografia editorial e cinematográfica para redes sociais.

Analise o conteúdo abaixo e crie o melhor prompt de geração de imagem possível.

CONTEXTO GERAL DO CARROSSEL:
${fullPromptBody}${paleta ? `\n${paleta}` : ''}${capaBlock}

SLIDE ${slideIndex + 1} DE ${totalSlides}:
Título: "${titulo}"
Conteúdo: "${subtitulo}"
${prefBlock}

Sua tarefa:
1. Entenda o que este slide está comunicando
${passo2Batch}
3. Escreva um prompt de imagem fotorrealista em inglês, detalhado, cinematográfico

Retorne APENAS o prompt de imagem em inglês, sem explicações, sem aspas, sem markdown. O prompt deve:
- Descrever UMA única cena fotorrealista cobrindo o frame inteiro
- Ter iluminação dramática e cinematográfica
- Ser coerente com o tema e emoção do slide
- Terminar sempre com: vertical 4:5 format, no text, no graphics, photorealistic, cinematic, high resolution`;

  const { text, error } = await carrosselLlmCompleteText({ supabase, connectionId, userPrompt: promptParaLlm });
  if (error) return { imagePrompt: null, error };
  const cleaned = cleanStandaloneImagePrompt(text);
  if (!cleaned || cleaned.length < 32) return { imagePrompt: null, error: null };
  return { imagePrompt: cleaned, error: null };
}

/**
 * Prompt de imagem para um slide ativo, com lista de todos os slides e contexto do carrossel.
 * @returns {Promise<{ imagePrompt: string|null, error: Error|null }>}
 */
export async function carrosselBuildSingleSlideImagePromptWithLlm({
  supabase,
  connectionId,
  fullPromptBody,
  iaPrompt,
  slides,
  activeSlideIndex,
  titulo,
  subtitulo,
  imgGenPromptExtra,
  humanPreference = 'auto',
  paletteBlock = '',
  coverMode = false,
}) {
  const contexto =
    String(fullPromptBody || '').trim() || String(iaPrompt || '').trim() || '(sem contexto explícito)';
  const list = Array.isArray(slides) ? slides : [];
  const todosOsSlides = list
    .map((s, idx) => `Slide ${idx + 1}: "${String(s?.titulo ?? '')}" — ${String(s?.subtitulo ?? '')}`)
    .join('\n');
  const extraInstr = imgGenPromptExtra?.trim()
    ? `\nInstrução adicional do usuário: ${imgGenPromptExtra.trim()}`
    : '';
  const prefBlock = carrosselImageHumanPreferenceLlmBlock(humanPreference);
  const passo2Visual =
    humanPreference === 'visual'
      ? '2. Escolha APENAS visual sem humanos: objeto, ambiente vazio, natureza, tecnologia, arquitetura, luz, textura ou abstração — nunca pessoa, rosto ou silhueta humana'
      : humanPreference === 'people'
        ? '2. Decida o visual mais impactante privilegiando figura(s) humana(s) expressiva(s) quando o tema permitir — ou objeto/cena forte se o slide exigir'
        : '2. Decida o visual mais impactante — pessoa, objeto, cena de ambiente, fenômeno natural, tecnologia, espaço, arquitetura, abstrato, etc.';

  const paleta = String(paletteBlock || '').trim();
  const capaBlock =
    coverMode && activeSlideIndex === 0
      ? `

--- SLIDE_DE_CAPA ---
É o primeiro slide (capa). Privilegie impacto máximo no feed: cena memorável, luz dramática, metáfora visual ou ambiente icónico; coerente com o tema. Evite visual genérico.
`
      : '';

  const promptParaLlm = `Você é um diretor de arte especialista em fotografia cinematográfica para redes sociais.

CONTEXTO DO CLIENTE E CARROSSEL:
${contexto}${paleta ? `\n${paleta}` : ''}${capaBlock}

TODOS OS SLIDES DO CARROSSEL:
${todosOsSlides}

SLIDE QUE PRECISA DE IMAGEM (slide ${activeSlideIndex + 1}):
Título: "${titulo}"
Conteúdo: "${subtitulo}"${extraInstr}
${prefBlock}

Sua tarefa:
1. Entenda o tema geral do carrossel e o papel específico deste slide
${passo2Visual}
3. Crie um prompt de imagem fotorrealista em inglês, detalhado e cinematográfico

Retorne APENAS o prompt em inglês, sem explicações, sem aspas, sem markdown.
O prompt deve descrever UMA única cena cobrindo o frame inteiro, com iluminação dramática, sem texto, sem gráficos, proporção vertical 4:5.`;

  const { text, error } = await carrosselLlmCompleteText({ supabase, connectionId, userPrompt: promptParaLlm });
  if (error) return { imagePrompt: null, error };
  const cleaned = cleanStandaloneImagePrompt(text);
  if (!cleaned || cleaned.length < 32) return { imagePrompt: null, error: null };
  return { imagePrompt: cleaned, error: null };
}

/**
 * Um único prompt de imagem panorâmica para N slides 4:5 com o mesmo fundo contínuo.
 * @returns {Promise<{ imagePrompt: string|null, error: Error|null }>}
 */
export async function carrosselBuildPanoramaImagePromptWithLlm({
  supabase,
  connectionId,
  fullPromptBody,
  slides,
  humanPreference = 'auto',
}) {
  const list = Array.isArray(slides) ? slides : [];
  const n = list.length;
  if (n < 2) return { imagePrompt: null, error: new Error('Panorama precisa de pelo menos 2 slides') };

  const todosOsPainéis = list
    .map(
      (s, idx) =>
        `Faixa ${idx + 1} (esquerda→direita): título "${String(s?.titulo ?? '')}" — ${String(s?.subtitulo ?? '').slice(0, 280)}`
    )
    .join('\n');

  const prefBlock = carrosselImageHumanPreferenceLlmBlock(humanPreference);
  const passo2 =
    humanPreference === 'visual'
      ? '2. Cena SEM qualquer pessoa, rosto ou figura humana — só ambiente, objetos, natureza, tecnologia, arquitetura ou abstração'
      : humanPreference === 'people'
        ? '2. Inclua figura(s) humana(s) de forma coerente na cena larga quando o tema permitir; a continuidade do rosto/corpo pode atravessar faixas adjacentes'
        : '2. Decida se inclui ou não humanos — o importante é uma cena única e fluida em toda a largura';

  const promptParaLlm = `Você é um diretor de arte especialista em fotografia cinematográfica para Instagram.

CONTEXTO DO CARROSSEL:
${String(fullPromptBody || '').trim()}

MODO PANORAMA: uma única imagem FOTOGRÁFICA horizontal larga (wide 16:9) será depois dividida em ${n} partes verticais iguais (como ${n} slides 4:5 lado a lado). O utilizador desliza o carrossel e vê cada fatia — a imagem deve parecer UM plano contínuo, sem grelha, sem molduras, sem linhas a separar painéis.

ROTEIRO POR FAIXA (da esquerda para a direita — inspire a composição, sem desenhar painéis):
${todosOsPainéis}
${prefBlock}

Sua tarefa:
1. Imagine UMA cena única que evolui suavemente da esquerda à direita e cobre todas as ideias dos slides
${passo2}
3. Escreva UM prompt de geração em inglês, fotorrealista, cinematográfico, iluminação dramática

Retorne APENAS o prompt em inglês, sem markdown. O prompt deve pedir explicitamente:
- single continuous wide horizontal photograph, seamless left-to-right flow
- wide 16:9 aspect, no text, no logos, no graphics, no split-screen, no collage grid
- photorealistic, cinematic, high resolution`;

  const { text, error } = await carrosselLlmCompleteText({ supabase, connectionId, userPrompt: promptParaLlm });
  if (error) return { imagePrompt: null, error };
  const cleaned = cleanStandaloneImagePrompt(text);
  if (!cleaned || cleaned.length < 32) return { imagePrompt: null, error: null };
  return { imagePrompt: cleaned, error: null };
}

/** Remove vírgulas finais antes de } ou ] (comum em respostas de alguns modelos). */
function stripTrailingCommasInJson(jsonStr) {
  return String(jsonStr || '').replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Extrai e faz parse de JSON devolvido por LLMs (Claude Haiku costuma acrescentar texto ou fences).
 */
function parseJsonFromLlmText(raw) {
  let t = String(raw || '').trim().replace(/^\uFEFF/, '');
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  const sliced = start >= 0 && end > start ? t.slice(start, end + 1) : t;
  const normalized = stripTrailingCommasInJson(sliced);
  try {
    return JSON.parse(normalized);
  } catch (firstErr) {
    // Alguns modelos (ex.: Haiku) inserem quebras de linha literais dentro de strings JSON.
    const compact = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const collapsed = compact.replace(/\n/g, ' ');
    try {
      return JSON.parse(collapsed);
    } catch {
      throw firstErr;
    }
  }
}

export async function carrosselLlmGenerateSlidesJson({ supabase, connectionId, iaPrompt, slideCount }) {
  const userPrompt = `Você é um copywriter especialista em carrosséis virais para Instagram. Crie exatamente ${slideCount} slides de alto impacto.

Tema/contexto: "${iaPrompt}"

Retorne APENAS um objeto JSON (começando com { e terminando com }), sem markdown, sem texto antes ou depois, sem explicação:
{"slides":[{"titulo":"...","subtitulo":"...","cantoSupDir":"...","layoutPosicao":"...","tituloTamanho":90},...]}

CRÍTICO — JSON VÁLIDO (obrigatório para qualquer modelo, incl. Claude Haiku):
- Cada valor de "titulo" e "subtitulo" deve ser UMA string JSON numa única linha: NUNCA use Enter/quebra de linha real dentro das aspas.
- Não use o carácter " (aspas duplas) dentro do texto de titulo ou subtitulo; use ' (aspas simples) se precisar citar.
- Não use vírgula após o último campo de um objeto ou do último item de um array.

ESTRUTURA OBRIGATÓRIA:

Slide 1 — GANCHO:
- titulo: pergunta provocadora ou afirmação de choque. Máx 6 palavras. Letras maiúsculas. SEM ponto final.
- subtitulo: 1 frase curta que amplifica o gancho e gera curiosidade. Máx 12 palavras.
- layoutPosicao: "inf-esq"
- tituloTamanho: 110

Slides 2 até ${slideCount - 1} — CONTEÚDO (um problema ou insight por slide):
- titulo: afirmação direta, pergunta ou dado. Entre 4 e 8 palavras. Pode ter letras maiúsculas.
- subtitulo: ESCREVA BASTANTE num ÚNICO parágrafo (mesma string, sem quebras de linha). Entre 3 e 5 frases separadas por ponto final e espaço. Seja específico, use exemplos, dados e consequências. Mínimo 60 palavras. Não use \\n nem parágrafos separados — isso quebra o JSON.
- layoutPosicao: variar entre "sup-esq", "meio-esq", "inf-esq" — nunca igual ao slide anterior
- tituloTamanho: variar entre 72, 85, 95 — nunca igual ao slide anterior

Slide ${slideCount} — CTA:
- titulo: ação clara e urgente. Máx 5 palavras.
- subtitulo: 2 frases — benefício de agir agora + instrução clara (ex: "Siga o perfil", "Compartilhe com quem precisa").
- layoutPosicao: "sup-esq"
- tituloTamanho: 95

REGRAS GERAIS:
- cantoSupDir: nicho em maiúsculas (ex: "GESTÃO DE REDES", "TRÁFEGO PAGO")
- Português brasileiro, tom direto e sem enrolação
- Títulos que param o scroll — escreva como se o leitor fosse ignorar se não for impactante
- Subtítulos dos slides de conteúdo devem ser LONGOS e RICOS — este é o diferencial do carrossel
- Nunca repita estrutura de frase em títulos consecutivos`;

  const { text, error } = await carrosselLlmCompleteText({ supabase, connectionId, userPrompt });
  if (error) return { slides: null, error };
  try {
    const parsed = parseJsonFromLlmText(text);
    if (!parsed?.slides?.length) return { slides: null, error: new Error('Resposta inválida da IA') };
    return { slides: parsed.slides, error: null };
  } catch (e) {
    return { slides: null, error: e instanceof Error ? e : new Error('JSON inválido') };
  }
}

/**
 * Geração de texto para carrossel estilo post X/Twitter (cabeçalho verificado + @handle + corpo longo + thumbnail 16:9 vazia no editor).
 */
export async function carrosselLlmGenerateSlidesJsonTwitter({ supabase, connectionId, iaPrompt, slideCount }) {
  const archetype = buildTwitterCarouselArchetypeGuide(slideCount);
  const userPrompt = `Você é copywriter especialista em threads e carrosséis no formato X (Twitter) / Instagram: cada slide tem só o CORPO do post (campo principal) e uma linha extra opcional. O cabeçalho (nome verificado, @handle, descrição curta no cartão) é editado à parte pelo utilizador — NÃO o invente nem devolva no JSON.

Tema/contexto: "${iaPrompt}"

Retorne APENAS um objeto JSON (começando com { e terminando com }), sem markdown, sem texto antes ou depois:
{"slides":[{"titulo":"...","subtitulo":"..."},...]}

CRÍTICO — JSON VÁLIDO:
- Cada valor string numa única linha: NUNCA quebra de linha real dentro das aspas.
- Não use " (aspas duplas) dentro do texto; use ' se precisar citar.
- Sem vírgula após o último campo de um objeto ou do último item do array.

${archetype}

MICRO-HEADLINE EM CADA SLIDE:
- Em todo slide, a primeira frase de "titulo" deve funcionar como abertura forte alinhada ao papel do slide (no slide de curtir pode ser transição humana; no último, abra já a pergunta ou tensão para comentários).

LIMITES DE CARACTERES (obrigatório — referência visual com miniatura 16:9 em baixo; texto longo corta o layout):
- "titulo": no máximo ${CARROSSEL_TWITTER_IA_MAX_TITULO_CHARS} caracteres por slide (inclui espaços). Conte antes de devolver. Prefira ~180–247 quando couber a ideia toda.
- "subtitulo": no máximo ${CARROSSEL_TWITTER_IA_MAX_SUBTITULO_CHARS} caracteres, ou "".

Campos por slide — exatamente ${slideCount} itens em "slides":
- "titulo": parágrafo corrido (várias frases, ponto final entre frases). Português brasileiro, direto.
- "subtitulo": segunda linha opcional (reforço, dado, lembrete ou eco do gancho). PROIBIDO hashtags e #; pode ser "".

Opcional por slide (inteiro ou omita): "tituloTamanho" entre 30 e 50 (px; corpo legível sem dominar o slide; ~${CARROSSEL_TWITTER_IA_DEFAULT_TITULO_TAMANHO} é neutro).

Não inclua outros campos (nada de badge, handle, nome de perfil, etc.).`;

  const { text, error } = await carrosselLlmCompleteText({ supabase, connectionId, userPrompt });
  if (error) return { slides: null, error };
  try {
    const parsed = parseJsonFromLlmText(text);
    if (!parsed?.slides?.length) return { slides: null, error: new Error('Resposta inválida da IA') };
    return { slides: parsed.slides, error: null };
  } catch (e) {
    return { slides: null, error: e instanceof Error ? e : new Error('JSON inválido') };
  }
}

export async function carrosselLlmImproveSlidesJson({ supabase, connectionId, improvePrompt, slides }) {
  const slidesTexto = slides
    .map((s, i) => `Slide ${i + 1}: Título: "${s.titulo}" | Subtítulo: "${s.subtitulo}"`)
    .join('\n');
  const userPrompt = `Melhore o conteúdo deste carrossel do Instagram seguindo esta instrução: "${improvePrompt}"
Conteúdo atual:
${slidesTexto}
Retorne APENAS um objeto JSON (só { ... }), sem markdown, sem texto extra.
{"slides":[{"titulo":"...","subtitulo":"..."},...]}
Mantenha exatamente ${slides.length} slides na mesma ordem.
CRÍTICO: titulo e subtitulo numa linha por campo; sem aspas duplas dentro do texto; sem vírgulas finais; sem quebra de linha real dentro das strings.`;

  const { text, error } = await carrosselLlmCompleteText({ supabase, connectionId, userPrompt });
  if (error) return { slides: null, error };
  try {
    const parsed = parseJsonFromLlmText(text);
    if (!parsed?.slides?.length) return { slides: null, error: new Error('Resposta inválida') };
    return { slides: parsed.slides, error: null };
  } catch (e) {
    return { slides: null, error: e instanceof Error ? e : new Error('JSON inválido') };
  }
}

export async function carrosselLlmImproveSlidesJsonTwitter({ supabase, connectionId, improvePrompt, slides }) {
  const slidesTexto = slides
    .map((s, i) => `Slide ${i + 1}: corpo (titulo): "${s.titulo}" | linha extra (subtitulo): "${s.subtitulo}"`)
    .join('\n');
  const archetype = buildTwitterCarouselArchetypeGuide(slides.length);
  const userPrompt = `Melhore este carrossel no FORMATO X/Twitter. Só o CORPO do post (titulo) e a linha extra (subtitulo) vêm da IA; cabeçalho do perfil (nome, @, descrição curta) NÃO deve ser alterado — não peça nem devolva esses campos.

${archetype}

Instrução: "${improvePrompt}"
Conteúdo atual:
${slidesTexto}
Retorne APENAS JSON {"slides":[{"titulo":"...","subtitulo":"..."},...]} — cada slide só titulo e subtitulo (opcional tituloTamanho 30–50). O subtitulo não deve conter hashtags nem #.
Reorganize o texto se precisar para cada slide cumprir o papel acima; primeira frase de cada titulo = micro-headline alinhada ao slide. LIMITES: titulo no máximo ${CARROSSEL_TWITTER_IA_MAX_TITULO_CHARS} caracteres por slide; subtitulo no máximo ${CARROSSEL_TWITTER_IA_MAX_SUBTITULO_CHARS}.
Mantenha exatamente ${slides.length} slides na mesma ordem.
CRÍTICO: strings numa linha; sem aspas duplas dentro do texto; sem vírgulas finais; sem quebra de linha real dentro das strings.`;

  const { text, error } = await carrosselLlmCompleteText({ supabase, connectionId, userPrompt });
  if (error) return { slides: null, error };
  try {
    const parsed = parseJsonFromLlmText(text);
    if (!parsed?.slides?.length) return { slides: null, error: new Error('Resposta inválida') };
    return { slides: parsed.slides, error: null };
  } catch (e) {
    return { slides: null, error: e instanceof Error ? e : new Error('JSON inválido') };
  }
}

export async function carrosselLlmRefineOneSlide({ supabase, connectionId, instruction, titulo, subtitulo }) {
  const userPrompt = `Reescreva apenas este slide de carrossel Instagram seguindo: "${instruction}"
Título atual: "${titulo}"
Subtítulo atual: "${subtitulo}"
Retorne APENAS JSON numa linha: {"titulo":"...","subtitulo":"..."}
Sem aspas duplas dentro dos textos; sem quebra de linha dentro das strings.
Português brasileiro.`;

  const { text, error } = await carrosselLlmCompleteText({ supabase, connectionId, userPrompt });
  if (error) return { titulo: null, subtitulo: null, error };
  try {
    const parsed = parseJsonFromLlmText(text);
    return {
      titulo: parsed.titulo ?? titulo,
      subtitulo: parsed.subtitulo ?? subtitulo,
      error: null,
    };
  } catch (e) {
    return { titulo: null, subtitulo: null, error: e instanceof Error ? e : new Error('JSON inválido') };
  }
}

function buildCarrosselImageApiRulesPanorama(humanPreference = 'auto', slideCount = 2) {
  const n = Math.max(2, Math.floor(Number(slideCount) || 2));
  const commonTail =
    `formato largo horizontal 16:9 (uma imagem wide); a composição deve fluir continuamente da esquerda à direita como se fosse depois cortada em ${n} fatias verticais iguais para um carrossel — sem linhas divisórias visíveis, sem grelha, sem collage, sem múltiplos painéis. ` +
    'ZERO texto na imagem; ZERO ícones; ZERO gráficos; ZERO logos.';
  if (humanPreference === 'visual') {
    return (
      'REGRAS — PANORAMA SÓ VISUAL: fotografia fotorrealista cinematográfica; ' +
      'nenhuma pessoa, rosto, silhueta humana ou multidão; ' +
      commonTail
    );
  }
  if (humanPreference === 'people') {
    return (
      'REGRAS — PANORAMA COM PESSOAS: fotografia fotorrealista cinematográfica; ' +
      'figuras humanas coerentes com o tema; continuidade natural se atravessarem faixas; ' +
      commonTail
    );
  }
  return (
    'REGRAS — PANORAMA: fotografia fotorrealista cinematográfica; ' +
    'pessoas só se fizerem sentido; caso contrário ambiente e objetos; ' +
    commonTail
  );
}

function buildCarrosselImageApiRules(humanPreference = 'auto') {
  const commonTail =
    'proporção vertical 4:5 para Instagram; ZERO texto escrito na imagem; ZERO ícones; ZERO gráficos; ZERO logos. ' +
    'Gere UMA única imagem em plano único — proibido mosaico, collage, grelha, painéis múltiplos ou imagem dividida em quadrantes.';
  if (humanPreference === 'visual') {
    return (
      'REGRAS OBRIGATÓRIAS — MODO SÓ VISUAL: fotografia cinematográfica fotorrealista; iluminação dramática; ' +
      'ABSOLUTAMENTE NENHUMA pessoa, rosto, silhueta humana, corpo, mão, pé, multidão ou figura humana reconhecível; ' +
      'apenas ambientes sem pessoas, objetos, natureza, tecnologia, arquitetura, luz, texturas ou abstração; ' +
      'cores escuras e contrastantes; estética de filme ou editorial; alta resolução; ' +
      commonTail
    );
  }
  if (humanPreference === 'people') {
    return (
      'REGRAS OBRIGATÓRIAS — COM PESSOAS: fotografia cinematográfica fotorrealista; iluminação dramática; ' +
      'incluir figura(s) humana(s) com rosto ou presença clara e expressiva quando fizer sentido para o tema; ' +
      'cores escuras e contrastantes; estética de filme ou editorial; fundo desfocado quando adequado; alta resolução; ' +
      commonTail
    );
  }
  return (
    'REGRAS OBRIGATÓRIAS: fotografia cinematográfica fotorrealista; iluminação dramática com sombras profundas; ' +
    'figuras humanas apenas se forem coerentes com o prompt — caso contrário privilegie ambiente e objetos; ' +
    'cores escuras e contrastantes; estética de filme ou editorial de revista; alta resolução; ' +
    commonTail
  );
}

/**
 * Geração de imagem via API OpenAI Images (quando a conexão é compatível).
 * @param {'auto'|'people'|'visual'} [humanPreference] — alinha regras da API com o modo do carrossel (visual = zero pessoas).
 * @param {string|null} [subjectFaceDataUrl] — data URL (JPEG/PNG/WebP) do rosto; só Google Gemini (multimodal). Ignorado em modo visual.
 * @param {string|null} [referenceImageDataUrl] — imagem de referência (arte atual) para reedição; Google/OpenRouter multimodal.
 * @param {'edit'|'style'} [referenceImageMode] — `edit` (default): alterar arte anexada; `style`: nova cena guiada por paleta/atmosfera da imagem.
 * @param {number} [panoramaSlideCount] — se >1, gera imagem wide 16:9 para fundo contínuo partido em N slides (só Gemini).
 * @param {'1K'|'2K'|'4K'} [geminiImageSize] — só Google Gemini (`imageConfig.imageSize`).
 * @param {'carousel'|'square'|'stories'} [canvasFormat] — proporção do canvas (só imagem única; panorama mantém 16:9).
 * @returns {Promise<{ dataUrl: string|null, error: Error|null }>}
 */
export async function carrosselGenerateBackgroundImage({
  supabase,
  connectionId,
  prompt,
  humanPreference = 'auto',
  subjectFaceDataUrl = null,
  referenceImageDataUrl = null,
  referenceImageMode = 'edit',
  panoramaSlideCount = 1,
  geminiImageSize = '2K',
  canvasFormat = 'carousel',
}) {
  const { data: conn, error: fetchErr } = await fetchUserAiConnectionForCarrossel(supabase, connectionId);
  if (fetchErr || !conn) return { dataUrl: null, error: fetchErr || new Error('Conexão inválida') };

  const refMode = referenceImageMode === 'style' ? 'style' : 'edit';

  const cap = conn.capabilities || {};
  if (!cap.image_generation) {
    return { dataUrl: null, error: new Error('Esta conexão não tem geração de imagem') };
  }

  const apiKey = conn.api_key.trim();
  const apiUrl = String(conn.api_url || '').trim().replace(/\/$/, '');
  const p = String(conn.provider || '').toLowerCase();

  const panoN = Math.max(1, Math.floor(Number(panoramaSlideCount) || 1));
  const isPanorama = panoN > 1;
  const geminiSize = normalizeCarrosselGeminiImageSize(geminiImageSize);
  const { geminiAspectRatio, openAiSize } = resolveCarrosselCanvasFormat(canvasFormat);

  if (isPanorama && !isGoogleProvider(conn.provider, apiUrl) && !isOpenRouterProvider(conn.provider, apiUrl)) {
    return {
      dataUrl: null,
      error: new Error(
        'Imagem contínua (panorama) requer Google (Gemini) ou OpenRouter com modelo de saída imagem em Minha IA.'
      ),
    };
  }

  const rules = isPanorama
    ? buildCarrosselImageApiRulesPanorama(humanPreference, panoN)
    : buildCarrosselImageApiRules(humanPreference);
  const fullPrompt = `${String(prompt).slice(0, 7000)}\n\n${rules}`;
  const openAiPrompt = `${String(prompt).trim()}\n\n${rules}`.slice(0, 3900);

  try {
    // Google Gemini (mesmo padrão que neurodesign-generate-google — Minha IA → imagem)
    if (isGoogleProvider(conn.provider, apiUrl)) {
      const baseUrl = normalizeGoogleImageApiBase(apiUrl);
      const model = normalizeGeminiImageModelId(conn.default_model);
      const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
      const subjectInline =
        humanPreference !== 'visual' && subjectFaceDataUrl
          ? parseDataUrlToGeminiInline(subjectFaceDataUrl)
          : null;
      const referenceInline = referenceImageDataUrl ? parseDataUrlToGeminiInline(referenceImageDataUrl) : null;
      const requestParts = [];
      let promptForGemini = fullPrompt;
      if (referenceInline) {
        requestParts.push({ inlineData: { mimeType: referenceInline.mimeType, data: referenceInline.data } });
        const refPrefix =
          refMode === 'style'
            ? 'A imagem anexada é apenas REFERÊNCIA DE ESTILO (paleta, luz, textura, atmosfera). Gere uma NOVA composição fotográfica com assunto e enquadramento diferentes; não copie a mesma cena nem faça colagem da arte.\n'
            : 'Use a imagem anexada como referência principal da arte atual e aplique apenas as alterações pedidas no prompt mantendo coerência visual.\n';
        promptForGemini = refPrefix + promptForGemini;
      }
      if (subjectInline) {
        requestParts.push({ inlineData: { mimeType: subjectInline.mimeType, data: subjectInline.data } });
        promptForGemini = CAROUSEL_SUBJECT_FACE_PREFIX + promptForGemini;
      }
      requestParts.push({ text: promptForGemini });
      const body = {
        contents: [{ parts: requestParts }],
        generationConfig: {
          candidateCount: 1,
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: isPanorama ? '16:9' : geminiAspectRatio,
            imageSize: geminiSize,
          },
        },
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data?.error?.message === 'string'
            ? data.error.message
            : JSON.stringify(data).slice(0, 280);
        return { dataUrl: null, error: new Error(`Gemini ${res.status}: ${msg}`) };
      }
      const blockReason = data?.promptFeedback?.blockReason;
      if (blockReason && blockReason !== 'BLOCK_REASON_UNSPECIFIED') {
        return { dataUrl: null, error: new Error('Prompt bloqueado pelo filtro de segurança do Google.') };
      }
      const candidates = data?.candidates;
      const cand0 = Array.isArray(candidates) && candidates.length > 0 ? candidates[0] : null;
      if (!cand0) {
        return { dataUrl: null, error: new Error('A API não devolveu candidatos. Confirme o modelo de imagem em Minha IA.') };
      }
      const parts = cand0?.content?.parts;
      if (!Array.isArray(parts)) {
        return { dataUrl: null, error: new Error('A API não devolveu imagem. Confirme o modelo de imagem em Minha IA (ex.: gemini-2.5-flash-image).') };
      }
      for (const part of parts) {
        const inline = part?.inlineData;
        if (inline?.data) {
          const mime = inline.mimeType || 'image/png';
          return { dataUrl: `data:${mime};base64,${inline.data}`, error: null };
        }
      }
      return { dataUrl: null, error: new Error('Nenhuma imagem na resposta. Tente outro modelo ou prompt.') };
    }

    if (p.includes('openai') || apiUrl.includes('api.openai.com')) {
      const base = apiUrl.includes('/v1') ? apiUrl : 'https://api.openai.com/v1';
      const res = await fetch(`${base}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: openAiPrompt,
          n: 1,
          size: openAiSize,
          response_format: 'b64_json',
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { dataUrl: null, error: new Error(body?.error?.message || res.statusText) };
      }
      const b64 = body?.data?.[0]?.b64_json;
      if (!b64) return { dataUrl: null, error: new Error('Sem imagem na resposta') };
      return { dataUrl: `data:image/png;base64,${b64}`, error: null };
    }

    // OpenRouter — chat/completions com `modalities` + `image_config` (docs multimodal image-generation)
    if (isOpenRouterProvider(conn.provider, apiUrl)) {
      const chatUrl = resolveOpenRouterChatCompletionsUrl(apiUrl);
      if (!chatUrl) {
        return { dataUrl: null, error: new Error('api_url OpenRouter inválida (use …/api/v1 ou URL completa de chat/completions).') };
      }
      const model = String(conn.default_model || '').trim() || 'google/gemini-2.5-flash-image';
      const modalities = openRouterImageModalities(model);
      const aspectRatio = isPanorama ? '16:9' : geminiAspectRatio;
      const faceUrl =
        humanPreference !== 'visual' && subjectFaceDataUrl
          ? subjectFaceDataUrlForOpenRouter(subjectFaceDataUrl)
          : '';
      const refUrl = referenceImageDataUrl ? subjectFaceDataUrlForOpenRouter(referenceImageDataUrl) : '';
      const userContent =
        faceUrl.length > 0 || refUrl.length > 0
          ? [
              ...(refUrl.length > 0 ? [{ type: 'image_url', image_url: { url: refUrl } }] : []),
              ...(faceUrl.length > 0 ? [{ type: 'image_url', image_url: { url: faceUrl } }] : []),
              {
                type: 'text',
                text: `${faceUrl.length > 0 ? CAROUSEL_SUBJECT_FACE_PREFIX : ''}${
                  refUrl.length > 0
                    ? refMode === 'style'
                      ? 'A imagem anexada é apenas REFERÊNCIA DE ESTILO (paleta, luz, atmosfera). Gere uma NOVA composição; não copie a mesma cena.\n'
                      : 'Use a imagem anexada como referência principal da arte atual e aplique apenas as alterações pedidas no prompt mantendo coerência visual.\n'
                    : ''
                }${openAiPrompt}`,
              },
            ]
          : openAiPrompt;
      const payload = {
        model,
        messages: [{ role: 'user', content: userContent }],
        modalities,
        image_config: {
          aspect_ratio: aspectRatio,
          image_size: geminiSize,
        },
      };
      if (modalities.includes('text')) {
        payload.max_tokens = 1024;
      }
      const referer =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : 'https://neuro.jbapex.com.br';
      const res = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': referer,
          'X-Title': 'Neuro Apice Carrossel',
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof body?.error?.message === 'string'
            ? body.error.message
            : typeof body?.message === 'string'
              ? body.message
              : JSON.stringify(body).slice(0, 320);
        return { dataUrl: null, error: new Error(`OpenRouter ${res.status}: ${msg}`) };
      }
      const message = body?.choices?.[0]?.message;
      const dataUrl = extractDataUrlFromOpenRouterMessage(message);
      if (dataUrl) return { dataUrl, error: null };
      const hint =
        'Sem imagem na resposta. Em Minha IA use um modelo com output «image» (ex.: google/gemini-2.5-flash-image) e confirme que a conexão está como OpenRouter.';
      return { dataUrl: null, error: new Error(hint) };
    }

    return {
      dataUrl: null,
      error: new Error(
        'Conexão de imagem não suportada no Carrossel. Use Google (Gemini imagem), OpenRouter (modelo com saída imagem) ou OpenAI (DALL·E) em Minha IA.'
      ),
    };
  } catch (e) {
    return { dataUrl: null, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
