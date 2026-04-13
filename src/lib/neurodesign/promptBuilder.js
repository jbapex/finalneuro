import { getNeuroDesignFontPromptLine } from './fontPrompt.js';

/**
 * Monta o prompt estruturado para geração de imagem a partir da DesignConfig.
 * Usado pela Edge Function; o client envia a config e a EF chama buildPrompt.
 * Não exibir o prompt final na UI (apenas salvar em provider_request_json para debug).
 *
 * @param {Object} config - DesignConfig do builder
 * @returns {string} prompt único para o provider
 */
export function buildPrompt(config) {
  if (!config) return '';

  const textOff = config.text_enabled === false || config.text_enabled === 'false';
  const subjectOff = config.subject_enabled === false || config.subject_enabled === 'false';

  const restrictionParts = [];
  if (textOff) {
    restrictionParts.push('OBRIGATÓRIO: Não incluir texto, títulos, slogans ou botões na imagem. Imagem apenas visual, sem nenhuma escrita.');
  }
  if (subjectOff) {
    restrictionParts.push('OBRIGATÓRIO: Não incluir pessoas, rostos ou figuras humanas na imagem. Imagem totalmente sem sujeito/pessoa.');
  }

  const fontLabel = { sans: 'sans serifa', serif: 'serifa', bold: 'negrito', modern: 'moderno' };
  const shapeLabel = { rounded_rectangle: 'retângulo arredondado', banner: 'faixa/banner', pill: 'pill/cápsula' };
  const ZONE_TO_LABEL = {
    'top-left': 'zona superior esquerda',
    'top-center': 'zona superior centro',
    'top-right': 'zona superior direita',
    'center-left': 'zona meio esquerda',
    'center': 'centro',
    'center-right': 'zona meio direita',
    'bottom-left': 'zona inferior esquerda',
    'bottom-center': 'zona inferior centro',
    'bottom-right': 'zona inferior direita',
  };

  function resolvePositionPhrase(zone, position, textPos) {
    const t = (textPos || '').trim() || 'centro';
    if (zone && ZONE_TO_LABEL[zone]) return ZONE_TO_LABEL[zone];
    return (position || '').trim() || t;
  }

  function fieldFont(config, field) {
    const v = field === 'headline' ? config.headline_font : field === 'subheadline' ? config.subheadline_font : config.cta_font;
    return (v || '').trim() || (config.text_font || '').trim();
  }
  function fieldColor(config, field) {
    const v = field === 'headline' ? config.headline_color : field === 'subheadline' ? config.subheadline_color : config.cta_color;
    const raw = (v || '').trim() || (config.text_color || '').trim();
    return raw && /^#[0-9a-fA-F]{3,6}$/.test(raw) ? raw : '';
  }
  function fieldShape(config, field) {
    const enabled = field === 'headline' ? config.headline_shape_enabled : field === 'subheadline' ? config.subheadline_shape_enabled : config.cta_shape_enabled;
    const styleKey = field === 'headline' ? config.headline_shape_style : field === 'subheadline' ? config.subheadline_shape_style : config.cta_shape_style;
    const colorRaw = field === 'headline' ? config.headline_shape_color : field === 'subheadline' ? config.subheadline_shape_color : config.cta_shape_color;
    if (enabled) {
      const style = shapeLabel[styleKey] || 'retângulo arredondado';
      const color = (colorRaw && /^#[0-9a-fA-F]{3,6}$/.test(String(colorRaw).trim())) ? String(colorRaw).trim() : 'destaque';
      return { style, color };
    }
    if (config.text_shape_enabled) {
      const style = shapeLabel[config.text_shape_style] || 'retângulo arredondado';
      const color = (config.text_shape_color && /^#[0-9a-fA-F]{3,6}$/.test(String(config.text_shape_color).trim())) ? String(config.text_shape_color).trim() : 'destaque';
      return { style, color };
    }
    return null;
  }

  const textBlockParts = [];
  if (!textOff && config.text_enabled) {
    const isFreeMode = (config.text_mode || 'structured') === 'free';
    if (isFreeMode) {
      const useRefText = config.use_reference_image_text === true || config.use_reference_image_text === 'true';
      const customText = (config.custom_text || '').trim();
      const fontDesc = (config.custom_text_font_description || '').trim();
      if (useRefText) {
        textBlockParts.push('O texto exibido na imagem deve ser o mesmo que aparece na(s) imagem(ns) de referência anexa(s), reproduzindo-o de forma legível e integrada à cena.');
      }
      if (customText) {
        textBlockParts.push('OBRIGATÓRIO - TEXTO VISÍVEL NA IMAGEM: A arte deve exibir este texto de forma clara e legível, sem alterar uma letra: "' + customText + '".');
        if (fontDesc) {
          textBlockParts.push(
            'PRIORIDADE TIPOGRAFIA — TEXTO LIVRE: ' +
              fontDesc +
              '. Aplicar este estilo ou família ao texto acima o mais fielmente possível (formato das letras, peso, personalidade); não usar fonte genérica diferente sem necessidade.',
          );
        }
      }
      if (!useRefText && !customText) {
        textBlockParts.push('Não incluir texto, títulos, subtítulos ou botões na imagem (nenhum texto foi definido pelo usuário).');
      }
    } else {
    const h1 = (config.headline_h1 || '').trim();
    const h2 = (config.subheadline_h2 || '').trim();
    const cta = (config.cta_button_text || '').trim();
    const textPos = (config.text_position || '').trim() || 'centro';
    const posH = resolvePositionPhrase(config.headline_zone, config.headline_position, textPos);
    const posH2 = resolvePositionPhrase(config.subheadline_zone, config.subheadline_position, textPos);
    const posCta = resolvePositionPhrase(config.cta_zone, config.cta_position, textPos);
    if (h1 || h2 || cta) {
      const textLines = [];
      if (h1) textLines.push(`Título em destaque: "${h1}"`);
      if (h2) textLines.push(`Subtítulo: "${h2}"`);
      if (cta) textLines.push(`Botão: "${cta}"`);
      const posParts = [];
      if (h1) posParts.push(`Título na ${posH}`);
      if (h2) posParts.push(`Subtítulo na ${posH2}`);
      if (cta) posParts.push(`CTA na ${posCta}`);
      let posPhrase = posParts.join(', ') + '.';
      if (!h1 || !h2 || !cta) {
        posPhrase += ' Não incluir na imagem título, subtítulo ou CTA que não tenham sido listados acima.';
      }
      posPhrase += ' Incluir na imagem APENAS estes textos; não adicionar título, subtítulo ou botão que não tenham sido especificados.';
      textBlockParts.push(
        'OBRIGATÓRIO - TEXTO VISÍVEL NA IMAGEM: A arte deve exibir este texto de forma clara e legível, sem alterar uma letra: ' +
        textLines.join('. ') + '. ' + posPhrase
      );
      if (config.text_gradient) textBlockParts.push('O texto deve ter efeito de gradiente (degradê nas letras).');
      if (h1) {
        const f = fieldFont(config, 'headline');
        const fontLine = getNeuroDesignFontPromptLine('título', f);
        if (fontLine) textBlockParts.push(fontLine);
        const c = fieldColor(config, 'headline');
        if (c) textBlockParts.push(`Cor do título: ${c}.`);
        const sh = fieldShape(config, 'headline');
        if (sh) textBlockParts.push(`Título sobre faixa/forma de destaque atrás (${sh.style}, cor ${sh.color}).`);
      }
      if (h2) {
        const f = fieldFont(config, 'subheadline');
        const fontLine = getNeuroDesignFontPromptLine('subtítulo', f);
        if (fontLine) textBlockParts.push(fontLine);
        const c = fieldColor(config, 'subheadline');
        if (c) textBlockParts.push(`Cor do subtítulo: ${c}.`);
        const sh = fieldShape(config, 'subheadline');
        if (sh) textBlockParts.push(`Subtítulo sobre faixa/forma de destaque atrás (${sh.style}, cor ${sh.color}).`);
      }
      if (cta) {
        const f = fieldFont(config, 'cta');
        const fontLine = getNeuroDesignFontPromptLine('CTA', f);
        if (fontLine) textBlockParts.push(fontLine);
        const c = fieldColor(config, 'cta');
        if (c) textBlockParts.push(`Cor do CTA: ${c}.`);
        const sh = fieldShape(config, 'cta');
        if (sh) textBlockParts.push(`CTA sobre faixa/forma de destaque atrás (${sh.style}, cor ${sh.color}).`);
      }
    } else {
      textBlockParts.push('Não incluir texto, títulos, subtítulos ou botões na imagem (nenhum texto foi definido pelo usuário).');
    }
    }
  }

  const parts = [];

  // Subject block (só quando sujeito ligado)
  if (!subjectOff) {
    const numSubjects = Math.min(Math.max(Number(config.quantity) || 1, 1), 5);
    parts.push(`A imagem deve conter exatamente ${numSubjects} ${numSubjects === 1 ? 'sujeito/pessoa' : 'sujeitos/pessoas'}.`);
    const gender = config.subject_gender === 'masculino' ? 'homem' : config.subject_gender === 'feminino' ? 'mulher' : '';
    const subjectDesc = config.subject_description?.trim() || '';
    if (gender || subjectDesc) {
      parts.push(`Sujeito principal: ${[gender, subjectDesc].filter(Boolean).join(', ')}.`);
    }
  }

  // Context block
  const niche = config.niche_project?.trim();
  if (niche) {
    parts.push(`Contexto/nicho: ${niche}. Objetivo: criativo de marca/ads.`);
  }

  // Scene block
  const env = config.environment?.trim();
  if (env) {
    parts.push(`Ambiente: ${env}.`);
  }

  // Cenário: fotos de cenário anexas
  const useScenario = config.use_scenario_photos === true || config.use_scenario_photos === 'true';
  const scenarioUrls = Array.isArray(config.scenario_photo_urls) ? config.scenario_photo_urls : [];
  if (useScenario && scenarioUrls.length > 0) {
    parts.push('Use as imagens de cenário anexas como referência para o ambiente/fundo. O cenário da arte deve ser inspirado ou reproduzir o ambiente dessas fotos.');
  }

  const colors = [config.ambient_color, config.rim_light_color, config.fill_light_color].filter(Boolean);
  if (colors.length) {
    parts.push(`Iluminação e cores: luz ambiente e de recorte; ${colors.join(', ')}.`);
  }

  // Composition block
  const shot = config.shot_type || '';
  const layoutPos = config.layout_position || '';
  if (shot) parts.push(`Enquadramento: ${shot}.`);
  if (layoutPos) parts.push(`Posição do sujeito: ${layoutPos}.`);

  if (!textOff && config.text_enabled) {
    const isFreeMode = (config.text_mode || 'structured') === 'free';
    if (isFreeMode) {
      const useRefText = config.use_reference_image_text === true || config.use_reference_image_text === 'true';
      const customText = (config.custom_text || '').trim();
      const fontDesc = (config.custom_text_font_description || '').trim();
      if (useRefText) parts.push('Espaço reservado para texto na composição. O texto exibido deve ser o mesmo das imagens de referência anexas.');
      if (customText) {
        parts.push('Espaço reservado para texto na composição.');
        parts.push('O texto exibido na imagem deve ser exatamente: "' + customText + '".');
        if (fontDesc) {
          parts.push(
            'PRIORIDADE TIPOGRAFIA — TEXTO LIVRE: ' +
              fontDesc +
              '. Aplicar este estilo ou família ao texto acima o mais fielmente possível (formato das letras, peso, personalidade); não usar fonte genérica diferente sem necessidade.',
          );
        }
      }
      if (!useRefText && !customText) parts.push('Não incluir texto, títulos, subtítulos ou botões na imagem (nenhum texto foi definido pelo usuário).');
    } else {
    const h1 = (config.headline_h1 || '').trim();
    const h2 = (config.subheadline_h2 || '').trim();
    const cta = (config.cta_button_text || '').trim();
    if (h1 || h2 || cta) {
      parts.push('Espaço reservado para texto na composição.');
      parts.push('O texto exibido na imagem deve ser exatamente: ' + [h1, h2, cta].filter(Boolean).map(t => `"${t}"`).join(', ') + '.');
      const textPos = (config.text_position || '').trim() || 'centro';
      const posH = resolvePositionPhrase(config.headline_zone, config.headline_position, textPos);
      const posH2 = resolvePositionPhrase(config.subheadline_zone, config.subheadline_position, textPos);
      const posCta = resolvePositionPhrase(config.cta_zone, config.cta_position, textPos);
      const posParts = [];
      if (h1) posParts.push(`Título na ${posH}`);
      if (h2) posParts.push(`Subtítulo na ${posH2}`);
      if (cta) posParts.push(`CTA na ${posCta}`);
      parts.push(posParts.join(', ') + '.');
      if (!h1 || !h2 || !cta) {
        parts.push('Não incluir na imagem título, subtítulo ou CTA que não tenham sido listados acima.');
      }
      parts.push('Incluir na imagem APENAS estes textos; não adicionar título, subtítulo ou botão que não tenham sido especificados.');
      if (config.text_gradient) parts.push('O texto na imagem deve ter efeito de gradiente (degradê nas letras), visível e aplicado ao título e subtítulo.');
      if (h1) {
        const f = fieldFont(config, 'headline');
        const fontLine = getNeuroDesignFontPromptLine('título', f);
        if (fontLine) parts.push(fontLine);
        const c = fieldColor(config, 'headline');
        if (c) parts.push(`Cor do título: ${c}.`);
        const sh = fieldShape(config, 'headline');
        if (sh) parts.push(`Título sobre faixa/forma de destaque (${sh.style}, cor ${sh.color}).`);
      }
      if (h2) {
        const f = fieldFont(config, 'subheadline');
        const fontLine = getNeuroDesignFontPromptLine('subtítulo', f);
        if (fontLine) parts.push(fontLine);
        const c = fieldColor(config, 'subheadline');
        if (c) parts.push(`Cor do subtítulo: ${c}.`);
        const sh = fieldShape(config, 'subheadline');
        if (sh) parts.push(`Subtítulo sobre faixa/forma de destaque (${sh.style}, cor ${sh.color}).`);
      }
      if (cta) {
        const f = fieldFont(config, 'cta');
        const fontLine = getNeuroDesignFontPromptLine('CTA', f);
        if (fontLine) parts.push(fontLine);
        const c = fieldColor(config, 'cta');
        if (c) parts.push(`Cor do CTA: ${c}.`);
        const sh = fieldShape(config, 'cta');
        if (sh) parts.push(`CTA sobre faixa/forma de destaque (${sh.style}, cor ${sh.color}).`);
      }
    } else {
      parts.push('Não incluir texto, títulos, subtítulos ou botões na imagem (nenhum texto foi definido pelo usuário).');
    }
    }
  }

  // Style block
  const attrs = config.visual_attributes || {};
  const tags = Array.isArray(attrs.style_tags) ? attrs.style_tags : [];
  if (tags.length) parts.push(`Estilo: ${tags.join(', ')}.`);
  if (attrs.sobriety != null) {
    parts.push(`Tom visual: ${attrs.sobriety <= 50 ? 'mais criativo' : 'mais profissional'} (${attrs.sobriety}%).`);
  }
  if (attrs.ultra_realistic) parts.push('Ultra realista.');
  if (attrs.blur_enabled) parts.push('Blur de fundo suave.');
  if (attrs.lateral_gradient_enabled) parts.push('Degradê lateral.');

  // Floating elements
  if (config.floating_elements_enabled && config.floating_elements_text?.trim()) {
    parts.push(`Elementos flutuantes: ${config.floating_elements_text.trim()}.`);
  }

  // Format block (sem Safe area quando texto desligado)
  const dims = config.dimensions || '1:1';
  const dimMap = { '9:16': 'stories 9:16', '16:9': 'horizontal 16:9', '1:1': 'feed 1:1', '4:5': 'feed 4:5' };
  if (textOff) {
    parts.push(`Formato: ${dimMap[dims] || dims}.`);
  } else {
    parts.push(`Formato: ${dimMap[dims] || dims}. Safe area para texto respeitada.`);
  }

  // Additional prompt
  if (config.additional_prompt?.trim()) {
    parts.push(config.additional_prompt.trim());
  }

  const mainPrompt = parts.filter(Boolean).join(' ');
  const restrictionBlock = restrictionParts.filter(Boolean).join(' ');
  const textBlock = textBlockParts.filter(Boolean).join(' ');
  const prefix = [restrictionBlock, textBlock].filter(Boolean).join(' ');
  return prefix ? prefix + ' ' + mainPrompt : mainPrompt;
}
