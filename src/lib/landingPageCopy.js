import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

export const BRANDING_ROW_ID = 'neuro_apice';

/** Textos padrão da landing de login (espelham AuthPage.jsx). */
export const DEFAULT_LANDING_COPY = {
  hero_badge: 'O fim das assinaturas de IA limitadas',
  hero_title_before: 'Sua própria plataforma de IA para ',
  hero_title_highlight: 'Marketing e Design.',
  hero_subtitle:
    'Pare de pagar por créditos em ferramentas gringas. Tenha seu próprio sistema para gerar artes, copys e gerenciar campanhas com inteligência artificial ilimitada. Perfeito para agências, igrejas e experts escalarem suas operações.',
  hero_pill_1_title: 'Artes Ilimitadas',
  hero_pill_1_sub: 'Sem custo por imagem',
  hero_pill_2_title: 'Agentes Especialistas',
  hero_pill_2_sub: 'Copy, tráfego e estratégia',
  hero_pill_3_title: 'Controle Total',
  hero_pill_3_sub: 'Sua marca, suas regras',
  card_desc_login:
    'Entre na central que une NeuroDesigner, chats de IA e performance para operar marketing, cultos e projetos em um só lugar.',
  card_desc_forgot: 'Informe o e-mail cadastrado para receber o link de redefinição de senha.',
  neo_title_1: 'Sua fábrica de artes e campanhas com IA, ',
  neo_title_2: 'do jeito que o cliente vê.',
  neo_paragraph:
    'Crie artes para cultos, campanhas, lançamentos e redes sociais com poucos cliques. O NeuroDesigner foi pensado para quem precisa produzir muito, com padrão profissional, sem depender de templates genéricos.',
  neo_li_1: 'Fluxos prontos para Artes Culto, anúncios, criativos e posts.',
  neo_li_2: 'IA ajustada para linguagem de igrejas, infoprodutos e negócios locais.',
  neo_li_3: 'Controle total dos prompts, referências e logos do seu sistema.',
  neo_mock_label: 'NEURODESIGNER',
  neo_placeholder:
    'Espaço reservado para print real do NeuroDesigner (fluxo de criação ou painel).',
  feat_intro_title: 'Tudo que você precisa em uma única plataforma',
  feat_intro_subtitle: 'Substitua dezenas de ferramentas avulsas e centralize sua operação.',
  f1_title: 'NeuroDesigner',
  f1_desc:
    'Gere artes impressionantes para cultos, anúncios e redes sociais em segundos. Sem depender de designers ou templates engessados.',
  f1_emoji: '🎨',
  f1_b1_t: 'Artes Culto',
  f1_b1_s: 'Fluxos otimizados para igrejas',
  f1_b2_t: 'Criativos Ads',
  f1_b2_s: 'Foco em alta conversão',
  f1_b3_t: 'Sem Limites',
  f1_b3_s: 'Gere quantas precisar',
  f1_b4_t: 'Sua Identidade',
  f1_b4_s: 'Controle de logos e cores',
  f2_title: 'Agentes Especialistas',
  f2_desc:
    'Um time completo de IAs treinadas para copywriting, estratégia, tráfego e conteúdo, trabalhando para os seus projetos.',
  f2_emoji: '🤖',
  f2_b1_t: 'Copywriters',
  f2_b1_s: 'Textos que vendem',
  f2_b2_t: 'Estrategistas',
  f2_b2_s: 'Planejamento de campanhas',
  f2_b3_t: 'Contexto Real',
  f2_b3_s: 'IA lê os dados do cliente',
  f2_b4_t: 'Multi-Modelos',
  f2_b4_s: 'GPT-4, Claude, Gemini',
  f3_title: 'Performance e Tráfego',
  f3_desc:
    'Conecte suas contas de anúncios e veja os resultados em tempo real. A IA analisa as métricas e sugere otimizações.',
  f3_emoji: '📊',
  f3_b1_t: 'Meta Ads',
  f3_b1_s: 'Integração direta',
  f3_b2_t: 'Dashboards',
  f3_b2_s: 'Visão clara de ROI/ROAS',
  f3_b3_t: 'Análise IA',
  f3_b3_s: 'Insights automáticos',
  f3_b4_t: 'Relatórios',
  f3_b4_s: 'Prontos para o cliente',
  f4_title: 'Gestão de Clientes',
  f4_desc:
    'Organize todas as informações, campanhas, arquivos e calendário de publicações de cada cliente em um só lugar.',
  f4_emoji: '🏢',
  f4_b1_t: 'CRM Integrado',
  f4_b1_s: 'Dados centralizados',
  f4_b2_t: 'Calendário',
  f4_b2_s: 'Planejamento visual',
  f4_b3_t: 'Projetos',
  f4_b3_s: 'Kanban e tarefas',
  f4_b4_t: 'Arquivos',
  f4_b4_s: 'Media center organizado',
  gal_title: 'Criado com NeuroDesigner',
  gal_subtitle: 'Resultados profissionais gerados por inteligência artificial em segundos.',
  gal_hover: 'Arte gerada por IA',
  aud_title: 'Feito para quem vende criatividade e resultado.',
  aud_1_t: 'Agências e Social Media',
  aud_1_d:
    'Centralize clientes, campanhas e arte em um sistema que você pode apresentar como parte da sua própria plataforma.',
  aud_2_t: 'Igrejas e ministérios',
  aud_2_d:
    'Planeje séries, cultos e eventos com artes, textos e descrições alinhadas à linguagem da igreja.',
  aud_3_t: 'Experts e infoprodutores',
  aud_3_d: 'Organize lançamentos, conteúdos perpétuos e presença digital com IA focada em conversão.',
  diff_1_t: 'Sem cobrança por créditos',
  diff_1_p:
    'Você controla a infraestrutura e o custo de IA. O sistema não limita quantas artes ou ideias você pode gerar para os seus clientes. Liberdade total para escalar.',
  diff_2_t: 'Controle total do sistema',
  diff_2_p:
    'Personalize logo, cores, textos, fluxos e integrações. O Neuro Ápice é pensado para ser a base da sua própria solução, não só uma conta em mais um SaaS.',
  cta_title: 'Pronto para colocar o NeuroDesigner para trabalhar ao seu favor?',
  cta_subtitle:
    'Crie sua conta ou faça login agora e teste na prática como é ter uma central de IA, design e performance sob o seu controle.',
  cta_button: 'Entrar no sistema agora',
};

/** Metadados do formulário super admin (ordem e rótulos). */
export const LANDING_COPY_UI_SECTIONS = [
  {
    title: 'Hero (topo + formulário)',
    fields: [
      { key: 'hero_badge', label: 'Selo acima do título', rows: 2 },
      { key: 'hero_title_before', label: 'Título — texto antes do destaque em gradiente', rows: 2 },
      { key: 'hero_title_highlight', label: 'Título — destaque (gradiente)', rows: 2 },
      { key: 'hero_subtitle', label: 'Parágrafo abaixo do título', rows: 4 },
      { key: 'hero_pill_1_title', label: 'Card benefício 1 — título', rows: 1 },
      { key: 'hero_pill_1_sub', label: 'Card benefício 1 — subtítulo', rows: 1 },
      { key: 'hero_pill_2_title', label: 'Card benefício 2 — título', rows: 1 },
      { key: 'hero_pill_2_sub', label: 'Card benefício 2 — subtítulo', rows: 1 },
      { key: 'hero_pill_3_title', label: 'Card benefício 3 — título', rows: 1 },
      { key: 'hero_pill_3_sub', label: 'Card benefício 3 — subtítulo', rows: 1 },
      { key: 'card_desc_login', label: 'Texto do card de login / cadastro', rows: 3 },
      { key: 'card_desc_forgot', label: 'Texto do card “esqueci a senha”', rows: 2 },
    ],
  },
  {
    title: 'Bloco NeuroDesigner (print + lista)',
    fields: [
      { key: 'neo_title_1', label: 'Título — primeira linha (antes do destaque)', rows: 2 },
      { key: 'neo_title_2', label: 'Título — destaque (segunda parte)', rows: 2 },
      { key: 'neo_paragraph', label: 'Parágrafo', rows: 4 },
      { key: 'neo_li_1', label: 'Lista — item 1', rows: 2 },
      { key: 'neo_li_2', label: 'Lista — item 2', rows: 2 },
      { key: 'neo_li_3', label: 'Lista — item 3', rows: 2 },
      { key: 'neo_mock_label', label: 'Rótulo da janela fictícia (ex.: NEURODESIGNER)', rows: 1 },
      { key: 'neo_placeholder', label: 'Texto quando não há imagem hero', rows: 2 },
    ],
  },
  {
    title: 'Seção “Tudo em uma plataforma”',
    fields: [
      { key: 'feat_intro_title', label: 'Título da seção', rows: 2 },
      { key: 'feat_intro_subtitle', label: 'Subtítulo', rows: 2 },
    ],
  },
  {
    title: 'Card funcionalidade 1 (NeuroDesigner)',
    fields: [
      { key: 'f1_emoji', label: 'Emoji / ícone (texto)', rows: 1 },
      { key: 'f1_title', label: 'Título', rows: 1 },
      { key: 'f1_desc', label: 'Descrição', rows: 3 },
      { key: 'f1_b1_t', label: 'Grid 1 — título', rows: 1 },
      { key: 'f1_b1_s', label: 'Grid 1 — subtítulo', rows: 1 },
      { key: 'f1_b2_t', label: 'Grid 2 — título', rows: 1 },
      { key: 'f1_b2_s', label: 'Grid 2 — subtítulo', rows: 1 },
      { key: 'f1_b3_t', label: 'Grid 3 — título', rows: 1 },
      { key: 'f1_b3_s', label: 'Grid 3 — subtítulo', rows: 1 },
      { key: 'f1_b4_t', label: 'Grid 4 — título', rows: 1 },
      { key: 'f1_b4_s', label: 'Grid 4 — subtítulo', rows: 1 },
    ],
  },
  {
    title: 'Card funcionalidade 2 (Agentes)',
    fields: [
      { key: 'f2_emoji', label: 'Emoji', rows: 1 },
      { key: 'f2_title', label: 'Título', rows: 1 },
      { key: 'f2_desc', label: 'Descrição', rows: 3 },
      { key: 'f2_b1_t', label: 'Grid 1 — título', rows: 1 },
      { key: 'f2_b1_s', label: 'Grid 1 — subtítulo', rows: 1 },
      { key: 'f2_b2_t', label: 'Grid 2 — título', rows: 1 },
      { key: 'f2_b2_s', label: 'Grid 2 — subtítulo', rows: 1 },
      { key: 'f2_b3_t', label: 'Grid 3 — título', rows: 1 },
      { key: 'f2_b3_s', label: 'Grid 3 — subtítulo', rows: 1 },
      { key: 'f2_b4_t', label: 'Grid 4 — título', rows: 1 },
      { key: 'f2_b4_s', label: 'Grid 4 — subtítulo', rows: 1 },
    ],
  },
  {
    title: 'Card funcionalidade 3 (Performance)',
    fields: [
      { key: 'f3_emoji', label: 'Emoji', rows: 1 },
      { key: 'f3_title', label: 'Título', rows: 1 },
      { key: 'f3_desc', label: 'Descrição', rows: 3 },
      { key: 'f3_b1_t', label: 'Grid 1 — título', rows: 1 },
      { key: 'f3_b1_s', label: 'Grid 1 — subtítulo', rows: 1 },
      { key: 'f3_b2_t', label: 'Grid 2 — título', rows: 1 },
      { key: 'f3_b2_s', label: 'Grid 2 — subtítulo', rows: 1 },
      { key: 'f3_b3_t', label: 'Grid 3 — título', rows: 1 },
      { key: 'f3_b3_s', label: 'Grid 3 — subtítulo', rows: 1 },
      { key: 'f3_b4_t', label: 'Grid 4 — título', rows: 1 },
      { key: 'f3_b4_s', label: 'Grid 4 — subtítulo', rows: 1 },
    ],
  },
  {
    title: 'Card funcionalidade 4 (Gestão de clientes)',
    fields: [
      { key: 'f4_emoji', label: 'Emoji', rows: 1 },
      { key: 'f4_title', label: 'Título', rows: 1 },
      { key: 'f4_desc', label: 'Descrição', rows: 3 },
      { key: 'f4_b1_t', label: 'Grid 1 — título', rows: 1 },
      { key: 'f4_b1_s', label: 'Grid 1 — subtítulo', rows: 1 },
      { key: 'f4_b2_t', label: 'Grid 2 — título', rows: 1 },
      { key: 'f4_b2_s', label: 'Grid 2 — subtítulo', rows: 1 },
      { key: 'f4_b3_t', label: 'Grid 3 — título', rows: 1 },
      { key: 'f4_b3_s', label: 'Grid 3 — subtítulo', rows: 1 },
      { key: 'f4_b4_t', label: 'Grid 4 — título', rows: 1 },
      { key: 'f4_b4_s', label: 'Grid 4 — subtítulo', rows: 1 },
    ],
  },
  {
    title: 'Galeria',
    fields: [
      { key: 'gal_title', label: 'Título', rows: 2 },
      { key: 'gal_subtitle', label: 'Subtítulo', rows: 2 },
      { key: 'gal_hover', label: 'Texto ao passar o mouse na imagem', rows: 1 },
    ],
  },
  {
    title: 'Público-alvo (3 colunas)',
    fields: [
      { key: 'aud_title', label: 'Título da seção', rows: 2 },
      { key: 'aud_1_t', label: 'Coluna 1 — título', rows: 1 },
      { key: 'aud_1_d', label: 'Coluna 1 — texto', rows: 3 },
      { key: 'aud_2_t', label: 'Coluna 2 — título', rows: 1 },
      { key: 'aud_2_d', label: 'Coluna 2 — texto', rows: 3 },
      { key: 'aud_3_t', label: 'Coluna 3 — título', rows: 1 },
      { key: 'aud_3_d', label: 'Coluna 3 — texto', rows: 3 },
    ],
  },
  {
    title: 'Diferenciais (2 cards)',
    fields: [
      { key: 'diff_1_t', label: 'Card 1 — título', rows: 1 },
      { key: 'diff_1_p', label: 'Card 1 — texto', rows: 4 },
      { key: 'diff_2_t', label: 'Card 2 — título', rows: 1 },
      { key: 'diff_2_p', label: 'Card 2 — texto', rows: 4 },
    ],
  },
  {
    title: 'CTA final',
    fields: [
      { key: 'cta_title', label: 'Título', rows: 3 },
      { key: 'cta_subtitle', label: 'Subtítulo', rows: 3 },
      { key: 'cta_button', label: 'Texto do botão', rows: 1 },
    ],
  },
];

export function mergeLandingCopy(partial) {
  const src = partial && typeof partial === 'object' ? partial : {};
  const out = { ...DEFAULT_LANDING_COPY };
  for (const key of Object.keys(DEFAULT_LANDING_COPY)) {
    const v = src[key];
    if (typeof v === 'string' && v.trim() !== '') {
      out[key] = v;
    }
  }
  return out;
}

export async function fetchLandingPageCopyRow() {
  const { data, error } = await supabase
    .from('system_branding')
    .select('landing_page_copy')
    .eq('id', BRANDING_ROW_ID)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[landingPageCopy] fetch error:', error);
    }
    return mergeLandingCopy({});
  }
  return mergeLandingCopy(data?.landing_page_copy);
}

export function useLandingPageCopy() {
  const [copy, setCopy] = useState(() => mergeLandingCopy({}));

  useEffect(() => {
    let ok = true;
    (async () => {
      const merged = await fetchLandingPageCopyRow();
      if (ok) setCopy(merged);
    })();
    return () => {
      ok = false;
    };
  }, []);

  return copy;
}
