# Criador de Site

Ferramenta para criar e editar landing pages por **conversa com a IA** (Horizons), **brief opcional**, **biblioteca de seções** e **comandos iterativos** (adicionar/alterar só uma seção), com preview em tempo real.

## Onde acessar

- **Menu:** Ferramentas → Criador de Site
- **URL (usuário):** `/ferramentas/criador-de-site` (lista de projetos) e `/ferramentas/criador-de-site/:projectId` (editor)
- **Dados:** tabela `site_projects` (campos principais: `user_id`, `name`, `html_content`, `chat_history`, `project_brief`, `page_structure`, `updated_at`)
- **Preview público:** `/site-preview/:projectId` — exibe o site final. Usa `page_structure` quando existir (projetos criados no Fluxo Criativo); caso contrário usa `html_content` (projetos criados em Ferramentas → Criador de Site).

## Fluxo

1. **Brief (aba "Brief")**
   - Formulário opcional: nome do site, nicho, cores primária/secundária, tom, público-alvo, observações.
   - Salvo em `site_projects.project_brief` (JSONB). A IA usa esse contexto em toda conversa para gerar conteúdo alinhado ao projeto.

2. **Chat com IA (aba "Chat com IA")**
   - O usuário vê o histórico de mensagens (`chat_history`) e digita novas mensagens ou usa os botões **Adicionar seção** (Hero, Features, Preços, Depoimentos, CTA, Footer) para enviar um pedido automático à IA.
   - Ao enviar, o sistema monta um system prompt com: diretrizes profissionais (Tailwind, HTML semântico, acessibilidade, SEO), contexto do projeto (brief) e **contexto da página atual** (número e ids das seções, ex.: `section_0`, `section_1`). Chama a Edge Function `generic-ai-chat` com `context: 'site_builder_chat'` e `current_page_context`.
   - A IA pode retornar:
     - **Página inteira** em ` ```html ... ``` ` (substitui todo o conteúdo).
     - **Nova seção** com ` <!-- APPEND --> ` no bloco (o front adiciona ao final do HTML).
     - **Substituir uma seção** com ` <!-- REPLACE_SECTION: section_X --> ` (o front troca só essa seção).
   - O preview é atualizado e o projeto é persistido (`html_content`, `chat_history`).

3. **Comandos iterativos**
   - Exemplos no chat: "adicione uma seção de preços", "mude só o hero", "refaça o footer". A IA usa os ids de seção informados no contexto para devolver APPEND ou REPLACE_SECTION quando apropriado.

4. **Edição manual (aba "Editar HTML")**
   - Textarea com o HTML da página. Alterações refletem no preview em tempo real.
   - Botão **Salvar** persiste apenas o `html_content` no projeto (sem alterar `chat_history`).

5. **Seções (aba "Seções")**
   - Lista das seções da página (primeiro nível do HTML). Arraste para reordenar; as alterações refletem no preview.

6. **Preview**
   - O painel à direita exibe o documento gerado (Tailwind + `html_content` em iframe). Qualquer atualização em `htmlContent` (via chat ou edição) é refletida imediatamente.

## Dependências

- **Conexão de LLM:** para usar o chat, o usuário deve configurar pelo menos uma conexão de modelo de linguagem em **Configurações → Minha IA** (conexões com capacidade `text_generation`). Se não houver conexão, o chat fica desabilitado e é exibida mensagem com link para Minha IA.
- **Edge Function:** `generic-ai-chat` (já usada por outros módulos: NeuroDesign Preencher campos, Copilot, etc.).

## Observação

- Novos projetos são criados com uma mensagem inicial do assistente no `chat_history`: "Olá! Sou Horizons, seu assistente de criação de sites. O que vamos construir hoje?"

## Modelo de dados e preview

- **Ferramenta do usuário** (esta página): grava em `html_content`, `chat_history` e `project_brief`. Não usa `page_structure`.
- **Modal no Fluxo Criativo** (nó "Criador de Site"): grava em `page_structure` e `chat_history` (lista de módulos arrastáveis).
- A rota **Preview** (`/site-preview/:projectId`) exibe o site usando `page_structure` quando houver módulos; senão usa `html_content`, para que projetos criados em Ferramentas → Criador de Site apareçam corretamente.

## Biblioteca de seções

- Tipos definidos em `src/lib/siteBuilderSections.js`: Hero, Features, Preços, Depoimentos, CTA, Footer.
- No Chat, os botões "Adicionar seção" enviam uma mensagem automática pedindo à IA que gere a seção no formato `<!-- APPEND -->`, mantendo consistência com o restante da página e com o brief (quando preenchido).
