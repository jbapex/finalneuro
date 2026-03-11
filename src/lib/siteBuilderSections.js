/**
 * Tipos de seção reutilizáveis para o Criador de Site.
 * Usado para botões "Adicionar seção" que enviam mensagem automática à IA.
 */
export const SITE_BUILDER_SECTIONS = [
  { id: 'hero', label: 'Hero', description: 'Destaque principal', promptHint: 'hero moderno com título, subtítulo e CTA' },
  { id: 'features', label: 'Features', description: 'Lista de benefícios ou recursos', promptHint: 'seção de features com ícones e textos curtos' },
  { id: 'pricing', label: 'Preços', description: 'Tabela de planos', promptHint: 'seção de preços com planos e CTAs' },
  { id: 'testimonials', label: 'Depoimentos', description: 'Avaliações de clientes', promptHint: 'seção de depoimentos com citações' },
  { id: 'cta', label: 'CTA', description: 'Chamada para ação', promptHint: 'seção de CTA forte para conversão' },
  { id: 'footer', label: 'Footer', description: 'Rodapé', promptHint: 'footer com links e informações de contato' },
];
