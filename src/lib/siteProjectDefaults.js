/**
 * HTML inicial do criador de site (alinhado ao SiteBuilder.jsx e à edge function site-generator).
 * Usado como fallback quando a função edge não está deployada (ex.: 404 em produção).
 */
export const DEFAULT_SITE_HERO_HTML = `
<section class="bg-slate-900 text-white" data-section-id="section_0">
  <div class="mx-auto max-w-screen-xl px-4 py-24 lg:py-32 lg:flex lg:items-center">
    <div class="mx-auto max-w-3xl text-center">
      <h1 class="text-3xl font-bold tracking-tight sm:text-5xl" style="font-family: 'Outfit', sans-serif;" data-id="b3f2c1a0" data-type="heading">
        Sua Jornada Digital Começa Aqui.
        <span class="sm:block text-slate-300 mt-2" data-id="b3f2c1a1" data-type="text">Construa o Futuro.</span>
      </h1>
      <p class="mx-auto mt-6 max-w-xl text-slate-400 sm:text-lg leading-relaxed" style="font-family: 'Plus Jakarta Sans', sans-serif;" data-id="b3f2c1a2" data-type="text">
        Crie, inove e inspire. Use o chat ao lado para gerar um site único, com tipografia e cores personalizadas.
      </p>
      <div class="mt-8 flex flex-wrap justify-center gap-4">
        <a class="inline-flex rounded-lg bg-white px-8 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100 transition-colors" href="#" data-id="b3f2c1a3" data-type="button">Começar</a>
        <a class="inline-flex rounded-lg border border-slate-500 px-8 py-3 text-sm font-medium text-white hover:bg-slate-800 transition-colors" href="#" data-id="b3f2c1a4" data-type="button">Saber Mais</a>
      </div>
    </div>
  </div>
</section>
`.trim();

/**
 * Grava hero inicial e marca completed. Se a BD não tiver coluna `page_structure`, faz só html_content + status.
 * @returns {{ error: { message?: string } | null }}
 */
export async function seedInitialSiteContent(supabase, { userId, projectId, heroHtml = DEFAULT_SITE_HERO_HTML }) {
  const now = new Date().toISOString();
  const modId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `mod-${Date.now()}`;
  const page_structure = [{ id: modId, name: 'Hero inicial', html: heroHtml }];

  let { error } = await supabase
    .from('site_projects')
    .update({
      page_structure,
      html_content: heroHtml,
      status: 'completed',
      updated_at: now,
    })
    .eq('id', projectId)
    .eq('user_id', userId);

  if (error && /page_structure|schema cache/i.test(String(error.message || ''))) {
    ({ error } = await supabase
      .from('site_projects')
      .update({
        html_content: heroHtml,
        status: 'completed',
        updated_at: now,
      })
      .eq('id', projectId)
      .eq('user_id', userId));
  }

  return { error };
}
