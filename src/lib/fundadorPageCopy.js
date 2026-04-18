import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { BRANDING_ROW_ID } from '@/lib/landingPageCopy';

export const FundadorCopyContext = createContext(null);

const FAQ_DEFAULT_PAIRS = [
  [
    'Preciso saber design ou fazer prompts?',
    'Não. O Neuro Ápice já tem a inteligência de design embutida. Você escolhe o nicho, o estilo, clica em gerar e a arte sai pronta. Foi construído por um designer com 9 anos de experiência — essa inteligência já está dentro do sistema.',
  ],
  [
    'O que são "minhas próprias chaves de IA"?',
    'Você cria uma conta gratuita na OpenAI ou Google, gera uma chave de API e conecta no sistema. Leva 5 minutos. A partir daí, cada arte custa centavos e você não paga créditos pra ninguém. No bônus exclusivo, eu ensino como conseguir mais de R$1.500 em créditos gratuitos.',
  ],
  [
    'E se eu não gostar?',
    'Você tem 7 dias de garantia incondicional. Pediu reembolso, devolvemos tudo. Sem perguntas.',
  ],
  [
    'Isso substitui o Canva?',
    'Sim. O Neuro Ápice gera artes, textos, carrosséis, anúncios e sites em um só lugar. Você não precisa mais abrir Canva, ChatGPT ou Midjourney separadamente.',
  ],
  [
    'Quantas artes posso criar?',
    'Quantas quiser. A geração é ilimitada. O custo da API fica em centavos por arte.',
  ],
  [
    'Funciona pra igrejas?',
    'Sim. O módulo Artes de Culto foi feito especialmente pra criar comunicação visual de cultos, séries e eventos — toda semana, em segundos.',
  ],
  [
    'É mais uma plataforma que vou abandonar?',
    'O Neuro Ápice foi criado por quem abandonou todas as outras. Cada módulo existe porque eu precisei dele na prática. E como fundador, você tem acesso direto a mim — qualquer dúvida, sugestão ou dificuldade, eu estou ali.',
  ],
];

const MODULE_DEFAULT_CHIPS = [
  ['NeuroDesign', 'Artes em segundos, sem prompt'],
  ['Fluxo Criativo', 'Carrosséis e campanhas em um clique'],
  ['Gerador de conteúdo', 'Legenda, copy e roteiro'],
  ['Calendário', 'Planeje publicações'],
  ['Criador de anúncios', 'Copies e criativos prontos'],
  ['Planejador estratégico', 'Direção de conteúdo com IA'],
  ['Chat IA', 'Multimodelo'],
  ['Criador de sites', 'Landings sem código'],
  ['Artes de culto', 'Igrejas em segundos'],
];

const FEATURE_LINES_DEFAULT = [
  'NeuroDesign, agentes de conteúdo e Chat IA multimodelo',
  'Calendário, Criador de Anúncios e Planejador Estratégico',
  'Geração ilimitada com suas próprias chaves de API',
  'Fluxo Criativo + Criador de Sites e landing pages',
];

function expandFaq() {
  const o = {};
  FAQ_DEFAULT_PAIRS.forEach(([q, a], i) => {
    o[`faq_${i + 1}_q`] = q;
    o[`faq_${i + 1}_a`] = a;
  });
  return o;
}

function expandModuleChips() {
  const o = {};
  MODULE_DEFAULT_CHIPS.forEach(([label, sub], i) => {
    o[`mod_chip_${i + 1}_label`] = label;
    o[`mod_chip_${i + 1}_sub`] = sub;
  });
  return o;
}

function expandFeatures() {
  const o = {};
  FEATURE_LINES_DEFAULT.forEach((text, i) => {
    o[`feat_${i + 1}`] = text;
  });
  return o;
}

/** Textos padrão da landing /fundador (espelham FundadorLandingPage.jsx). */
export const DEFAULT_FUNDADOR_COPY = {
  meta_title: 'Turma Fundadora — Neuro Ápice',
  meta_description:
    'Plataforma de IA para artes, conteúdo e marketing. Turma fundadora: 60 vagas, preço especial e garantia de 7 dias.',

  link_auth: '/auth',
  link_privacy: '/politica-de-privacidade',
  link_platform_footer: '/auth',
  brand_alt: 'Neuro Ápice',
  brand_fallback_name: 'Neuro Ápice',

  /** URL completa (https://…) ou path interno (/…). Vazio = rolar suave até a secção Planos. */
  link_cta_hero: '',
  link_cta_header_planos: '',
  link_cta_criador: '',
  link_cta_final: '',

  checkout_standard_mensal: '',
  checkout_pro_mensal: '',
  checkout_standard_anual: '',
  checkout_pro_anual: '',

  /** Back redirect: URL https ao usar «voltar» no browser; anexa ?utm=… da landing. Vazio = usar só .env se existir. */
  back_redirect_url: '',

  vsl_youtube_id: '',
  /** Iframe, link ou bloco VTurb (HTML + JS do painel). Tem prioridade sobre vsl_youtube_id / .env */
  vsl_embed_html: '',
  /**
   * Opcional: snippet VTurb “Otimizar velocidade” para o &lt;head&gt; (script _plt + link preload/dns-prefetch).
   * Só domínios Converte AI / VTurb são aceites.
   */
  vsl_vturb_speed_head_html: '',

  nav_vsl: 'Vídeo',
  nav_como_funciona: 'Como funciona',
  nav_dor: 'O problema',
  nav_solucao: 'Solução',
  nav_criador: 'Quem criou',
  nav_neurodesigner: 'NeuroDesigner',
  nav_modulos: 'Módulos',
  nav_galeria: 'Resultados',
  nav_planos: 'Planos',
  nav_faq: 'FAQ',

  member_login_text: 'Já é membro? Fazer login →',
  header_ver_planos: 'Ver planos',
  aria_inicio: 'Início',
  aria_menu: 'Abrir menu',

  hero_badge: 'Turma fundadora · 60 vagas · Inteligência de design real',
  hero_title:
    'Crie artes profissionais em segundos — sem Canva, sem designer e sem pagar créditos',
  hero_subtitle:
    'O Neuro Ápice é a plataforma de IA com inteligência de design real. Você conecta, clica e a arte sai pronta. Veja como funciona.',
  hero_cta: 'Quero entrar na turma fundadora',
  hero_trust_1: '7 dias de garantia',
  hero_trust_2: 'Geração ilimitada',
  hero_trust_3: 'Suas chaves de IA',

  vsl_iframe_title: 'VSL Neuro Ápice',
  vsl_placeholder_html:
    'Cole o código de incorporação ou o link do vídeo em «Script / iframe da VSL» no Super Admin, ou configure o ID do YouTube / VITE_FUNDADOR_VSL_YOUTUBE_ID no .env.',

  demo_section_eyebrow: 'Na prática',
  demo_section_title: 'Veja cada ferramenta em ação',
  demo_section_subtitle:
    'Três pilares do Neuro Ápice em vídeo: NeuroDesigner, geração de conteúdo e carrosséis para redes sociais.',

  demo_neuro_title: 'NeuroDesigner',
  demo_neuro_intro:
    'Como transformar ideias em artes com inteligência de design real — sem passar horas ajustando layout no Canva.',
  demo_neuro_embed_html: '',
  demo_neuro_iframe_title: 'Como funciona o NeuroDesigner',
  demo_neuro_placeholder_html:
    'Cole o código VTurb ou o iframe do vídeo em «Como funciona — três vídeos» no Super Admin (bloco NeuroDesigner).',

  demo_content_title: 'Gerador de conteúdo',
  demo_content_intro:
    'Como produzir textos e peças de copy alinhados à sua marca, com o mesmo fluxo: conecta, clica, revisa.',
  demo_content_embed_html: '',
  demo_content_iframe_title: 'Como funciona o gerador de conteúdo',
  demo_content_placeholder_html:
    'Cole o código VTurb ou o iframe do vídeo em «Como funciona — três vídeos» no Super Admin (bloco Conteúdo).',

  demo_carousel_title: 'Criador de carrossel',
  demo_carousel_intro:
    'Como montar carrosséis para Instagram e outras redes — slides coerentes, rápidos e prontos para publicar.',
  demo_carousel_embed_html: '',
  demo_carousel_iframe_title: 'Como funciona o criador de carrossel',
  demo_carousel_placeholder_html:
    'Cole o código VTurb ou o iframe do vídeo em «Como funciona — três vídeos» no Super Admin (bloco Carrossel).',

  dor_eyebrow: 'O problema',
  dor_title: 'Você reconhece essa rotina?',
  dor_intro:
    'Ferramentas e tarefas espalhadas — sem um lugar que una tudo. Isso rouba tempo, dinheiro e foco todos os dias.',
  dor_c1t: 'Horas no Canva',
  dor_c1b:
    'Você gasta 30 minutos a 1 hora por arte. Ajusta fonte, cor, imagem, layout... e quando termina, já tem mais cinco esperando.',
  dor_c2t: 'Créditos que acabam',
  dor_c2b:
    'Paga Midjourney, ChatGPT, ferramentas de IA... e toda vez que o crédito acaba, tem que comprar mais. E o resultado nem sempre é bom.',
  dor_c3t: 'Dependência de designer',
  dor_c3b:
    'Contratar alguém bom custa caro. Alguém barato entrega mal. E esperar dias por uma arte trava o seu negócio.',
  dor_closing_before: 'Isso é o que chamamos de',
  dor_closing_highlight: 'Prisão do Improviso Criativo',
  dor_closing_after: '. E o Neuro Ápice foi construído pra acabar com ela.',

  sol_eyebrow: 'A solução',
  sol_title_before: 'Conheça o Neuro Ápice — seu',
  sol_title_highlight: 'Funcionário IA Perfeito',
  sol_p_bold: 'O Neuro Ápice é a plataforma de IA com inteligência de design real.',
  sol_p_rest:
    'Você conecta suas próprias chaves de IA, clica e o sistema gera artes profissionais, textos, carrosséis, anúncios e até sites — em segundos, sem limite, por centavos.',

  sol_hub_l1: 'Geração sem teto',
  sol_hub_l2: 'Sua API · centavos',
  sol_hub_l3: 'Um painel só',
  sol_hub_r1: 'Design com método',
  sol_hub_r2: 'Escala de peças',
  sol_hub_r3: 'Horas de volta',

  sol_diagram_eyebrow: 'Como a solução se organiza',
  sol_diagram_intro:
    'Cada rótulo ao redor é um ganho que você quer — custo sob controle, volume, tempo, design guiado. O Neuro Ápice concentra tudo no mesmo motor e entrega um fluxo único: conecta, clica, arte pronta.',
  sol_diagram_sr: 'Diagrama com seis benefícios ligados ao núcleo Neuro Ápice.',
  sol_diagram_footer:
    'Os três blocos abaixo aprofundam o que o diagrama resume: suas chaves, inteligência de design e tudo num só lugar.',
  sol_video_cta: 'Ver no vídeo na prática',

  sol_card_1t: 'Suas chaves, seu controle',
  sol_card_1b:
    'Sem créditos, sem limite. Você usa sua própria API e paga centavos por geração. Ninguém controla o que você pode criar.',
  sol_card_2t: 'Inteligência de design real',
  sol_card_2b:
    'Construído por um designer com 9 anos de experiência. Você não precisa saber fazer prompt. O sistema já sabe o que funciona.',
  sol_card_3t: 'Tudo em um só lugar',
  sol_card_3b:
    'Substitui Canva, ChatGPT, Midjourney e mais 5 ferramentas. Uma plataforma, uma assinatura, zero improviso.',

  providers_marquee_eyebrow: 'Modelos & APIs que você conecta',
  providers_marquee_title: 'Você não precisa assinar um cardápio de IAs separadas',
  providers_marquee_sub:
    'No Neuro Ápice você usa as suas próprias chaves. Um painel para gerar — sem acumular várias assinaturas e faturas só para criar conteúdo.',
  providers_marquee_items: `OpenAI · GPT
Anthropic · Claude
Google · Gemini
Meta · Llama
Mistral AI
xAI · Grok
Cohere
Perplexity`,
  /** Uma URL por linha, mesma ordem que providers_marquee_items; linha vazia = só texto. Uploads marquee_provider_N têm prioridade. */
  providers_marquee_logo_urls: '',

  neurodesigner_eyebrow: 'NeuroDesigner',

  criador_eyebrow: 'Quem criou o Neuro Ápice',
  criador_title: 'Criado por quem vive design há mais de 9 anos',
  criador_body: `Meu nome é Josias Bonfim de Faria. Sou designer, estrategista digital e CEO da JB Apex.

Nos últimos 9 anos, criei centenas de artes, campanhas e identidades visuais para empresas de todos os tamanhos. Eu conheço o processo de criação por dentro — as horas no Photoshop, os ajustes intermináveis, a pressão por entregar rápido e com qualidade.

Durante esse tempo, procurei uma ferramenta que fizesse tudo que eu precisava. Testei dezenas. Todas cobravam créditos, entregavam resultados genéricos e me faziam refazer o trabalho do zero.

Um dia eu cansei e decidi construir a minha própria.

O Neuro Ápice não é uma ferramenta criada por programadores que nunca abriram o Photoshop. É um sistema construído por um designer que passou quase uma década resolvendo os mesmos problemas que você enfrenta hoje.

Cada módulo existe porque eu precisei dele. Cada fluxo foi testado na prática. A inteligência de design que está dentro do sistema é a mesma que eu uso há 9 anos — só que agora ela trabalha em segundos.

E como membro da Turma Fundadora, você não vai ter acesso só ao sistema — vai ter acesso direto a mim.`,
  creator_photo_url: '',
  creator_photo_alt: 'Josias Bonfim de Faria — designer e CEO da JB Apex',
  creator_badge_enabled: '1',
  creator_badge_handle: '@eu.josiasfaria',
  creator_badge_followers: '~19,6 mil seguidores',
  creator_badge_url: 'https://www.instagram.com/eu.josiasfaria/',
  criador_cta: 'Quero entrar na turma fundadora',

  hub_phase_merge: 'Unindo',
  hub_phase_entries: 'Entradas',
  hub_core_title: 'Neuro Ápice',
  hub_core_tagline_rm: 'Conecta · Clica · Pronto',
  hub_core_tagline_anim: 'Conecta · Clica · Arte pronta',
  hub_core_badge: 'Unificado',
  hub_ciclo_footer: 'Ciclo contínuo · um fluxo',

  mod_eyebrow: 'Funcionalidades',
  mod_title: 'Tudo que você precisa em uma única plataforma',
  mod_subtitle:
    'Um ecossistema completo — do briefing visual ao calendário — com a mesma estética premium que você espera de uma ferramenta de topo.',
  mod_bento1_h: 'IA com DNA de designer de verdade',
  mod_bento1_p:
    'Proporção, hierarquia e legibilidade embutidas — não é só “imagem bonita”. O Neuro Ápice pensa como quem vive de entrega visual todos os dias.',
  mod_bento2_h: 'Do briefing à arte',
  mod_bento2_p:
    'Escolha nicho, estilo e formato. O fluxo guia você até variações alinhadas ao que você vende.',
  mod_bento3_h: 'Projetos & calendário',
  mod_bento3_p:
    'Organize campanhas, datas e entregáveis — do rascunho ao post sem perder o fio da meada.',
  mod_bento4_h: 'Variações sem refazer tudo',
  mod_bento4_p:
    'Gere formatos, cortes e mensagens diferentes em poucos cliques — ideal para testar o que converte sem começar do zero toda vez.',
  mod_included_eyebrow: 'Módulos incluídos',
  mod_included_sub: 'Cada um acessível dentro da mesma conta — você escolhe o que usar no dia a dia.',

  gal_eyebrow: 'Prova social',
  gal_title: 'Tudo isso foi criado com o Neuro Ápice',
  gal_subtitle:
    'Galeria com artes reais — posts, stories, carrosséis, capas, culto, anúncios. Vários nichos.',
  gal_footer:
    'Cada uma dessas artes foi gerada em segundos. Sem template. Sem Canva. Sem Photoshop. Apenas o Neuro Ápice.',
  gal_alt_prefix: 'Exemplo',

  pq_eyebrow: 'Para quem é',
  pq_title: 'Feito para quem vende criatividade e resultado',
  pq_subtitle:
    'O mesmo ritmo para cada cliente: cadastra, liga a agenda, clica em gerar e recebe a peça — depois é só repetir o ciclo.',
  pq_card1_t: 'Agências e Social Media',
  pq_card1_p:
    'Centralize clientes, campanhas e arte em um sistema que você pode apresentar como parte da sua própria operação. Produza em minutos o que antes levava dias.',
  pq_card2_t: 'Experts e Infoprodutores',
  pq_card2_p:
    'Organize lançamentos, conteúdos perpétuos e presença digital com IA focada em conversão. Do criativo ao site, tudo num só lugar.',

  flow_title: 'Fluxo criativo',
  flow_subtitle: 'Arraste os nós · Gere roteiro · Gere arte',
  flow_caption_anim: 'O cursor puxa cada nó, depois dispara roteiro e arte.',
  flow_caption_rm:
    'Monte o grafo com cliente e agente; em seguida gere roteiro e arte — a arte pode usar imagem da sua galeria no sistema.',
  flow_caption_done: 'Pronto: roteiro estruturado e arte visual — o ciclo recomeça.',
  flow_aria:
    'Animação: arrastar cliente e agente, gerar roteiro, gerar arte com imagem do sistema',
  flow_paleta: 'Paleta',
  flow_arraste: 'Arraste',
  flow_cliente: 'Cliente',
  flow_contexto: 'Contexto',
  flow_agente: 'Agente',
  flow_seu_cliente: 'Seu cliente',
  flow_cliente_exemplo: 'Bela Forma',
  flow_seu_contexto: 'Seu contexto',
  flow_neuro_title: 'Neuro Ápice',
  flow_gerar_roteiro: 'Gerar roteiro',
  flow_gerar_arte: 'Gerar arte',
  flow_roteiro_tab: 'Roteiro',
  flow_arte_tab: 'Arte',
  flow_roteiro_hints: 'Ganchos · CTA · legenda',
  flow_galeria_label: 'Da sua galeria',

  plans_eyebrow: 'Planos',
  plans_title: 'Planos e preços',
  plans_subtitle:
    'Turma fundadora — apenas 60 vagas. O menor preço que o Neuro Ápice vai ter; quando fechar, o valor sobe e essa condição não volta.',
  tab_mensal: 'Mensal',
  tab_anual: 'Anual',
  tab_anual_suffix: '(até 32% off)',

  plan_standard_name: 'STANDARD',
  plan_pro_name: 'PRO',
  plan_pro_badge: 'RECOMENDADO',

  plan_m_std_reais: '147',
  plan_m_std_cents: '00',
  plan_m_std_suffix: '/mês',
  plan_m_std_hint: 'Cobrança recorrente mensal. Cancele quando quiser.',
  plan_m_std_audience: 'Para quem quer IA no dia a dia sem pagar pelo pacote completo.',
  plan_m_std_cta: 'Selecionar Standard',

  plan_m_pro_reais: '247',
  plan_m_pro_cents: '00',
  plan_m_pro_suffix: '/mês',
  plan_m_pro_hint: 'Tudo liberado — Fluxo Criativo, sites e todos os módulos.',
  plan_m_pro_audience: 'Para quem quer o ecossistema completo na mão.',
  plan_m_pro_cta: 'Selecionar Pro',

  plan_a_std_discount: '32% OFF',
  plan_a_std_reais: '99',
  plan_a_std_cents: '90',
  plan_a_std_suffix: '/mês',
  plan_a_std_audience: 'Mesmos recursos do Standard, com o melhor preço médio na turma fundadora.',
  plan_a_std_cta: 'Selecionar Standard',

  plan_a_pro_discount: '20% OFF',
  plan_a_pro_reais: '197',
  plan_a_pro_cents: '00',
  plan_a_pro_suffix: '/mês',
  plan_a_pro_audience: 'Quem quer escalar com o sistema inteiro e suporte à comunidade fundadora.',
  plan_a_pro_cta: 'Selecionar Pro',

  annual_line: '12 mensalidades sem bloquear o valor total no cartão',
  annual_tooltip:
    'Este não é um plano mensal — é um contrato anual com pagamento facilitado em 12x que somente usa o limite da mensalidade de cada mês.',

  plan_footer_guarantee: '7 dias de garantia',
  plan_footer_secure: 'Compra segura',

  plans_guarantee_badge_1: '100% dinheiro de volta',
  plans_guarantee_days: '7',
  plans_guarantee_days_label: 'dias',
  plans_guarantee_ribbon: 'Garantido',
  plans_guarantee_title: 'Garantia de 7 dias',
  plans_guarantee_text:
    'Teste o Neuro Ápice com calma. Se por qualquer motivo não for pra você, é só pedir o reembolso dentro de 7 dias e devolvemos 100% do valor. Sem letras miúdas — queremos fundadores satisfeitos, não presos.',
  plans_note:
    'Todos os planos incluem geração ilimitada com suas próprias chaves de IA. O custo por arte fica em centavos — você não paga créditos internos da plataforma.',

  bonus_eyebrow: 'Bônus de fundador',
  bonus_title: 'Exclusivo para quem entrar agora como fundador',
  bonus_1_t: 'Aulas completas do sistema',
  bonus_1_b:
    'Passo a passo de cada módulo, do básico ao avançado. Você não vai ficar perdido. Em poucos minutos vai estar gerando como profissional.',
  bonus_1_image_url: '',
  bonus_1_points:
    'Passo a passo de **cada módulo**, do básico ao avançado\nVocê não fica perdido: fluxo claro do zero ao resultado\nEm poucos minutos gerando com **ritmo profissional**',
  bonus_1_value_label: 'Referência de treinamentos no mercado:',
  bonus_1_value_highlight: 'R$ 297+',
  bonus_2_t: 'Como conseguir US$300 em créditos de IA (mais de R$1.500)',
  bonus_2_b:
    'Eu vou te ensinar como gerar artes e conteúdo praticamente ilimitado sem gastar nada além da mensalidade do sistema. Só esse bônus já paga meses de uso.',
  bonus_2_image_url: '',
  bonus_2_points:
    'Como ativar **US$ 300** em créditos (mais de **R$ 1.500** em uso real)\nArtes e textos no ritmo que você precisa, **sem depender de crédito interno**\nEsse bônus sozinho costuma **pagar meses** de assinatura',
  bonus_2_value_label: 'Economia em APIs / tráfego:',
  bonus_2_value_highlight: 'R$ 1.500+',
  bonus_3_t: 'Comunidade exclusiva + acesso ao criador',
  bonus_3_b:
    'Grupo de fundadores com lives de estratégia e suporte direto com Josias Bonfim de Faria, o criador do Neuro Ápice. Você não vai estar sozinho.',
  bonus_3_image_url: '',
  bonus_3_points:
    'Grupo **exclusivo** de fundadores\nLives de estratégia e novidades **antes de todo mundo**\nCanal direto com **Josias Bonfim de Faria**, criador do Neuro Ápice',
  bonus_3_value_label: 'Mentoria + comunidade (referência):',
  bonus_3_value_highlight: 'Exclusivo turma fundadora',

  g2_eyebrow: 'Garantia',
  g2_title: '7 dias de garantia incondicional',
  g2_p:
    'Use o Neuro Ápice por 7 dias. Explore todos os módulos. Gere quantas artes quiser. Se por qualquer motivo você sentir que não é pra você, peça o reembolso e devolvemos 100% do seu investimento. Sem perguntas. Sem burocracia. O risco é todo meu.',
  g2_circle_1: 'Garantia 7 dias',
  g2_circle_2: '100% do valor',

  faq_eyebrow: 'FAQs',
  faq_title: 'Perguntas frequentes',

  final_title: 'Sua vez de sair da Prisão do Improviso Criativo',
  final_p:
    '60 vagas. Preço de fundador. Bônus exclusivos. Garantia de 7 dias. Tudo que você precisa pra transformar a forma como produz conteúdo — por menos de R$3,33 por dia.',
  final_cta: 'Quero entrar na turma fundadora',

  footer_privacy: 'Política de privacidade',
  footer_platform: 'Acesso à plataforma',
  footer_copy: '© {year} JB Apex · Neuro Ápice · Todos os direitos reservados',

  ...expandFaq(),
  ...expandModuleChips(),
  ...expandFeatures(),
};

export const FUNDADOR_NAV_IDS = [
  'vsl',
  'como-funciona',
  'dor',
  'solucao',
  'criador',
  'neurodesigner',
  'modulos',
  'galeria',
  'planos',
  'faq',
];

export function fundadorNavLabelKey(id) {
  const map = {
    vsl: 'nav_vsl',
    'como-funciona': 'nav_como_funciona',
    dor: 'nav_dor',
    solucao: 'nav_solucao',
    criador: 'nav_criador',
    neurodesigner: 'nav_neurodesigner',
    modulos: 'nav_modulos',
    galeria: 'nav_galeria',
    planos: 'nav_planos',
    faq: 'nav_faq',
  };
  return map[id] || 'nav_vsl';
}

/** Chaves `nav_*` usadas no menu da landing /fundador. */
export const FUNDADOR_NAV_LABEL_KEYS = FUNDADOR_NAV_IDS.map((id) => fundadorNavLabelKey(id));

/**
 * Campos em que string vazia guardada no JSON deve prevalecer (ocultar na LP), em vez de voltar ao default.
 * Só aplica quando a chave existe em `partial` (ex.: após gravar no Super Admin).
 */
export const FUNDADOR_OPTIONAL_EMPTY_STRING_KEYS = [
  ...FUNDADOR_NAV_LABEL_KEYS,
  'member_login_text',
  'header_ver_planos',
];

export function mergeFundadorCopy(partial) {
  const src = partial && typeof partial === 'object' ? partial : {};
  const out = { ...DEFAULT_FUNDADOR_COPY };
  for (const key of Object.keys(DEFAULT_FUNDADOR_COPY)) {
    const v = src[key];
    if (FUNDADOR_OPTIONAL_EMPTY_STRING_KEYS.includes(key)) {
      if (Object.prototype.hasOwnProperty.call(src, key)) {
        out[key] = typeof v === 'string' ? v.trim() : '';
      }
      continue;
    }
    if (typeof v === 'string' && v.trim() !== '') {
      out[key] = v;
    }
  }
  // Chaves guardadas no JSON mas ainda não listadas no DEFAULT (deploy antigo / novos campos)
  for (const key of Object.keys(src)) {
    if (key in out) continue;
    const v = src[key];
    if (typeof v === 'string' && v.trim() !== '') {
      out[key] = v;
    }
  }
  return out;
}

/**
 * Converte um possível src de vídeo (string) num URL https seguro para iframe, ou null.
 */
function finalizeFundadorVslEmbedSrc(srcRaw) {
  if (!srcRaw || typeof srcRaw !== 'string') return null;
  let src = srcRaw.trim().replace(/[),.;]+$/, '');
  if (!src) return null;
  if (src.startsWith('//')) src = `https:${src}`;

  let u;
  try {
    u = new URL(src);
  } catch {
    return null;
  }

  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  const httpsHref =
    u.protocol === 'http:' ? `https://${u.host}${u.pathname}${u.search}${u.hash}` : u.href;
  const nu = new URL(httpsHref);

  const normalized = normalizeFundadorVslWatchUrlToEmbed(nu);
  if (normalized) return normalized;

  if (isAllowedFundadorVslEmbedUrl(nu)) return nu.href;

  return null;
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Aspas “inteligentes” e espaços ao colar do Word/painel. */
function normalizeVturbPaste(raw) {
  return String(raw)
    .trim()
    .replace(/[\u201c\u201d\u00ab\u00bb]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

/**
 * Extrai a URL do player.js (único host permitido: scripts.converteai.net).
 * Aceita: URL solta, caminho /v4/player.js ou futuras variantes, e o JS minificado (s.src="https://...").
 */
function extractConverteAiPlayerJsUrl(t) {
  const candidates = [];

  const strict = t.match(
    /https:\/\/scripts\.converteai\.net\/[a-zA-Z0-9-]+\/players\/[a-zA-Z0-9]+\/v\d+\/player\.js/i
  );
  if (strict) candidates.push(strict[0]);

  const loose = t.match(/https:\/\/scripts\.converteai\.net\/[^\s"'<>]+\.js/i);
  if (loose) candidates.push(loose[0]);

  const fromAssign = t.match(/\.src\s*=\s*["'](https:\/\/scripts\.converteai\.net\/[^"']+)["']/i);
  if (fromAssign) candidates.push(fromAssign[1]);

  const seen = new Set();
  for (let c of candidates) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    c = c.split('?')[0];
    if (c.startsWith('http://')) c = `https://${c.slice('http://'.length)}`;
    try {
      const url = new URL(c);
      if (url.hostname !== 'scripts.converteai.net') continue;
      if (!/\.js$/i.test(url.pathname)) continue;
      return c;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Incorporação VTurb / Converte AI (custom element + script em scripts.converteai.net).
 * Aceita o código **completo** colado do painel: `<vturb-smartplayer>...</vturb-smartplayer>` e o bloco
 * `<script>...</script>` com `document.createElement` / `s.src="...player.js"`.
 *
 * `embedHtml` segue o padrão da VTurb para React (HTML bruto + carregamento do script na app), evitando
 * executar HTML arbitrário no cliente; só URLs validadas em scripts.converteai.net são carregadas.
 *
 * @returns {{ scriptSrc: string, smartplayerId: string, embedHtml: string, style: Record<string, string> } | null}
 */
export function parseFundadorVslVturbEmbed(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const t = normalizeVturbPaste(raw);
  if (!t) return null;

  let scriptSrc = extractConverteAiPlayerJsUrl(t);

  const pathIdMatch = scriptSrc?.match(/\/players\/([a-fA-F0-9]+)\//i);
  const idFromUrl = pathIdMatch?.[1];

  const idAttr = t.match(/<vturb-smartplayer[^>]*\bid\s*=\s*["']([^"']+)["']/i);
  const smartplayerId = idAttr?.[1] || (idFromUrl ? `vid-${idFromUrl}` : null);

  if (!scriptSrc || !smartplayerId) return null;
  if (!/^https:\/\/scripts\.converteai\.net\//i.test(scriptSrc)) return null;

  const styleMatch = t.match(/<vturb-smartplayer[^>]*\bstyle\s*=\s*["']([^"']*)["']/i);
  const styleAttr = styleMatch?.[1]?.trim() || 'display: block; margin: 0 auto; width: 100%;';
  const style = parseVturbStyleString(styleMatch?.[1]);
  const embedHtml = `<vturb-smartplayer id="${escapeHtmlAttr(smartplayerId)}" style="${escapeHtmlAttr(styleAttr)}"></vturb-smartplayer>`;

  return { scriptSrc, smartplayerId, embedHtml, style };
}

/** Converte style="display: block; ..." num objeto adequado ao React. */
function parseVturbStyleString(styleAttr) {
  const defaults = { display: 'block', margin: '0 auto', width: '100%' };
  if (!styleAttr || typeof styleAttr !== 'string') return defaults;
  const s = styleAttr.trim();
  if (!s) return defaults;
  const out = { ...defaults };
  for (const part of s.split(';')) {
    const idx = part.indexOf(':');
    if (idx === -1) continue;
    const name = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (!name || !val) continue;
    const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = val;
  }
  return out;
}

/**
 * Extrai uma URL segura para iframe a partir do HTML de incorporação ou de um link direto.
 * Remove blocos <script>; aceita hosts comuns (YouTube, Vimeo, Panda Video, Wistia, Loom, Vidyard).
 * Para VTurb/Converte AI use {@link parseFundadorVslVturbEmbed} (o iframe não aplica a esse player).
 */
export function parseFundadorVslEmbedSrc(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let trimmed = raw.trim();
  if (!trimmed) return null;

  trimmed = trimmed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
  if (!trimmed) return null;

  const candidates = [];

  const quoted = trimmed.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/is);
  const unquoted = quoted ? null : trimmed.match(/<iframe\b[^>]*\bsrc\s*=\s*([^\s>]+)/is);
  if (quoted) candidates.push(quoted[1].trim());
  else if (unquoted) candidates.push(unquoted[1].trim());

  // Incorporações com quebras de linha / atributos fora de ordem: primeiro src=https em contexto iframe
  if (/<iframe/i.test(trimmed)) {
    const loose = trimmed.match(/\bsrc\s*=\s*["'](https?:\/\/[^"']+)["']/i);
    if (loose) candidates.push(loose[1].trim());
  }

  if (/^https?:\/\//i.test(trimmed) && !/<iframe/i.test(trimmed)) {
    candidates.push(trimmed.split(/\r?\n/)[0].trim().split(/\s+/)[0]);
  }

  const urlScan = trimmed.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  for (const u of urlScan) {
    candidates.push(u.trim());
  }

  const seen = new Set();
  for (const c of candidates) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    const done = finalizeFundadorVslEmbedSrc(c);
    if (done) return done;
  }

  return null;
}

/**
 * Vídeo opcional (demos): só a partir do HTML colado — VTurb, iframe ou URL.
 * Sem fallback para YouTube global / .env (diferente da VSL principal).
 *
 * @returns {{ mode: 'vturb', vturb: object } | { mode: 'iframe', src: string } | { mode: 'placeholder' }}
 */
export function resolveFundadorOptionalVideoEmbed(raw) {
  const t = typeof raw === 'string' ? raw.trim() : '';
  if (!t) return { mode: 'placeholder' };
  const vturb = parseFundadorVslVturbEmbed(t);
  if (vturb) return { mode: 'vturb', vturb };
  const iframeSrc = parseFundadorVslEmbedSrc(t);
  if (iframeSrc) return { mode: 'iframe', src: iframeSrc };
  return { mode: 'placeholder' };
}

/**
 * Pelo menos um dos três campos de embed da secção «Como funciona» tem texto colado.
 * Se os três estiverem vazios, a landing não mostra a secção nem o item «como-funciona» no menu.
 */
export function hasFundadorDemoVideoEmbeds(fc) {
  if (!fc || typeof fc !== 'object') return false;
  const neuro = (fc.demo_neuro_embed_html || '').trim();
  const content = (fc.demo_content_embed_html || '').trim();
  const carousel = (fc.demo_carousel_embed_html || '').trim();
  return Boolean(neuro || content || carousel);
}

function normalizeFundadorVslWatchUrlToEmbed(u) {
  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  const path = u.pathname || '';

  if (host === 'youtu.be') {
    const id = path.replace(/^\//, '').split(/[/?#]/)[0];
    if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
    return null;
  }

  if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    const v = u.searchParams.get('v');
    if (v) return `https://www.youtube-nocookie.com/embed/${v}?rel=0`;
    const shorts = path.match(/^\/shorts\/([\w-]+)/);
    if (shorts?.[1]) return `https://www.youtube-nocookie.com/embed/${shorts[1]}?rel=0`;
    if (path.startsWith('/embed/')) {
      const id = path.slice('/embed/'.length).split(/[/?#]/)[0];
      if (id) {
        const q = u.searchParams.toString();
        return `https://www.youtube-nocookie.com/embed/${id}${q ? `?${q}` : '?rel=0'}`;
      }
    }
  }

  if (host === 'vimeo.com' || host.endsWith('.vimeo.com')) {
    const m = path.match(/^\/(\d{6,})/);
    if (m) return `https://player.vimeo.com/video/${m[1]}${u.search || ''}`;
  }

  return null;
}

function isAllowedFundadorVslEmbedUrl(u) {
  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  const path = u.pathname || '';

  if (host.endsWith('youtube-nocookie.com') && path.startsWith('/embed/')) return true;
  if (host === 'player.vimeo.com' && path.startsWith('/video/')) return true;
  if (host.includes('wistia.com') || host.includes('wistia.net')) return true;
  if (host.includes('loom.com')) return true;
  if (host.includes('vidyard.com')) return true;
  /* Panda Video (ex.: player-*.tv.pandavideo.com.br/embed/) */
  if (host.includes('pandavideo.com.br') || host.endsWith('pandavideo.com')) return true;
  return false;
}

/** Linhas de rótulo da faixa de provedores (marquee). */
export function parseProvidersMarqueeItemLines(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw.split('\n').map((s) => s.trim()).filter(Boolean);
}

/** Linhas de URL opcionais; índice alinhado a parseProvidersMarqueeItemLines. */
export function parseProvidersMarqueeLogoUrlLines(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw.split('\n').map((s) => s.trim());
}

/**
 * Entradas da faixa: rótulo (sempre exibido) + URL de logo opcional à frente do texto.
 * Prioridade: asset `marquee_provider_{i+1}` em landing → linha i de providers_marquee_logo_urls.
 */
export function buildProvidersMarqueeEntries(itemsRaw, urlsRaw, landingAssets) {
  const labels = parseProvidersMarqueeItemLines(itemsRaw);
  const urlLines = parseProvidersMarqueeLogoUrlLines(urlsRaw);
  const assets = landingAssets && typeof landingAssets === 'object' ? landingAssets : {};
  return labels.map((label, i) => {
    const sk = `marquee_provider_${i + 1}`;
    const fromStorage = typeof assets[sk] === 'string' ? assets[sk].trim() : '';
    const fromUrlField = urlLines[i] && urlLines[i].length > 0 ? urlLines[i] : '';
    const logoUrl = fromStorage || fromUrlField;
    return { label, logoUrl };
  });
}

export async function fetchFundadorPageCopyRow() {
  const { data, error } = await supabase
    .from('system_branding')
    .select('fundador_page_copy')
    .eq('id', BRANDING_ROW_ID)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[fundadorPageCopy] fetch error:', error);
    }
    return mergeFundadorCopy({});
  }
  return mergeFundadorCopy(data?.fundador_page_copy);
}

export function useFundadorPageCopy() {
  const [copy, setCopy] = useState(() => mergeFundadorCopy({}));

  useEffect(() => {
    let ok = true;

    const load = async () => {
      const merged = await fetchFundadorPageCopyRow();
      if (ok) setCopy(merged);
    };

    load();

    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };

    const onPageShow = (e) => {
      if (e.persisted) load();
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      ok = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  return copy;
}

export function useFundadorCopy() {
  const ctx = useContext(FundadorCopyContext);
  if (!ctx) {
    throw new Error('useFundadorCopy must be used within FundadorCopyContext.Provider');
  }
  return ctx;
}

/** Para componentes opcionais (ex.: testes) — prefira useFundadorCopy na LP. */
/** Metadados do formulário super admin (ordem e rótulos). */
export const FUNDADOR_COPY_UI_SECTIONS = [
  {
    title: 'SEO e links',
    fields: [
      { key: 'meta_title', label: 'Título da aba (document.title)', rows: 1 },
      { key: 'meta_description', label: 'Meta description', rows: 3 },
      { key: 'link_auth', label: 'Link “login / plataforma” (path ou URL)', rows: 1 },
      { key: 'link_privacy', label: 'Link política de privacidade', rows: 1 },
      { key: 'link_platform_footer', label: 'Link “Acesso à plataforma” no rodapé', rows: 1 },
      { key: 'brand_alt', label: 'Texto alternativo do logo', rows: 1 },
      { key: 'brand_fallback_name', label: 'Nome da marca (fallback sem logo)', rows: 1 },
    ],
  },
  {
    title: 'CTAs da landing — para onde vão os botões',
    fields: [
      {
        key: 'link_cta_hero',
        label:
          'URL do CTA abaixo do vídeo (hero). https://… ou /caminho. Vazio = rolar até «Planos».',
        rows: 2,
      },
      {
        key: 'link_cta_header_planos',
        label: 'URL do botão «Ver planos» no cabeçalho (desktop e menu mobile). Vazio = rolar até «Planos».',
        rows: 2,
      },
      {
        key: 'link_cta_criador',
        label: 'URL do botão na secção «Quem criou». Vazio = rolar até «Planos».',
        rows: 2,
      },
      {
        key: 'link_cta_final',
        label: 'URL do botão no bloco final (antes do rodapé). Vazio = rolar até «Planos».',
        rows: 2,
      },
    ],
  },
  {
    title: 'Back redirect + UTMs (tecla «voltar»)',
    fields: [
      {
        key: 'back_redirect_url',
        label:
          'URL completa (https://…) para onde ir quando o visitante usar «voltar» no browser. A query da landing (?utm_…, src, etc.) é anexada automaticamente. Vazio = desligado no painel (pode usar VITE_FUNDADOR_BACK_REDIRECT_URL no .env).',
        rows: 2,
      },
    ],
  },
  {
    title: 'Checkout — links dos botões dos planos (sobrescreve .env se preenchido)',
    fields: [
      {
        key: 'checkout_standard_mensal',
        label: 'Standard · mensal — URL do botão (Hotmart, Stripe, etc.)',
        rows: 2,
      },
      {
        key: 'checkout_pro_mensal',
        label: 'Pro · mensal — URL do botão',
        rows: 2,
      },
      {
        key: 'checkout_standard_anual',
        label: 'Standard · anual — URL do botão',
        rows: 2,
      },
      {
        key: 'checkout_pro_anual',
        label: 'Pro · anual — URL do botão',
        rows: 2,
      },
      {
        key: 'vsl_youtube_id',
        label: 'ID ou URL do YouTube (VSL) — usado se o campo de incorporação abaixo estiver vazio',
        rows: 2,
      },
    ],
  },
  {
    title: 'Menu e cabeçalho',
    fields: [
      { key: 'nav_vsl', label: 'Nav: Vídeo (vazio = oculto no menu)', rows: 1 },
      { key: 'nav_como_funciona', label: 'Nav: Como funciona — três vídeos (vazio = oculto)', rows: 1 },
      { key: 'nav_dor', label: 'Nav: O problema (vazio = oculto)', rows: 1 },
      { key: 'nav_solucao', label: 'Nav: Solução (vazio = oculto)', rows: 1 },
      { key: 'nav_criador', label: 'Nav: Quem criou (vazio = oculto)', rows: 1 },
      { key: 'nav_neurodesigner', label: 'Nav: NeuroDesigner (vazio = oculto)', rows: 1 },
      { key: 'nav_modulos', label: 'Nav: Módulos (vazio = oculto)', rows: 1 },
      { key: 'nav_galeria', label: 'Nav: Resultados (vazio = oculto)', rows: 1 },
      { key: 'nav_planos', label: 'Nav: Planos (vazio = oculto)', rows: 1 },
      { key: 'nav_faq', label: 'Nav: FAQ (vazio = oculto)', rows: 1 },
      { key: 'member_login_text', label: 'Texto “Já é membro?” (vazio = oculto)', rows: 1 },
      { key: 'header_ver_planos', label: 'Botão Ver planos (vazio = oculto)', rows: 1 },
      { key: 'aria_inicio', label: 'Aria-label logo (início)', rows: 1 },
      { key: 'aria_menu', label: 'Aria-label menu mobile', rows: 1 },
    ],
  },
  {
    title: 'Hero + VSL',
    fields: [
      { key: 'hero_badge', label: 'Selo (badge) acima do título', rows: 2 },
      { key: 'hero_title', label: 'Título principal', rows: 3 },
      { key: 'hero_subtitle', label: 'Subtítulo', rows: 4 },
      { key: 'hero_cta', label: 'Botão CTA abaixo do vídeo', rows: 2 },
      { key: 'hero_trust_1', label: 'Trust 1', rows: 1 },
      { key: 'hero_trust_2', label: 'Trust 2', rows: 1 },
      { key: 'hero_trust_3', label: 'Trust 3', rows: 1 },
      { key: 'vsl_iframe_title', label: 'Título acessível do iframe', rows: 1 },
      {
        key: 'vsl_embed_html',
        label:
          'VSL — iframe, URL ou código VTurb/Converte AI (prioridade máxima). YouTube/Vimeo/Panda: iframe ou link. VTurb: cole o código completo do painel (tag <vturb-smartplayer> + bloco JavaScript com s.src apontando para scripts.converteai.net/.../player.js). Esse script é interpretado pela página; outros embeds só usam iframe e continuam sem executar JS arbitrário.',
        rows: 10,
      },
      {
        key: 'vsl_vturb_speed_head_html',
        label:
          'VTurb — otimizar velocidade de carregamento (vai para o <head> desta página). Cole o bloco do painel VTurb: script do _plt + tags <link rel="preload"> e <link rel="dns-prefetch">. Apenas URLs em *.converteai.net e *.vturb.com.br; o script inline deve conter _plt (marcador de performance).',
        rows: 14,
      },
      { key: 'vsl_placeholder_html', label: 'Texto quando não há vídeo válido', rows: 3 },
    ],
  },
  {
    title:
      'Como funciona — três vídeos (NeuroDesigner / conteúdo / carrossel). A secção na /fundador só aparece se pelo menos um dos três embeds tiver código.',
    fields: [
      { key: 'demo_section_eyebrow', label: 'Eyebrow da secção', rows: 1 },
      { key: 'demo_section_title', label: 'Título da secção', rows: 2 },
      { key: 'demo_section_subtitle', label: 'Subtítulo da secção', rows: 3 },
      { key: 'demo_neuro_title', label: '1 — Título (NeuroDesigner)', rows: 1 },
      { key: 'demo_neuro_intro', label: '1 — Texto curto', rows: 3 },
      { key: 'demo_neuro_iframe_title', label: '1 — Título acessível do vídeo', rows: 1 },
      {
        key: 'demo_neuro_embed_html',
        label:
          '1 — VTurb / iframe / URL (NeuroDesigner). Mesmo formato que a VSL: código completo VTurb ou link/embed.',
        rows: 8,
      },
      { key: 'demo_neuro_placeholder_html', label: '1 — Texto quando não há vídeo', rows: 2 },
      { key: 'demo_content_title', label: '2 — Título (gerador de conteúdo)', rows: 1 },
      { key: 'demo_content_intro', label: '2 — Texto curto', rows: 3 },
      { key: 'demo_content_iframe_title', label: '2 — Título acessível do vídeo', rows: 1 },
      {
        key: 'demo_content_embed_html',
        label: '2 — VTurb / iframe / URL (conteúdo)',
        rows: 8,
      },
      { key: 'demo_content_placeholder_html', label: '2 — Texto quando não há vídeo', rows: 2 },
      { key: 'demo_carousel_title', label: '3 — Título (carrossel)', rows: 1 },
      { key: 'demo_carousel_intro', label: '3 — Texto curto', rows: 3 },
      { key: 'demo_carousel_iframe_title', label: '3 — Título acessível do vídeo', rows: 1 },
      {
        key: 'demo_carousel_embed_html',
        label: '3 — VTurb / iframe / URL (carrossel)',
        rows: 8,
      },
      { key: 'demo_carousel_placeholder_html', label: '3 — Texto quando não há vídeo', rows: 2 },
    ],
  },
  {
    title: 'Seção “O problema”',
    fields: [
      { key: 'dor_eyebrow', label: 'Eyebrow', rows: 1 },
      { key: 'dor_title', label: 'Título', rows: 2 },
      { key: 'dor_intro', label: 'Intro', rows: 3 },
      { key: 'dor_c1t', label: 'Card 1 título', rows: 1 },
      { key: 'dor_c1b', label: 'Card 1 texto', rows: 3 },
      { key: 'dor_c2t', label: 'Card 2 título', rows: 1 },
      { key: 'dor_c2b', label: 'Card 2 texto', rows: 3 },
      { key: 'dor_c3t', label: 'Card 3 título', rows: 1 },
      { key: 'dor_c3b', label: 'Card 3 texto', rows: 3 },
      { key: 'dor_closing_before', label: 'Fechamento — antes do destaque', rows: 1 },
      { key: 'dor_closing_highlight', label: 'Fechamento — destaque (cor primary)', rows: 1 },
      { key: 'dor_closing_after', label: 'Fechamento — depois do destaque', rows: 1 },
    ],
  },
  {
    title: 'Seção “A solução”',
    fields: [
      { key: 'sol_eyebrow', label: 'Eyebrow', rows: 1 },
      { key: 'sol_title_before', label: 'Título — antes do gradiente', rows: 2 },
      { key: 'sol_title_highlight', label: 'Título — destaque (gradiente)', rows: 2 },
      { key: 'sol_p_bold', label: 'Parágrafo — trecho em negrito', rows: 2 },
      { key: 'sol_p_rest', label: 'Parágrafo — restante', rows: 4 },
      { key: 'sol_hub_l1', label: 'Hub raio esq. 1', rows: 1 },
      { key: 'sol_hub_l2', label: 'Hub raio esq. 2', rows: 1 },
      { key: 'sol_hub_l3', label: 'Hub raio esq. 3', rows: 1 },
      { key: 'sol_hub_r1', label: 'Hub raio dir. 1', rows: 1 },
      { key: 'sol_hub_r2', label: 'Hub raio dir. 2', rows: 1 },
      { key: 'sol_hub_r3', label: 'Hub raio dir. 3', rows: 1 },
      { key: 'sol_diagram_eyebrow', label: 'Diagrama — eyebrow', rows: 1 },
      { key: 'sol_diagram_intro', label: 'Diagrama — parágrafo', rows: 4 },
      { key: 'sol_diagram_sr', label: 'Diagrama — texto screen reader', rows: 2 },
      { key: 'sol_diagram_footer', label: 'Diagrama — texto acima do botão vídeo', rows: 3 },
      { key: 'sol_video_cta', label: 'Botão “Ver no vídeo”', rows: 1 },
      { key: 'sol_card_1t', label: 'Card 1 título', rows: 1 },
      { key: 'sol_card_1b', label: 'Card 1 texto', rows: 3 },
      { key: 'sol_card_2t', label: 'Card 2 título', rows: 1 },
      { key: 'sol_card_2b', label: 'Card 2 texto', rows: 3 },
      { key: 'sol_card_3t', label: 'Card 3 título', rows: 1 },
      { key: 'sol_card_3b', label: 'Card 3 texto', rows: 3 },
    ],
  },
  {
    title: 'Faixa modelos de IA (marquee)',
    fields: [
      { key: 'providers_marquee_eyebrow', label: 'Eyebrow', rows: 1 },
      { key: 'providers_marquee_title', label: 'Título', rows: 2 },
      { key: 'providers_marquee_sub', label: 'Subtítulo', rows: 3 },
      {
        key: 'providers_marquee_items',
        label: 'Nomes na faixa (1 por linha; texto sempre visível; logo opcional aparece à frente)',
        rows: 10,
      },
      {
        key: 'providers_marquee_logo_urls',
        label:
          'URLs das logos (1 por linha, mesma ordem que «Nomes»). Linha vazia = só texto. Com URL, a imagem fica à esquerda do nome. Uploads abaixo têm prioridade na mesma posição.',
        rows: 12,
      },
    ],
  },
  {
    title: 'Núcleo animado (diagrama)',
    fields: [
      { key: 'hub_phase_merge', label: 'Fase caos — “Unindo”', rows: 1 },
      { key: 'hub_phase_entries', label: 'Fase caos — “Entradas”', rows: 1 },
      { key: 'hub_core_title', label: 'Nome no núcleo', rows: 1 },
      { key: 'hub_core_tagline_rm', label: 'Tagline (reduced motion)', rows: 1 },
      { key: 'hub_core_tagline_anim', label: 'Tagline (animação)', rows: 1 },
      { key: 'hub_core_badge', label: 'Badge “Unificado”', rows: 1 },
      { key: 'hub_ciclo_footer', label: 'Texto abaixo do núcleo', rows: 1 },
    ],
  },
  {
    title: 'Quem criou o Neuro Ápice',
    fields: [
      { key: 'criador_eyebrow', label: 'Eyebrow da secção', rows: 1 },
      { key: 'criador_title', label: 'Título principal', rows: 2 },
      {
        key: 'criador_body',
        label: 'Texto (parágrafos separados por linha em branco)',
        rows: 16,
      },
      {
        key: 'creator_photo_url',
        label: 'URL da foto (opcional — se existir upload em “Foto do criador”, o upload vale primeiro)',
        rows: 2,
      },
      { key: 'creator_photo_alt', label: 'Texto alternativo da foto', rows: 2 },
      {
        key: 'creator_badge_enabled',
        label: 'Exibir badge Instagram (1 = sim, 0 = não)',
        rows: 1,
      },
      { key: 'creator_badge_handle', label: 'Badge — @ do Instagram', rows: 1 },
      { key: 'creator_badge_followers', label: 'Badge — seguidores (ex.: ~19,6 mil seguidores)', rows: 1 },
      { key: 'creator_badge_url', label: 'Badge — link (Instagram)', rows: 2 },
      { key: 'criador_cta', label: 'Texto do botão CTA', rows: 1 },
    ],
  },
  {
    title: 'Seção NeuroDesigner (eyebrow; título/lista usam a landing /auth)',
    fields: [{ key: 'neurodesigner_eyebrow', label: 'Texto acima do título (eyebrow)', rows: 1 }],
  },
  {
    title: 'Funcionalidades (bento + chips)',
    fields: [
      { key: 'mod_eyebrow', label: 'Eyebrow', rows: 1 },
      { key: 'mod_title', label: 'Título', rows: 2 },
      { key: 'mod_subtitle', label: 'Subtítulo', rows: 3 },
      { key: 'mod_bento1_h', label: 'Bento 1 título', rows: 2 },
      { key: 'mod_bento1_p', label: 'Bento 1 texto', rows: 3 },
      { key: 'mod_bento2_h', label: 'Bento 2 título', rows: 1 },
      { key: 'mod_bento2_p', label: 'Bento 2 texto', rows: 2 },
      { key: 'mod_bento3_h', label: 'Bento 3 título', rows: 1 },
      { key: 'mod_bento3_p', label: 'Bento 3 texto', rows: 2 },
      { key: 'mod_bento4_h', label: 'Bento 4 título', rows: 2 },
      { key: 'mod_bento4_p', label: 'Bento 4 texto', rows: 3 },
      { key: 'mod_included_eyebrow', label: 'Módulos incluídos — eyebrow', rows: 1 },
      { key: 'mod_included_sub', label: 'Módulos incluídos — subtítulo', rows: 2 },
      ...Array.from({ length: 9 }, (_, i) => [
        { key: `mod_chip_${i + 1}_label`, label: `Chip módulo ${i + 1} — nome`, rows: 1 },
        { key: `mod_chip_${i + 1}_sub`, label: `Chip módulo ${i + 1} — subtítulo`, rows: 1 },
      ]).flat(),
    ],
  },
  {
    title: 'Galeria e “Para quem”',
    fields: [
      { key: 'gal_eyebrow', label: 'Galeria eyebrow', rows: 1 },
      { key: 'gal_title', label: 'Galeria título', rows: 2 },
      { key: 'gal_subtitle', label: 'Galeria subtítulo', rows: 2 },
      { key: 'gal_footer', label: 'Galeria texto final', rows: 3 },
      { key: 'gal_alt_prefix', label: 'Prefixo alt imagens (Exemplo)', rows: 1 },
      { key: 'pq_eyebrow', label: 'Para quem eyebrow', rows: 1 },
      { key: 'pq_title', label: 'Para quem título', rows: 2 },
      { key: 'pq_subtitle', label: 'Para quem subtítulo', rows: 3 },
      { key: 'pq_card1_t', label: 'Card 1 título', rows: 1 },
      { key: 'pq_card1_p', label: 'Card 1 texto', rows: 3 },
      { key: 'pq_card2_t', label: 'Card 2 título', rows: 1 },
      { key: 'pq_card2_p', label: 'Card 2 texto', rows: 3 },
    ],
  },
  {
    title: 'Fluxo criativo (animação)',
    fields: [
      { key: 'flow_title', label: 'Título', rows: 1 },
      { key: 'flow_subtitle', label: 'Subtítulo', rows: 1 },
      { key: 'flow_caption_anim', label: 'Legenda (animação ligada)', rows: 2 },
      { key: 'flow_caption_rm', label: 'Legenda (reduced motion)', rows: 3 },
      { key: 'flow_caption_done', label: 'Legenda (ciclo completo)', rows: 2 },
      { key: 'flow_aria', label: 'Aria-label do bloco', rows: 2 },
      { key: 'flow_paleta', label: 'Rótulo Paleta', rows: 1 },
      { key: 'flow_arraste', label: 'Chip Arraste', rows: 1 },
      { key: 'flow_cliente', label: 'Chip Cliente', rows: 1 },
      { key: 'flow_contexto', label: 'Chip Contexto', rows: 1 },
      { key: 'flow_agente', label: 'Chip Agente', rows: 1 },
      { key: 'flow_seu_cliente', label: 'Nó Seu cliente', rows: 1 },
      { key: 'flow_cliente_exemplo', label: 'Nome exemplo cliente', rows: 1 },
      { key: 'flow_seu_contexto', label: 'Nó subtítulo contexto', rows: 1 },
      { key: 'flow_neuro_title', label: 'Painel Neuro Ápice', rows: 1 },
      { key: 'flow_gerar_roteiro', label: 'Botão Gerar roteiro', rows: 1 },
      { key: 'flow_gerar_arte', label: 'Botão Gerar arte', rows: 1 },
      { key: 'flow_roteiro_tab', label: 'Card Roteiro', rows: 1 },
      { key: 'flow_arte_tab', label: 'Card Arte', rows: 1 },
      { key: 'flow_roteiro_hints', label: 'Hints roteiro', rows: 1 },
      { key: 'flow_galeria_label', label: 'Label galeria arte', rows: 1 },
    ],
  },
  {
    title: 'Planos e garantia (bloco preços)',
    fields: [
      { key: 'plans_eyebrow', label: 'Eyebrow', rows: 1 },
      { key: 'plans_title', label: 'Título', rows: 2 },
      { key: 'plans_subtitle', label: 'Subtítulo', rows: 3 },
      { key: 'tab_mensal', label: 'Aba Mensal', rows: 1 },
      { key: 'tab_anual', label: 'Aba Anual (texto principal)', rows: 1 },
      { key: 'tab_anual_suffix', label: 'Aba Anual (sufixo, ex. desconto)', rows: 1 },
      { key: 'plan_standard_name', label: 'Nome plano Standard', rows: 1 },
      { key: 'plan_pro_name', label: 'Nome plano Pro', rows: 1 },
      { key: 'plan_pro_badge', label: 'Badge Pro mensal', rows: 1 },
      { key: 'plan_m_std_reais', label: 'Std mensal — reais', rows: 1 },
      { key: 'plan_m_std_cents', label: 'Std mensal — centavos', rows: 1 },
      { key: 'plan_m_std_suffix', label: 'Std mensal — sufixo (/mês)', rows: 1 },
      { key: 'plan_m_std_hint', label: 'Std mensal — dica', rows: 2 },
      { key: 'plan_m_std_audience', label: 'Std mensal — público', rows: 2 },
      { key: 'plan_m_std_cta', label: 'Std mensal — CTA', rows: 1 },
      { key: 'plan_m_pro_reais', label: 'Pro mensal — reais', rows: 1 },
      { key: 'plan_m_pro_cents', label: 'Pro mensal — centavos', rows: 1 },
      { key: 'plan_m_pro_suffix', label: 'Pro mensal — sufixo', rows: 1 },
      { key: 'plan_m_pro_hint', label: 'Pro mensal — dica', rows: 2 },
      { key: 'plan_m_pro_audience', label: 'Pro mensal — público', rows: 2 },
      { key: 'plan_m_pro_cta', label: 'Pro mensal — CTA', rows: 1 },
      { key: 'plan_a_std_discount', label: 'Std anual — badge desconto', rows: 1 },
      { key: 'plan_a_std_reais', label: 'Std anual — reais', rows: 1 },
      { key: 'plan_a_std_cents', label: 'Std anual — centavos', rows: 1 },
      { key: 'plan_a_std_suffix', label: 'Std anual — sufixo', rows: 1 },
      { key: 'plan_a_std_audience', label: 'Std anual — público', rows: 2 },
      { key: 'plan_a_std_cta', label: 'Std anual — CTA', rows: 1 },
      { key: 'plan_a_pro_discount', label: 'Pro anual — badge desconto', rows: 1 },
      { key: 'plan_a_pro_reais', label: 'Pro anual — reais', rows: 1 },
      { key: 'plan_a_pro_cents', label: 'Pro anual — centavos', rows: 1 },
      { key: 'plan_a_pro_suffix', label: 'Pro anual — sufixo', rows: 1 },
      { key: 'plan_a_pro_audience', label: 'Pro anual — público', rows: 2 },
      { key: 'plan_a_pro_cta', label: 'Pro anual — CTA', rows: 1 },
      { key: 'annual_line', label: 'Linha parcelas anual', rows: 2 },
      { key: 'annual_tooltip', label: 'Tooltip pagamento anual', rows: 4 },
      { key: 'plan_footer_guarantee', label: 'Rodapé card — garantia', rows: 1 },
      { key: 'plan_footer_secure', label: 'Rodapé card — compra segura', rows: 1 },
      { key: 'plans_guarantee_badge_1', label: 'Selo garantia — linha 1', rows: 1 },
      { key: 'plans_guarantee_days', label: 'Selo garantia — número dias', rows: 1 },
      { key: 'plans_guarantee_days_label', label: 'Selo garantia — label dias', rows: 1 },
      { key: 'plans_guarantee_ribbon', label: 'Faixa Garantido', rows: 1 },
      { key: 'plans_guarantee_title', label: 'Título bloco garantia', rows: 2 },
      { key: 'plans_guarantee_text', label: 'Texto bloco garantia', rows: 4 },
      { key: 'plans_note', label: 'Nota abaixo dos planos', rows: 3 },
    ],
  },
  {
    title: 'Features (linhas dos planos)',
    fields: [1, 2, 3, 4].map((i) => ({
      key: `feat_${i}`,
      label: `Linha ${i} (Standard: última pode aparecer como não incluída)`,
      rows: 2,
    })),
  },
  {
    title: 'Bônus, garantia extra, FAQ, CTA final, rodapé',
    fields: [
      { key: 'bonus_eyebrow', label: 'Bônus eyebrow', rows: 1 },
      { key: 'bonus_title', label: 'Bônus título', rows: 2 },
      { key: 'bonus_1_t', label: 'Bônus 1 título', rows: 2 },
      { key: 'bonus_1_b', label: 'Bônus 1 texto (fallback se bullets vazios)', rows: 3 },
      { key: 'bonus_1_image_url', label: 'Bônus 1 — URL da imagem (opcional)', rows: 1 },
      { key: 'bonus_1_points', label: 'Bônus 1 — bullets (1 linha = 1 item; **negrito**)', rows: 5 },
      { key: 'bonus_1_value_label', label: 'Bônus 1 — legenda do valor', rows: 1 },
      { key: 'bonus_1_value_highlight', label: 'Bônus 1 — destaque (vermelho)', rows: 1 },
      { key: 'bonus_2_t', label: 'Bônus 2 título', rows: 2 },
      { key: 'bonus_2_b', label: 'Bônus 2 texto (fallback)', rows: 3 },
      { key: 'bonus_2_image_url', label: 'Bônus 2 — URL da imagem (opcional)', rows: 1 },
      { key: 'bonus_2_points', label: 'Bônus 2 — bullets', rows: 5 },
      { key: 'bonus_2_value_label', label: 'Bônus 2 — legenda do valor', rows: 1 },
      { key: 'bonus_2_value_highlight', label: 'Bônus 2 — destaque (vermelho)', rows: 1 },
      { key: 'bonus_3_t', label: 'Bônus 3 título', rows: 2 },
      { key: 'bonus_3_b', label: 'Bônus 3 texto (fallback)', rows: 3 },
      { key: 'bonus_3_image_url', label: 'Bônus 3 — URL da imagem (opcional)', rows: 1 },
      { key: 'bonus_3_points', label: 'Bônus 3 — bullets', rows: 5 },
      { key: 'bonus_3_value_label', label: 'Bônus 3 — legenda do valor', rows: 1 },
      { key: 'bonus_3_value_highlight', label: 'Bônus 3 — destaque (vermelho)', rows: 1 },
      { key: 'g2_eyebrow', label: 'Garantia (secção) eyebrow', rows: 1 },
      { key: 'g2_title', label: 'Garantia título', rows: 2 },
      { key: 'g2_p', label: 'Garantia texto', rows: 4 },
      { key: 'g2_circle_1', label: 'Círculo linha 1', rows: 1 },
      { key: 'g2_circle_2', label: 'Círculo linha 2', rows: 1 },
      { key: 'faq_eyebrow', label: 'FAQ eyebrow', rows: 1 },
      { key: 'faq_title', label: 'FAQ título', rows: 1 },
      ...Array.from({ length: 7 }, (_, i) => [
        { key: `faq_${i + 1}_q`, label: `FAQ ${i + 1} pergunta`, rows: 2 },
        { key: `faq_${i + 1}_a`, label: `FAQ ${i + 1} resposta`, rows: 4 },
      ]).flat(),
      { key: 'final_title', label: 'CTA final título', rows: 2 },
      { key: 'final_p', label: 'CTA final parágrafo', rows: 3 },
      { key: 'final_cta', label: 'CTA final botão', rows: 2 },
      { key: 'footer_privacy', label: 'Rodapé — privacidade', rows: 1 },
      { key: 'footer_platform', label: 'Rodapé — plataforma', rows: 1 },
      { key: 'footer_copy', label: 'Rodapé — copyright (use {year} para ano)', rows: 2 },
    ],
  },
];
