import React, { memo, useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getFriendlyErrorMessage } from '@/lib/utils';
import { DEFAULT_SITE_HERO_HTML, seedInitialSiteContent } from '@/lib/siteProjectDefaults';
import { runSiteBuilderInitialGenerationFromBrief } from '@/lib/siteBuilderFlowGeneration';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';

const MAX_BRIEF_NOTES = 120_000;

const BRIEF_REFINE_SYSTEM =
  'És o assistente do Criador de Site na plataforma. O utilizador validou um plano estrutural no fluxo criativo. Tarefa: integrar esse plano num brief executivo em Markdown (objectivos, público, tom de voz, secções com mensagens-chave, CTAs, SEO breve). Não escrevas HTML, CSS nem JavaScript. Responde só com o brief em português.';

function responseToPlainText(raw) {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw.content != null) return String(raw.content);
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return String(raw);
  }
}

const SiteStructureNode = memo(({ id, data, selected }) => {
  const {
    onUpdateNodeData,
    onAddSitePreviewNode,
    projectName = '',
    structureText: initialText = '',
    flowContextJson = '',
    siteCreatorNodeId,
    buildComplete = false,
    builtProjectId,
    llm_integration_id: structureLlmId = null,
    llm_is_user_connection: structureLlmIsUser = false,
  } = data;

  const { toast } = useToast();
  const { user } = useAuth();
  const [text, setText] = useState(initialText);
  const [isBuilding, setIsBuilding] = useState(false);
  const [jobId, setJobId] = useState(null);
  const completionHandledRef = useRef(false);
  const onUpdateRef = useRef(onUpdateNodeData);
  onUpdateRef.current = onUpdateNodeData;
  const previewSpawnedForProjectRef = useRef(null);

  useEffect(() => {
    setText(initialText || '');
  }, [initialText]);

  useEffect(() => {
    if (!jobId) return;

    completionHandledRef.current = false;

    const tryFinalize = (row, { forceContentHeuristic = false } = {}) => {
      if (!row || completionHandledRef.current) return false;
      const st = String(row.status || '').toLowerCase();
      const ok = ['completed', 'complete', 'success', 'done', 'ready'].includes(st);
      const fail = ['failed', 'error', 'cancelled'].includes(st);
      const htmlLen = row.html_content != null ? String(row.html_content).length : 0;
      const modulesLen = Array.isArray(row.page_structure) ? row.page_structure.length : 0;
      const looksGenerated = forceContentHeuristic && !fail && (htmlLen > 200 || modulesLen > 0);
      if (!ok && !fail && !looksGenerated) return false;

      completionHandledRef.current = true;

      if (fail) {
        toast({
          title: 'Erro ao criar projeto',
          description: row.error_message || st,
          variant: 'destructive',
        });
      } else {
        const updated = looksGenerated && !ok ? { ...row, status: 'completed' } : row;
        onUpdateRef.current(id, {
          buildComplete: true,
          builtProjectId: updated.id,
          output: { id: updated.id, data: updated },
        });
        toast({
          title: 'Site criado!',
          description: looksGenerated && !ok ? 'Conteúdo detetado sem estado “completed” no servidor.' : undefined,
        });
      }
      setIsBuilding(false);
      setJobId(null);
      return true;
    };

    const channel = supabase
      .channel(`site_structure_job:${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'site_projects',
          filter: `id=eq.${String(jobId)}`,
        },
        (payload) => tryFinalize(payload.new, { forceContentHeuristic: true })
      )
      .subscribe();

    const POLL_MS = 2500;
    const TIMEOUT_MS = 6 * 60 * 1000;
    const CONTENT_HEURISTIC_MS = 40 * 1000;
    const started = Date.now();

    const poll = setInterval(async () => {
      if (completionHandledRef.current) {
        clearInterval(poll);
        return;
      }
      if (Date.now() - started > TIMEOUT_MS) {
        clearInterval(poll);
        if (!completionHandledRef.current) {
          completionHandledRef.current = true;
          toast({
            title: 'Timeout',
            description: 'Abra Ferramentas → Criador de site para ver o projeto.',
            variant: 'default',
          });
          setIsBuilding(false);
          setJobId(null);
        }
        return;
      }
      const { data: row, error } = await supabase.from('site_projects').select('*').eq('id', jobId).maybeSingle();
      if (error || !row || completionHandledRef.current) return;
      const useHeuristic = Date.now() - started >= CONTENT_HEURISTIC_MS;
      if (tryFinalize(row, { forceContentHeuristic: useHeuristic })) clearInterval(poll);
    }, POLL_MS);

    (async () => {
      const { data: row } = await supabase.from('site_projects').select('*').eq('id', jobId).maybeSingle();
      if (row && !completionHandledRef.current) tryFinalize(row, { forceContentHeuristic: false });
    })();

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [jobId, toast, id]);

  const handlePersistText = () => {
    onUpdateNodeData(id, { structureText: text });
  };

  const handleBuildSite = async () => {
    if (!text.trim() || !user || !projectName?.trim()) {
      toast({
        title: 'Revise o plano',
        description: 'Precisa de texto na estrutura e de um nome de projeto (definido no nó Criador de Site).',
        variant: 'destructive',
      });
      return;
    }

    handlePersistText();
    previewSpawnedForProjectRef.current = null;
    completionHandledRef.current = false;
    setIsBuilding(true);

    const planBlock = `--- Plano validado no fluxo ---\n${text.trim()}`;
    const ctxBlock = flowContextJson
      ? `\n\n--- Contexto JSON do fluxo ---\n${flowContextJson}`
      : '';
    let notes = `${planBlock}${ctxBlock}`;
    if (notes.length > MAX_BRIEF_NOTES) {
      notes = `${notes.slice(0, MAX_BRIEF_NOTES)}\n\n[…truncado]`;
    }

    try {
      if (structureLlmId) {
        toast({
          title: 'A consolidar o brief com a IA…',
          description: 'A mesma conexão do Criador de Site está a preparar o texto para geração.',
        });
        const userMsg = `Nome do site: ${projectName.trim()}\n\nIntegra o seguinte documento num brief executivo único (Markdown):\n\n${notes}`;
        const { data: chatData, error: chatErr } = await supabase.functions.invoke('generic-ai-chat', {
          body: JSON.stringify({
            messages: [
              { role: 'system', content: BRIEF_REFINE_SYSTEM },
              { role: 'user', content: userMsg },
            ],
            llm_integration_id: structureLlmId,
            is_user_connection: structureLlmIsUser === true,
          }),
        });
        if (!chatErr) {
          const refined = responseToPlainText(chatData?.response).trim();
          if (refined) {
            notes =
              refined.length > MAX_BRIEF_NOTES
                ? `${refined.slice(0, MAX_BRIEF_NOTES)}\n\n[…truncado]`
                : refined;
          }
        } else {
          console.warn('[SiteStructureNode] generic-ai-chat (brief):', chatErr);
        }
      }

      const { data: newProject, error } = await supabase
        .from('site_projects')
        .insert({
          name: projectName.trim(),
          user_id: user.id,
          status: 'pending',
          project_brief: {
            site_name: projectName.trim(),
            notes,
          },
        })
        .select('id')
        .single();

      if (error) throw error;

      const addPreview = onAddSitePreviewNode;
      if (typeof addPreview === 'function' && previewSpawnedForProjectRef.current !== newProject.id) {
        previewSpawnedForProjectRef.current = newProject.id;
        addPreview(id, {
          projectId: newProject.id,
          projectName: projectName.trim(),
          siteCreatorNodeId,
        });
      }

      setJobId(newProject.id);
      toast({ title: 'A gerar site…', description: 'A IA do criador (Horizons) está a montar a página no preview.' });

      const projectBriefForChat = {
        site_name: projectName.trim(),
        notes,
      };

      let usedHorizonsBuild = false;
      if (structureLlmId) {
        const gen = await runSiteBuilderInitialGenerationFromBrief({
          supabase,
          projectId: newProject.id,
          userId: user.id,
          projectBrief: projectBriefForChat,
          llmIntegrationId: structureLlmId,
          isUserConnection: structureLlmIsUser === true,
        });
        if (gen.ok) {
          usedHorizonsBuild = true;
        } else {
          console.warn('[SiteStructureNode] geração Horizons:', gen.reason, gen.error);
          toast({
            title: 'Geração pelo chat falhou — a usar modelo simples',
            description:
              gen.reason === 'no_html_in_response'
                ? 'A IA não devolveu HTML. Tentamos o gerador base.'
                : String(gen.error || gen.reason || 'Erro desconhecido'),
            variant: 'default',
          });
        }
      }

      if (!usedHorizonsBuild) {
        const { error: fnErr } = await supabase.functions.invoke('site-generator', {
          body: { project_id: newProject.id },
        });

        if (fnErr) {
          console.error('site-generator:', fnErr);
          const { error: seedError } = await seedInitialSiteContent(supabase, {
            userId: user.id,
            projectId: newProject.id,
            heroHtml: DEFAULT_SITE_HERO_HTML,
          });
          if (seedError) {
            toast({
              title: 'Não foi possível preparar o site',
              description: seedError.message || String(seedError),
              variant: 'destructive',
            });
            setIsBuilding(false);
            setJobId(null);
            return;
          }
          toast({ title: 'Site iniciado pela app', variant: 'default' });
        }
      }
    } catch (e) {
      toast({
        title: 'Erro',
        description: getFriendlyErrorMessage(e),
        variant: 'destructive',
      });
      setIsBuilding(false);
      setJobId(null);
    }
  };

  const done = buildComplete || Boolean(builtProjectId);

  return (
    <Card className="w-[min(560px,92vw)] max-h-[min(720px,85vh)] border-2 border-teal-500/50 shadow-lg flex flex-col">
      <Handle type="target" position={Position.Left} className="!bg-teal-500" />
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-3 bg-teal-500/10 shrink-0 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FileText className="w-5 h-5 shrink-0 text-teal-500" />
          <CardTitle className="min-w-0 flex-1 truncate text-base leading-tight">
            {data.label || `Estrutura: ${projectName || 'Site'}`}
          </CardTitle>
        </div>
        <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
      </CardHeader>
      <CardContent className="p-3 space-y-3 flex flex-col flex-1 min-h-0">
        <p className="text-xs text-muted-foreground shrink-0">
          Revise o plano. Em <strong>Construir site</strong>, o texto é consolidado pela mesma IA do Criador (se
          escolheu conexão ao gerar a estrutura), cria-se o projeto, aparece o nó Preview com animação e corre a
          geração inicial.
        </p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handlePersistText}
          disabled={isBuilding || done}
          className="nodrag min-h-[220px] max-h-[380px] text-sm font-mono leading-relaxed resize-y"
          placeholder="O plano do site aparecerá aqui após “Gerar estrutura” no Criador de Site…"
        />
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            variant="default"
            className="nodrag"
            disabled={isBuilding || done || !text.trim()}
            onClick={handleBuildSite}
          >
            {isBuilding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                A construir…
              </>
            ) : done ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Site criado
              </>
            ) : (
              'Construir site'
            )}
          </Button>
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-teal-500" />
    </Card>
  );
});

SiteStructureNode.displayName = 'SiteStructureNode';

export default SiteStructureNode;
