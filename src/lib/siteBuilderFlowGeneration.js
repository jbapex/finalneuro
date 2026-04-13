/**
 * Lógica partilhada entre SiteBuilder (página) e Fluxo Criativo (nó Estrutura):
 * prompts Horizons, extração de HTML do chat e aplicação ao documento.
 */

export const HORIZONS_SYSTEM_PROMPT_BASE = `Você é o Horizons, designer de sites de uma agência de alta performance. Seu trabalho é criar landing pages ÚNICAS, com identidade visual forte e cara de produto profissional — não templates genéricos.

DESIGN OBRIGATÓRIO (NÃO IGNORAR):
- NUNCA use o clichê "degradê azul e roxo" (evite from-blue-500 to-purple-600, from-indigo to-purple, etc.). Cada site deve ter paleta própria, coerente com o nicho e o brief.
- Tipografia personalizada: use fontes distintas por projeto. Você PODE usar apenas estas famílias (já carregadas no preview): "Inter", "Playfair Display", "Plus Jakarta Sans", "Outfit", "DM Serif Display", "Space Grotesk", "Lora", "Manrope". Escolha uma combinação (ex.: títulos em DM Serif Display, corpo em Plus Jakarta Sans) que combine com o tom do site. Aplique via style="font-family: 'Nome da Fonte', fallback;" ou classes Tailwind quando fizer sentido.
- Imagens em lugares estratégicos: em hero, features ou depoimentos, inclua <img> com data-id e data-type="image", src com placeholder (ex.: https://placehold.co/800x500 ou similar), alt descritivo. O usuário troca a imagem depois; deixe o layout pronto para impacto visual.
- Elementos bem desenhados: botões com bordas definidas, hierarquia clara (tamanhos de texto, espaçamento), cards com sombra/borda sutil, CTAs que se destacam. Evite blocos sem estrutura.
- Layout responsivo (mobile-first), semântico (header, main, section, footer, nav), um único h1 por página. Todo elemento editável (títulos, parágrafos, botões) deve ter data-id único e data-type="heading"|"text"|"button" conforme o caso.

FORMATOS DE RESPOSTA:
1) Página inteira (somente se o usuário pedir explicitamente para recriar/refazer o site inteiro): retorne o HTML completo em \`\`\`html ... \`\`\`
2) Adicionar seção (caso mais comum quando já existe página): primeira linha \`<!-- APPEND -->\` dentro do bloco, depois APENAS o HTML da nova seção com data-section-id="section_N" (um único elemento <section>...</section>). NÃO reenvie as seções antigas.
3) Substituir seção: primeira linha \`<!-- REPLACE_SECTION: section_X -->\`, depois o HTML da seção.

REGRA CRÍTICA: Se já existem seções na página atual, NÃO substitua a página inteira ao adicionar uma seção nova. Use SEMPRE <!-- APPEND --> + uma única <section> com data-section-id igual ao próximo id informado no contexto. Só use formato (1) se o usuário pedir página inteira / refazer tudo / do zero.

SEMPRE que o pedido implicar mudança na página, sua resposta DEVE conter o bloco HTML (\`\`\`html ... \`\`\`) com <!-- APPEND --> ou <!-- REPLACE_SECTION --> quando aplicável. Respostas só em texto não atualizam o preview.
Use as informações do CONTEXTO DO PROJETO (nome, nicho, cores, tom, público, estilo visual) para definir cores, fontes e tom do layout. Priorize HTML quando o usuário pedir seção, hero ou página.`;

export function getPageContextFromHtml(html) {
  if (!html || typeof html !== 'string') return { section_count: 0, section_ids: [], next_section_id: 'section_0' };
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  const children = Array.from(div.children);
  const section_ids = children.map((el, i) => el.getAttribute('data-section-id') || `section_${i}`);
  let maxIdx = -1;
  for (const id of section_ids) {
    const m = /^section_(\d+)$/.exec(String(id));
    if (m) maxIdx = Math.max(maxIdx, parseInt(m[1], 10));
  }
  const next_section_id = `section_${maxIdx + 1}`;
  return { section_count: children.length, section_ids, next_section_id };
}

export function buildSystemPrompt(pageContext, brief) {
  let prompt = HORIZONS_SYSTEM_PROMPT_BASE;
  if (brief && typeof brief === 'object' && Object.keys(brief).length > 0) {
    const parts = [];
    if (brief.site_name) parts.push(`Nome do site: ${brief.site_name}`);
    if (brief.niche) parts.push(`Nicho: ${brief.niche}`);
    if (brief.primary_color) parts.push(`Cor primária: ${brief.primary_color}`);
    if (brief.secondary_color) parts.push(`Cor secundária: ${brief.secondary_color}`);
    if (brief.tone) parts.push(`Tom: ${brief.tone}`);
    if (brief.target_audience) parts.push(`Público-alvo: ${brief.target_audience}`);
    if (brief.estilo_visual) parts.push(`Estilo visual: ${brief.estilo_visual}`);
    if (brief.notes) parts.push(`Observações: ${brief.notes}`);
    if (parts.length) prompt += `\n\nCONTEXTO DO PROJETO:\n${parts.join('\n')}`;
  }
  if (pageContext && pageContext.section_count > 0) {
    prompt += `\n\nPÁGINA ATUAL: ${pageContext.section_count} seção(ões) com ids: ${pageContext.section_ids.join(', ')}.`;
    prompt += `\nPara ADICIONAR uma nova seção, use <!-- APPEND --> e data-section-id="${pageContext.next_section_id}" na nova <section> (não repita o HTML das seções existentes).`;
    prompt += `\nPara SUBSTITUIR uma seção existente, use <!-- REPLACE_SECTION: section_X -->.`;
  }
  return prompt;
}

export function normalizeHtmlFragment(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  const trimmed = rawHtml.trim();
  if (!trimmed) return '';

  if (!/<body[\s>]/i.test(trimmed)) return trimmed;

  try {
    const container = document.createElement('html');
    container.innerHTML = trimmed;
    const body = container.querySelector('body');
    if (body) {
      return body.innerHTML.trim() || '';
    }
  } catch (_e) {
    /* ignore */
  }

  return trimmed;
}

export function extractHtmlFromChatResponse(text) {
  if (!text || typeof text !== 'string') return null;

  const parseBlock = (raw) => {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (trimmed.length < 10) return null;
    if (/<!--\s*APPEND\s*-->/i.test(trimmed)) {
      const html = trimmed.replace(/<!--\s*APPEND\s*-->\s*/i, '').trim();
      const normalized = normalizeHtmlFragment(html);
      return normalized ? { type: 'append', html: normalized } : null;
    }
    const replaceMatch = trimmed.match(/<!--\s*REPLACE_SECTION:\s*(\S+)\s*-->\s*([\s\S]*)/i);
    if (replaceMatch) {
      const sectionId = replaceMatch[1].trim();
      const html = normalizeHtmlFragment(replaceMatch[2]);
      return html ? { type: 'replace_section', sectionId, html } : null;
    }
    return { type: 'full', html: normalizeHtmlFragment(trimmed) };
  };

  const htmlBlock = text.match(/```html\s*([\s\S]*?)```/i);
  if (htmlBlock && htmlBlock[1]) {
    const out = parseBlock(htmlBlock[1]);
    if (out) return out;
  }

  const anyBlock = text.match(/```(?:html|jsx)?\s*([\s\S]*?)```/i);
  if (anyBlock && anyBlock[1] && /<\s*[a-z][\s\S]*>/i.test(anyBlock[1])) {
    const out = parseBlock(anyBlock[1]);
    if (out) return out;
  }

  const startMatch = text.match(/<\s*(section|div|article|main|footer|header|nav)\b[\s\S]*?>/i);
  if (startMatch) {
    const tagName = startMatch[1].toLowerCase();
    const start = text.indexOf(startMatch[0]);
    const limit = 150000;
    let depth = 1;
    let pos = start + startMatch[0].length;
    const openTag = `<${tagName}`;
    const openTagLen = openTag.length;
    const closeTag = `</${tagName}>`;
    const closeTagLen = closeTag.length;
    while (pos < text.length && pos < start + limit) {
      const nextOpen = text.toLowerCase().indexOf(openTag.toLowerCase(), pos);
      const nextClose = text.indexOf(closeTag, pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + openTagLen;
      } else {
        depth--;
        pos = nextClose + closeTagLen;
        if (depth <= 0) {
          const extracted = text.slice(start, pos).trim();
          if (extracted.length > 30) return { type: 'full', html: extracted };
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Igual ao SiteBuilder, mas permite página inicial vazia (fluxo criativo).
 */
export function applyExtractedHtml(currentHtml, extracted) {
  if (!extracted) return currentHtml ?? '';
  const cur = typeof currentHtml === 'string' ? currentHtml : '';
  if (!cur.trim()) {
    if (extracted.type === 'full' || extracted.type === 'append') return extracted.html || '';
    return cur;
  }
  if (extracted.type === 'full') return extracted.html;
  if (extracted.type === 'append') return cur.trimEnd() + '\n' + extracted.html;
  if (extracted.type === 'replace_section') {
    const div = document.createElement('div');
    div.innerHTML = cur.trim();
    const children = Array.from(div.children);
    const sectionId = extracted.sectionId;
    const idx = children.findIndex(
      (el, i) => (el.getAttribute('data-section-id') || `section_${i}`) === sectionId
    );
    if (idx === -1) return cur;
    const newSectionDiv = document.createElement('div');
    newSectionDiv.innerHTML = extracted.html.trim();
    const newEl = newSectionDiv.firstElementChild;
    if (!newEl) return cur;
    children[idx] = newEl;
    return children.map((el) => el.outerHTML).join('\n');
  }
  return cur;
}

export function coerceFullToAppendIfNeeded(currentHtml, userMessage, extracted) {
  if (!extracted || extracted.type !== 'full' || !extracted.html) return extracted;
  const current = (currentHtml || '').trim();
  if (!current) return extracted;

  const pageCtx = getPageContextFromHtml(current);
  if (pageCtx.section_count === 0) return extracted;

  const msg = (userMessage || '').trim();
  const wantsFullRewrite =
    /p[áa]gina\s+inteira|recriar\s+tudo|reescrever\s+todo|refazer\s+o\s+site|from\s+scratch|substituir\s+tudo|novo\s+site\s+do\s+zero|html\s+completo\s+da\s+p[áa]gina|recrie\s+a\s+p[áa]gina\s+inteira|site\s+completo/i.test(
      msg
    );
  if (wantsFullRewrite) return extracted;

  const seemsReplaceSection =
    /substitu[ia]\s+.*se[çc][aã]o|REPLACE_SECTION|<!--\s*REPLACE_SECTION|troque\s+a\s+se[çc]|altere\s+a\s+se[çc][aã]o\s+exist|substitu[ia]\s+o\s+hero|substitu[ia]\s+a\s+hero/i.test(
      msg
    );

  const addIntent =
    /adicion|adicione|nova\s+se|inclua|incluir|mais\s+uma|crie\s+uma\s+se|uma\s+nova|outra\s+se|se[çc][aã]o\s+(nova|de|com|para)|coloque\s+uma|quero\s+uma\s+se|preciso\s+de\s+uma\s+se|bloco\s+de|área\s+de|append|\badd\s+(a|an)?\s*section|\bnew\s+section\b/i.test(
      msg
    );

  if (seemsReplaceSection && !addIntent) return extracted;

  const frag = document.createElement('div');
  frag.innerHTML = extracted.html.trim();
  const roots = Array.from(frag.children);

  let sectionEl = null;
  if (roots.length === 1 && roots[0].tagName.toLowerCase() === 'section') {
    sectionEl = roots[0];
  } else if (roots.length === 1 && roots[0].tagName.toLowerCase() === 'main') {
    const secs = roots[0].querySelectorAll(':scope > section');
    if (secs.length === 1) sectionEl = secs[0];
  }

  if (!sectionEl) {
    const all = frag.querySelectorAll('section');
    if (all.length === 1 && roots.length === 1) sectionEl = all[0];
  }

  if (!sectionEl || !addIntent) return extracted;

  sectionEl.setAttribute('data-section-id', pageCtx.next_section_id);
  return { type: 'append', html: sectionEl.outerHTML };
}

export function htmlStringToPageStructureModules(html) {
  if (!html || typeof html !== 'string') return [];
  const trimmed = html.trim();
  if (!trimmed) return [];
  const div = document.createElement('div');
  div.innerHTML = trimmed;
  const children = Array.from(div.children);
  return children.map((el, i) => ({
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `mod-${Date.now()}-${i}`,
    name: String(el.getAttribute('data-section-id') || el.tagName || `Secção ${i + 1}`).slice(0, 80),
    html: el.outerHTML,
  }));
}

export function chatResponseToString(raw) {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw.content != null) return String(raw.content);
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

const FLOW_INITIAL_USER_MSG = `Pedido automático do Fluxo Criativo: crie a landing page inicial COMPLETA para este projeto.

Regras:
- Siga estritamente o CONTEXTO DO PROJETO (brief) no system prompt.
- Responda com um único bloco \`\`\`html\`\`\`.
- Inclua várias secções <section> com data-section-id="section_0", "section_1", "section_2", ... (hero, proposta de valor, serviços ou funcionalidades, prova social ou FAQ, CTA final, rodapé).
- Use Tailwind CSS (classes), tipografia e paleta alinhadas ao nicho (evite clichê degradê azul–roxo).
- Cada texto editável: data-id único (UUID ou id estável) e data-type="heading"|"text"|"button"|"image" quando aplicável.

A página atual está vazia: devolva o HTML de todas as secções (formato página completa), sem usar <!-- APPEND -->.`;

const CHAT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Uma chamada equivalente ao primeiro envio no chat do Criador de Site (Horizons + site_builder_chat).
 * Grava html_content, chat_history, page_structure (se a coluna existir) e status completed.
 */
export async function runSiteBuilderInitialGenerationFromBrief({
  supabase,
  projectId,
  userId,
  projectBrief,
  llmIntegrationId,
  isUserConnection,
}) {
  if (!supabase || !projectId || !userId || !llmIntegrationId) {
    return { ok: false, reason: 'missing_params' };
  }

  const initialHtml = '';
  const pageContext = getPageContextFromHtml(initialHtml);
  const systemPrompt = buildSystemPrompt(pageContext, projectBrief);
  const userMsg = FLOW_INITIAL_USER_MSG;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMsg },
  ];

  const timeoutSignal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(CHAT_TIMEOUT_MS) : null;
  const invokeOptions = {
    body: JSON.stringify({
      session_id: null,
      messages,
      llm_integration_id: llmIntegrationId,
      is_user_connection: isUserConnection === true,
      context: 'site_builder_chat',
      current_page_context: pageContext,
    }),
  };
  if (timeoutSignal) invokeOptions.signal = timeoutSignal;

  const { data, error } = await supabase.functions.invoke('generic-ai-chat', invokeOptions);
  const errMsg = data?.error || error?.message || error;
  if (error || data?.error) {
    return { ok: false, reason: 'invoke_error', error: errMsg };
  }

  const raw = chatResponseToString(data?.response ?? data?.content);
  let extracted = extractHtmlFromChatResponse(raw);
  extracted = coerceFullToAppendIfNeeded(initialHtml, userMsg, extracted);
  if (!extracted) {
    return { ok: false, reason: 'no_html_in_response' };
  }

  const newHtml = applyExtractedHtml(initialHtml, extracted);
  if (!newHtml || !String(newHtml).trim()) {
    return { ok: false, reason: 'empty_html' };
  }

  const page_structure = htmlStringToPageStructureModules(newHtml);
  const chat_history = [
    { role: 'user', content: userMsg },
    { role: 'assistant', content: raw },
  ];

  const now = new Date().toISOString();
  let updatePayload = {
    html_content: newHtml,
    chat_history,
    status: 'completed',
    updated_at: now,
  };
  if (page_structure.length > 0) {
    updatePayload.page_structure = page_structure;
  }

  let { error: upErr } = await supabase
    .from('site_projects')
    .update(updatePayload)
    .eq('id', projectId)
    .eq('user_id', userId);

  if (upErr && /page_structure|schema cache/i.test(String(upErr.message || ''))) {
    const { page_structure: _ps, ...rest } = updatePayload;
    ({ error: upErr } = await supabase.from('site_projects').update(rest).eq('id', projectId).eq('user_id', userId));
  }

  if (upErr) {
    return { ok: false, reason: 'db_update', error: upErr.message };
  }

  return { ok: true };
}
