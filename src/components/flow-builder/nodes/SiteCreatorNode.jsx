import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Globe, Edit, Loader2, Link2, Sparkles, ChevronsUpDown, Settings } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import SiteBuilderModal from '@/components/flow-builder/modals/SiteBuilderModal';
import { useParams } from 'react-router-dom';
import { getFriendlyErrorMessage } from '@/lib/utils';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';

const isTextConnection = (conn) =>
  conn.capabilities == null || conn.capabilities?.text_generation !== false;

const LlmIntegrationSelector = ({ integrations, selectedId, onSelect, disabled }) => {
  const [open, setOpen] = useState(false);
  const selectedIntegration = integrations.find((i) => String(i.id) === String(selectedId));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-xs h-9 gap-1 nodrag"
          disabled={disabled}
        >
          <Settings className="w-3 h-3 shrink-0" />
          <span className="truncate min-w-0 text-left flex-1">
            {selectedIntegration ? selectedIntegration.name : 'Conexão de IA'}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[260px] max-w-[90vw] p-0" align="end">
        <Command>
          <CommandInput placeholder="Procurar conexão…" />
          <CommandList>
            <CommandEmpty>Nenhuma conexão encontrada.</CommandEmpty>
            <CommandGroup>
              {integrations.map((integration) => (
                <CommandItem
                  key={integration.id}
                  value={integration.name}
                  onSelect={() => {
                    onSelect(integration.id);
                    setOpen(false);
                  }}
                >
                  {integration.name} ({integration.default_model || '—'})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const STRUCTURE_SYSTEM_PROMPT =
  'És um planeador de websites. Produz um PLANO ESTRUTURAL em Markdown: objectivos, público-alvo, tom de voz, lista de secções (com título e bullets do conteúdo sugerido), CTAs e notas para SEO. Não escrevas HTML, CSS nem JavaScript. Sê concreto e acionável. Responde em português.';

const SiteCreatorNode = memo(({ id, data, selected }) => {
  const { onUpdateNodeData, output, consumedNodeIds = [], onAddSiteStructureNode } = data;
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { flowId } = useParams();
  const { getNodes, getEdges } = useReactFlow();

  const [projectName, setProjectName] = useState('');
  const [isGeneratingStructure, setIsGeneratingStructure] = useState(false);
  const [createdProject, setCreatedProject] = useState(output?.data || null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [availableInputs, setAvailableInputs] = useState([]);
  const [llmIntegrations, setLlmIntegrations] = useState([]);
  const [selectedLlmId, setSelectedLlmId] = useState(data.llm_integration_id || null);

  /** Mesma lógica que SiteBuilderModal.fetchFlowContext — usa o canvas atual + checkboxes. */
  const buildFlowContextObject = () => {
    const nodes = getNodes();
    const edges = getEdges();
    const consumedNodeIds = data.consumedNodeIds || [];
    const incomingSources = edges.filter((e) => e.target === id).map((e) => e.source);
    const sourceNodeIds = [...new Set([...incomingSources, ...consumedNodeIds])];
    const context = {};
    sourceNodeIds.forEach((sourceId) => {
      const sourceNode = nodes.find((n) => n.id === sourceId);
      if (sourceNode && sourceNode.data?.output) {
        let key = sourceNode.type;
        if (sourceNode.type === 'agent' || sourceNode.type === 'chat') {
          key = `${key}_${sourceNode.data.label || sourceNode.id.slice(0, 4)}`;
        } else if (sourceNode.type === 'client' || sourceNode.type === 'campaign') {
          const name = sourceNode.data.output?.data?.name;
          key = `${key}_${String(name || 'item').replace(/\s+/g, '_')}`;
        }
        context[key] = sourceNode.data.output;
      }
    });
    return context;
  };

  useEffect(() => {
    const allNodes = getNodes();
    const potentialInputs = allNodes.filter(node => 
      node.id !== id && 
      (node.type === 'client' || node.type === 'campaign' || node.type === 'agent' || node.type === 'page_analyzer')
    );
    setAvailableInputs(potentialInputs);
  }, [getNodes, id]);

  useEffect(() => {
    if (output?.data) {
      setCreatedProject(output.data);
    }
  }, [output]);

  useEffect(() => {
    let cancelled = false;
    const fetchIntegrations = async () => {
      if (!user?.id || !profile) return;
      try {
        let userConnections = [];
        const { data: userData, error: userError } = await supabase
          .from('user_ai_connections')
          .select('id, name, provider, default_model, capabilities, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (!userError && userData) {
          userConnections = userData
            .filter(isTextConnection)
            .map((conn) => ({
              ...conn,
              is_user_connection: true,
              source: 'personal',
            }));
        }

        let integrations = userConnections;
        if (integrations.length === 0) {
          const { data: globalData, error: globalError } = await supabase
            .from('llm_integrations')
            .select('id, name, provider, default_model, is_active');

          if (!globalError && globalData) {
            integrations = globalData
              .filter((i) => i.is_active !== false)
              .map((i) => ({
                ...i,
                is_user_connection: false,
                source: 'global',
              }));
          }
        }

        if (cancelled) return;
        setLlmIntegrations(integrations || []);

        const stored = data.llm_integration_id;
        const stillValid = stored && integrations?.some((i) => String(i.id) === String(stored));
        if (stillValid) {
          setSelectedLlmId(stored);
          return;
        }
        if (integrations?.length > 0) {
          const first = integrations[0];
          setSelectedLlmId(first.id);
          onUpdateNodeData(id, { llm_integration_id: first.id });
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[SiteCreatorNode] conexões IA:', e);
          toast({
            title: 'Erro ao carregar conexões',
            description: e?.message || 'Não foi possível listar as conexões de IA.',
            variant: 'destructive',
          });
        }
      }
    };
    fetchIntegrations();
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile, id, data.llm_integration_id, toast, onUpdateNodeData]);

  useEffect(() => {
    if (data.llm_integration_id != null && String(data.llm_integration_id) !== String(selectedLlmId)) {
      setSelectedLlmId(data.llm_integration_id);
    }
  }, [data.llm_integration_id, selectedLlmId]);

  const handleSelectLlm = (llmId) => {
    setSelectedLlmId(llmId);
    onUpdateNodeData(id, { llm_integration_id: llmId });
  };

  const responseToPlainText = (raw) => {
    if (raw == null) return '';
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw.content != null) return String(raw.content);
    try {
      return JSON.stringify(raw, null, 2);
    } catch {
      return String(raw);
    }
  };

  const handleGenerateStructure = async () => {
    if (!projectName.trim() || !user) {
      toast({ title: 'Indique o nome do site', variant: 'destructive' });
      return;
    }
    if (!selectedLlmId) {
      toast({
        title: 'Selecione uma conexão de IA',
        description: 'Escolha uma conexão no seletor acima do botão.',
        variant: 'destructive',
      });
      return;
    }
    if (typeof onAddSiteStructureNode !== 'function') {
      toast({ title: 'Erro interno', description: 'Callback do fluxo indisponível.', variant: 'destructive' });
      return;
    }

    setIsGeneratingStructure(true);
    try {
      const flowCtx = buildFlowContextObject();
      const flowContextJson = JSON.stringify(flowCtx, null, 2);
      const userContent = `Nome do site: ${projectName.trim()}\n\nContexto do fluxo (JSON):\n${flowContextJson}`;

      const selectedConn = llmIntegrations.find((i) => String(i.id) === String(selectedLlmId));
      const { data: functionData, error } = await supabase.functions.invoke('generic-ai-chat', {
        body: JSON.stringify({
          messages: [
            { role: 'system', content: STRUCTURE_SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          llm_integration_id: selectedLlmId,
          is_user_connection: selectedConn?.is_user_connection === true,
        }),
      });

      if (error) throw new Error(error.message);
      const structureText = responseToPlainText(functionData?.response).trim();
      if (!structureText) {
        throw new Error('A IA devolveu uma resposta vazia.');
      }

      onAddSiteStructureNode(id, {
        projectName: projectName.trim(),
        structureText,
        siteCreatorNodeId: id,
        flowContextJson,
        llm_integration_id: selectedLlmId,
        llm_is_user_connection: selectedConn?.is_user_connection === true,
      });
      toast({ title: 'Plano gerado', description: 'Revise o nó “Estrutura” e use “Construir site” quando estiver pronto.' });
      setProjectName('');
    } catch (error) {
      toast({
        title: 'Não foi possível gerar a estrutura',
        description: getFriendlyErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingStructure(false);
    }
  };

  const handleOpenEditor = () => {
    if (!createdProject) return;
    setIsEditorOpen(true);
  };
  
  const handleConsumedNodeChange = (nodeId) => {
    const newConsumedNodeIds = consumedNodeIds.includes(nodeId)
      ? consumedNodeIds.filter(cid => cid !== nodeId)
      : [...consumedNodeIds, nodeId];
    
    onUpdateNodeData(id, { consumedNodeIds: newConsumedNodeIds });
  };

  const getNodeDisplayName = (node) => {
    if(node.type === 'agent') return node.data?.output?.moduleName || `Agente #${node.id.slice(0, 4)}`;
    return node.data?.label || node.type;
  }

  return (
    <>
      <Card className="w-80 border-2 border-green-500/50 shadow-lg">
        <Handle type="target" position={Position.Left} className="!bg-green-500" />
        <CardHeader className="flex flex-row items-center gap-2 p-3 bg-green-500/10 min-w-0">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Globe className="w-5 h-5 shrink-0 text-green-500" />
            <CardTitle className="text-base truncate">Criador de Site</CardTitle>
          </div>
          <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
        </CardHeader>
        <CardContent className="p-3 space-y-3">
          {createdProject ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Projeto Criado:</p>
              <p className="font-semibold">{createdProject.name}</p>
              <Button onClick={handleOpenEditor} className="w-full">
                <Edit className="mr-2 h-4 w-4" />
                Abrir Editor
              </Button>
            </div>
          ) : (
            <>
              <Input
                type="text"
                placeholder="Nome do novo site..."
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                disabled={isGeneratingStructure}
                className="nodrag"
              />
              {availableInputs.length > 0 && (
                <div className="space-y-2 pt-2">
                  <Label className="flex items-center space-x-2">
                    <Link2 className="h-4 w-4" />
                    <span>Fontes de Dados para IA</span>
                  </Label>
                  <div className="max-h-32 overflow-y-auto space-y-1 nodrag p-2 bg-muted/50 rounded-md">
                    {availableInputs.map(node => (
                      <div key={node.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`consume-${id}-${node.id}`}
                          checked={consumedNodeIds.includes(node.id)}
                          onCheckedChange={() => handleConsumedNodeChange(node.id)}
                        />
                        <label
                          htmlFor={`consume-${id}-${node.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {getNodeDisplayName(node)}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">IA para o plano</Label>
                <LlmIntegrationSelector
                  integrations={llmIntegrations}
                  selectedId={selectedLlmId}
                  onSelect={handleSelectLlm}
                  disabled={isGeneratingStructure}
                />
              </div>
              <Button
                type="button"
                onClick={handleGenerateStructure}
                disabled={isGeneratingStructure || !projectName.trim() || !selectedLlmId}
                className="w-full"
              >
                {isGeneratingStructure ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>A gerar plano…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    <span>Gerar estrutura</span>
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
        <Handle type="source" position={Position.Right} className="!bg-green-500" />
      </Card>
      {createdProject && (
        <SiteBuilderModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          projectId={createdProject.id}
          flowId={flowId}
          nodeId={id}
        />
      )}
    </>
  );
});

export default SiteCreatorNode;