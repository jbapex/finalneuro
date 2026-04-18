import { v4 as uuidv4 } from 'uuid';

/** Canvas em px + saída das APIs de imagem (Gemini aspectRatio; OpenAI size). */
export const CARROSSEL_CANVAS_FORMAT = {
  carousel: {
    slideW: 1080,
    slideH: 1350,
    geminiAspectRatio: '4:5',
    openAiSize: '1024x1792',
    promptLabel: 'vertical 4:5 (feed carrossel Instagram)',
  },
  square: {
    slideW: 1080,
    slideH: 1080,
    geminiAspectRatio: '1:1',
    openAiSize: '1024x1024',
    promptLabel: 'quadrado 1:1',
  },
  stories: {
    slideW: 1080,
    slideH: 1920,
    geminiAspectRatio: '9:16',
    openAiSize: '1024x1792',
    promptLabel: 'vertical 9:16 (stories/reels)',
  },
};

export function resolveCarrosselCanvasFormat(formatId) {
  const id = formatId && CARROSSEL_CANVAS_FORMAT[formatId] ? formatId : 'carousel';
  return { formatId: id, ...CARROSSEL_CANVAS_FORMAT[id] };
}

/** Identidade inicial ao abrir o editor (alinhada a `defaultSlide(0)` — feed minimal preto). */
export const CARROSSEL_IDENTIDADE_ABERTURA = {
  corFundo: '#000000',
  corTitulo: '#ffffff',
  corSubtitulo: '#ffffff',
};

/**
 * Limites do texto gerado por IA no modo post X (miniatura 16:9 em baixo).
 * Referência de layout: ~72 + ~104 + ~71 ≈ 247 caracteres no bloco principal; margem até ~260.
 */
export const CARROSSEL_TWITTER_IA_MAX_TITULO_CHARS = 260;
export const CARROSSEL_TWITTER_IA_MAX_SUBTITULO_CHARS = 110;
/** Px padrão após «Gerar com IA» (próximo do post de referência; ajuste manual nos sliders). */
export const CARROSSEL_TWITTER_IA_DEFAULT_TITULO_TAMANHO = 42;
/** No preview post X empilhado o subtítulo replica o tamanho do corpo; mantemos o mesmo default na merge. */
export const CARROSSEL_TWITTER_IA_DEFAULT_SUBTITULO_TAMANHO = CARROSSEL_TWITTER_IA_DEFAULT_TITULO_TAMANHO;

export function applyCarrosselTwitterIaTextLimits(titulo, subtitulo) {
  return {
    titulo: String(titulo ?? '').slice(0, CARROSSEL_TWITTER_IA_MAX_TITULO_CHARS),
    subtitulo: String(subtitulo ?? '').slice(0, CARROSSEL_TWITTER_IA_MAX_SUBTITULO_CHARS),
  };
}

export const CARROSSEL_TITULO_FONTES = [
  'Inter',
  'Space Grotesk',
  'Syne',
  'Outfit',
  'DM Sans',
  'Raleway',
  'Bebas Neue',
  'Playfair Display',
  'Caveat',
  'Montserrat',
  'Plus Jakarta Sans',
  'Manrope',
  'Urbanist',
];

export function defaultSlide(index = 0) {
  const isFirst = index === 0;
  return {
    id: uuidv4(),
    titulo: isFirst ? 'Título do post' : 'Novo slide',
    subtitulo: isFirst ? 'Subtítulo ou frase de apoio' : 'Subtítulo do slide',
    corFundo: isFirst ? '#000000' : '#0a0a0a',
    corTitulo: '#ffffff',
    corSubtitulo: isFirst ? '#ffffff' : '#cccccc',
    imagemFundo: null,
    imagemPosX: 50,
    imagemPosY: 50,
    imagemZoom: 175,
    /** 1 = fundo 4:5 normal; N>1 = mesmo `imagemFundo` contínuo em N slides (janela 1080px por slide). */
    imagemPanoramaSlices: 1,
    imagemPanoramaIndex: 0,
    /** Slide onde se edita zoom/posição da arte (primeiro do intervalo); os outros só mostram a continuidade. */
    imagemPanoramaOriginSlideId: null,
    /** Agrupa slides do mesmo panorama (ao mudar intervalo / gerar). */
    imagemPanoramaGroupId: null,
    /** 0 = sem desvanecimento nas bordas do panorama; 100 = intensidade atual (laterais ~12%, topo/fundo ~9%). */
    imagemPanoramaVinheta: 100,
    overlayEstilo: isFirst ? 'nenhum' : 'topo-intenso',
    overlayOpacidade: isFirst ? 0 : 85,
    /** Cor da sombra/overlay. 'auto' escolhe preto/branco conforme luminância do fundo. */
    overlayCor: 'auto',
    /** Sem sobreposição tipo grade/bolinhas; UI “Grade” altera este campo para `grade`. */
    padrao: 'nenhum',
    padraoTamanho: 150,
    padraoOpacidade: 10,
    margemHorizontal: isFirst ? 96 : 130,
    margemVertical: isFirst ? 180 : 210,
    layoutPosicao: isFirst ? 'inf-centro' : 'sup-esq',
    alinhamento: isFirst ? 'centro' : 'esq',
    glass: false,
    /** Onde aplicar o glass quando `glass` é true: `ambos` | `titulo` | `subtitulo`. */
    glassAlvo: 'ambos',
    /** Glass no bloco título/subtítulo: raio, espaço em relação ao texto, cor de base, opacidade e desfoque. */
    glassBorderRadius: 16,
    glassPadding: 16,
    glassCor: '#0a0a0a',
    glassOpacidade: 25,
    glassBlur: 12,
    tituloTamanho: 90,
    tituloEscala: 70,
    tituloFonte: 'Inter',
    tituloPeso: 700,
    tituloEspacamento: -1,
    subtituloTamanho: isFirst ? 26 : 25,
    subtituloFonte: isFirst ? 'Playfair Display' : 'DM Sans',
    subtituloPeso: 400,
    /** Itálico no subtítulo (ex.: abertura minimal). */
    subtituloItalic: isFirst,
    subtituloEspacamento: 0,
    linhaEntreLinhas: 18,
    palavrasDestacadas: [],
    corDestaque: '#FFD700',
    formatacaoPalavras: {},
    cantoSupEsq: isFirst ? '@seuusuario' : '@usuario',
    cantoSupDir: isFirst ? 'Categoria' : 'NICHO',
    cantoInfEsq: isFirst ? 'Prospecção' : 'Impulsione seu negócio',
    cantoInfDir: isFirst ? 'Arrasta' : '',
    cantoSupEsqAtivo: true,
    cantoSupDirAtivo: true,
    cantoInfEsqAtivo: true,
    cantoInfDirAtivo: true,
    cantoIcone: isFirst ? 'none' : 'bookmark',
    cantoFonte: 20,
    cantoDist: 80,
    cantoOpacidade: 60,
    cantoGlass: false,
    cantoBordaMinimalista: false,
    mostrarBolinhas: !isFirst,
    /** Grade de padrão sobre o fundo (UI usa `padrao === 'grade'`); manter false por defeito. */
    mostrarGrade: false,
    mostrarBadge: false,
    badgeEstilo: 'glass',
    badgeTitulo: 'Título verificado',
    badgeHandle: 'Nome',
    badgeDescricao: '',
    badgeVerificado: true,
    badgeFotoUrl: null,
    badgeFotoRound: 100,
    badgeTamanhoGlobal: 100,
    badgeTamanhoSlide: 100,
    badgePosX: 28,
    badgePosY: 16,
    mostrarLogo: false,
    logoPng: null,
    logoArredondamento: 16,
    logoTamanhoGlobal: 100,
    logoTamanhoSlide: 100,
    logoPosX: 90,
    logoPosY: 10,
    mostrarBotoes: false,
    ctaTextoPrimario: 'Saiba mais',
    ctaTextoSecundario: 'Ver detalhes',
    ctaMostrarSecundario: false,
    ctaEstilo: 'solid',
    ctaAlinhamento: 'centro',
    ctaTamanho: 100,
    ctaPosX: 50,
    ctaPosY: 92,
    /**
     * Cartão estilo X (perfil + corpo + subtítulo + miniatura): posição vertical do bloco de texto/perfil
     * na faixa acima da grelha (`sup` | `centro` | `inf`).
     */
    twitterConteudoAnchorV: 'centro',
    /** Cartão X: posição horizontal do bloco no slide (`esq` | `centro` | `dir`). */
    twitterConteudoAnchorH: 'centro',
    /**
     * Grade de imagens no slide (vários recortes abaixo do texto).
     * Não confundir com `mostrarGrade` + `padrao === 'grade'` (padrão SVG decorativo sobre o fundo).
     */
    imagemGradeAtiva: false,
    /** '1' | '2h' | '2v' | '3' | '4q' — disposição e número de células. */
    imagemGradeLayout: '1',
    /** Proporção das células quando o canvas aplica moldura (Twitter / miniatura). */
    imagemGradeAspecto: '16:9',
    /**
     * Fração da altura do slide (0–1) onde começa a zona da grelha; `null` = heurística do canvas
     * conforme `imagemGradeAdaptarTexto`.
     */
    imagemGradeInicioFrac: null,
    /** Slots; o normalizador garante pelo menos o número exigido pelo layout (até 4). */
    imagemGradeSlots: [
      { imagem: null, posX: 50, posY: 50, zoom: 100 },
      { imagem: null, posX: 50, posY: 50, zoom: 100 },
      { imagem: null, posX: 50, posY: 50, zoom: 100 },
    ],
    /** MVP: reserva mais altura para o bloco de texto antes da grelha (ver canvas). */
    imagemGradeAdaptarTexto: true,
    /** Raio (px) dos cantos de cada célula da grelha. */
    imagemGradeRaio: 20,
  };
}

const CARROSSEL_GRADE_LAYOUTS = ['1', '2h', '2v', '3', '4q'];

/** Número de células usadas por layout (slots extra são ignorados no canvas). */
export function getCarrosselGradeSlotCount(layout) {
  const L = String(layout || '');
  if (L === '1') return 1;
  if (L === '2h' || L === '2v') return 2;
  if (L === '3') return 3;
  if (L === '4q') return 4;
  return 1;
}

/** Slots vazios normalizados (ex.: clone para IA / template sem base64). */
export function createEmptyImagemGradeSlots(count = 3) {
  const n = Math.min(4, Math.max(1, Math.floor(Number(count)) || 3));
  return Array.from({ length: n }, () => ({
    imagem: null,
    posX: 50,
    posY: 50,
    zoom: 100,
  }));
}

const CARROSSEL_GRADE_ASPECTOS = ['16:9', '1:1', '9:16', '4:5'];

/**
 * Proporções editáveis por layout (o canvas só aplica moldura em 1, 2h, 2v, 4q).
 * @param {string} layout
 * @returns {readonly string[]}
 */
export function getCarrosselGradeAspectoOptionsForLayout(layout) {
  const L = String(layout || '1');
  if (L === '3') return [];
  if (L === '2v') return ['9:16', '4:5'];
  if (L === '4q') return ['1:1', '4:5'];
  if (L === '2h') return ['16:9', '1:1', '4:5'];
  if (L === '1') return [...CARROSSEL_GRADE_ASPECTOS];
  return ['16:9'];
}

/**
 * Garante `imagemGradeSlots`, layout, aspecto e tipos válidos.
 * @param {Record<string, unknown>} slide
 */
export function normalizeCarrosselImagemGrade(slide) {
  if (!slide || typeof slide !== 'object') return slide;
  const layout = CARROSSEL_GRADE_LAYOUTS.includes(String(slide.imagemGradeLayout))
    ? String(slide.imagemGradeLayout)
    : '1';
  const slotNeed = getCarrosselGradeSlotCount(layout);
  const rawSlots = Array.isArray(slide.imagemGradeSlots) ? slide.imagemGradeSlots : [];
  const slots = Array.from({ length: slotNeed }, (_, i) => {
    const raw = rawSlots[i] && typeof rawSlots[i] === 'object' ? rawSlots[i] : {};
    const im = raw.imagem;
    const imagem = typeof im === 'string' && String(im).trim() ? String(im).trim() : null;
    const px = Number(raw.posX);
    const py = Number(raw.posY);
    const z = Number(raw.zoom);
    return {
      imagem,
      posX: Number.isFinite(px) ? Math.min(100, Math.max(0, px)) : 50,
      posY: Number.isFinite(py) ? Math.min(100, Math.max(0, py)) : 50,
      zoom: Number.isFinite(z) ? Math.min(300, Math.max(50, z)) : 100,
    };
  });
  let aspecto = CARROSSEL_GRADE_ASPECTOS.includes(String(slide.imagemGradeAspecto))
    ? String(slide.imagemGradeAspecto)
    : '16:9';
  if (layout === '2v' && !['9:16', '4:5'].includes(aspecto)) aspecto = '9:16';
  if (layout === '4q' && !['1:1', '4:5'].includes(aspecto)) aspecto = '1:1';

  const raio = Number(slide.imagemGradeRaio);
  const fracRaw = slide.imagemGradeInicioFrac;
  let imagemGradeInicioFrac = null;
  if (fracRaw !== null && fracRaw !== undefined && fracRaw !== '') {
    const f = Number(fracRaw);
    if (Number.isFinite(f)) imagemGradeInicioFrac = Math.min(0.58, Math.max(0.14, f));
  }

  return {
    ...slide,
    imagemGradeAtiva: Boolean(slide.imagemGradeAtiva),
    imagemGradeLayout: layout,
    imagemGradeAspecto: aspecto,
    imagemGradeInicioFrac,
    imagemGradeSlots: slots,
    imagemGradeAdaptarTexto: slide.imagemGradeAdaptarTexto !== false,
    imagemGradeRaio: Number.isFinite(raio) ? Math.min(64, Math.max(0, Math.round(raio))) : 20,
  };
}

/** @deprecated Prefer `LAYOUT_SHELL_FLEX` + margens em px no canvas; mantido para referência. */
export const LAYOUT_POS_MAP = {
  'sup-esq': { top: '8%', left: '8%', transform: 'none' },
  'sup-centro': { top: '8%', left: '50%', transform: 'translateX(-50%)' },
  'sup-dir': { top: '8%', right: '8%', left: 'auto', transform: 'none' },
  'meio-esq': { top: '50%', left: '8%', transform: 'translateY(-50%)' },
  meio: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
  'meio-dir': { top: '50%', right: '8%', left: 'auto', transform: 'translateY(-50%)' },
  'inf-esq': { bottom: '12%', left: '8%', top: 'auto', transform: 'none' },
  'inf-centro': { bottom: '12%', left: '50%', top: 'auto', transform: 'translateX(-50%)' },
  'inf-dir': { bottom: '12%', right: '8%', left: 'auto', top: 'auto', transform: 'none' },
};

/**
 * Posiciona o bloco título/subtítulo dentro da área útil (slide menos margens horiz./vert.).
 * `justifyContent` = eixo horizontal (esq / centro / dir); `alignItems` = eixo vertical (sup / meio / inf).
 */
export const LAYOUT_SHELL_FLEX = {
  'sup-esq': { justifyContent: 'flex-start', alignItems: 'flex-start' },
  'sup-centro': { justifyContent: 'center', alignItems: 'flex-start' },
  'sup-dir': { justifyContent: 'flex-end', alignItems: 'flex-start' },
  'meio-esq': { justifyContent: 'flex-start', alignItems: 'center' },
  meio: { justifyContent: 'center', alignItems: 'center' },
  'meio-dir': { justifyContent: 'flex-end', alignItems: 'center' },
  'inf-esq': { justifyContent: 'flex-start', alignItems: 'flex-end' },
  'inf-centro': { justifyContent: 'center', alignItems: 'flex-end' },
  'inf-dir': { justifyContent: 'flex-end', alignItems: 'flex-end' },
};

/** Recuo mínimo ao bordo físico do slide (nunca colar texto na borda). */
export const CARROSSEL_TITULO_BORDA_MIN_PX = 44;

/**
 * Inset horizontal (px) da área do título/subtítulo no slide.
 * Coluna esquerda: `left` = respiro mínimo; `right` = max(margem, mínimo).
 * Coluna direita: o inverso. Centro: os dois lados com max(margem, mínimo).
 */
export function carrosselTituloHorizontalInset(
  layoutPosicao,
  margemHorizontalPx,
  bordaMinPx = CARROSSEL_TITULO_BORDA_MIN_PX
) {
  const mh = Math.max(0, Number(margemHorizontalPx) || 0);
  const edge = Math.max(0, Number(bordaMinPx) || 0);
  const m = Math.max(mh, edge);
  const p = String(layoutPosicao || '');
  if (p === 'sup-centro' || p === 'meio' || p === 'inf-centro') {
    return { left: m, right: m };
  }
  if (p === 'sup-dir' || p === 'meio-dir' || p === 'inf-dir') {
    return { left: m, right: edge };
  }
  if (p === 'sup-esq' || p === 'meio-esq' || p === 'inf-esq') {
    return { left: edge, right: m };
  }
  return { left: m, right: m };
}

/** Inset vertical (px): simétrico; nunca menor que o respiro mínimo ao bordo. */
export function carrosselTituloVerticalInset(
  margemVerticalPx,
  bordaMinPx = CARROSSEL_TITULO_BORDA_MIN_PX
) {
  const mv = Math.max(0, Number(margemVerticalPx) || 0);
  const edge = Math.max(0, Number(bordaMinPx) || 0);
  const v = Math.max(mv, edge);
  return { top: v, bottom: v };
}
