import React, { memo, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Globe, Edit, Loader2, Link2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import SiteBuilderModal from '@/components/flow-builder/modals/SiteBuilderModal';
import { useParams } from 'react-router-dom';
import { getFriendlyErrorMessage } from '@/lib/utils';

const SiteCreatorNode = memo(({ id, data }) => {
  const { onUpdateNodeData, output, consumedNodeIds = [] } = data;
  const { toast } = useToast();
  const { user } = useAuth();
  const { flowId } = useParams();
  const { getNodes } = useReactFlow();

  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [createdProject, setCreatedProject] = useState(output?.data || null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [availableInputs, setAvailableInputs] = useState([]);

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
    if (!jobId) return;

    const channel = supabase
      .channel(`site_project_status:${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'site_projects', filter: `id=eq.${jobId}` },
        (payload) => {
          const updatedProject = payload.new;
          if (updatedProject.status === 'completed') {
            setCreatedProject(updatedProject);
            onUpdateNodeData(id, {
              ...data,
              output: { id: updatedProject.id, data: updatedProject },
            });
            toast({ title: 'Seu site foi criado com sucesso!' });
            setIsLoading(false);
            setJobId(null);
            channel.unsubscribe();
          } else if (updatedProject.status === 'failed') {
            toast({ title: 'Erro ao criar projeto', description: updatedProject.error_message, variant: 'destructive' });
            setIsLoading(false);
            setJobId(null);
            channel.unsubscribe();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, toast, onUpdateNodeData, id, data]);

  const handleCreateProject = async () => {
    if (!projectName.trim() || !user) {
      toast({ title: 'Nome do projeto é obrigatório', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const { data: newProject, error } = await supabase
        .from('site_projects')
        .insert({
          name: projectName,
          user_id: user.id,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;

      setJobId(newProject.id);
      toast({ title: 'Criação do site iniciada!', description: 'O processo está rodando em segundo plano.' });
      setProjectName('');

      const { error: functionError } = await supabase.functions.invoke('site-generator', {
        body: { project_id: newProject.id },
      });

      if (functionError) {
        console.error("Erro ao invocar a função site-generator:", functionError);
      }

    } catch (error) {
      const friendlyMsg = getFriendlyErrorMessage(error);
      toast({ title: 'Aviso', description: friendlyMsg, variant: 'destructive' });
      setIsLoading(false);
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
    
    onUpdateNodeData(id, { ...data, consumedNodeIds: newConsumedNodeIds });
  };

  const getNodeDisplayName = (node) => {
    if(node.type === 'agent') return node.data?.output?.moduleName || `Agente #${node.id.slice(0, 4)}`;
    return node.data?.label || node.type;
  }

  return (
    <>
      <Card className="w-80 border-2 border-green-500/50 shadow-lg">
        <Handle type="target" position={Position.Left} className="!bg-green-500" />
        <CardHeader className="flex-row items-center space-x-2 p-3 bg-green-500/10">
          <Globe className="w-5 h-5 text-green-500" />
          <CardTitle className="text-base">Criador de Site</CardTitle>
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
                disabled={isLoading}
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
              <Button onClick={handleCreateProject} disabled={isLoading || !projectName.trim()} className="w-full">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Gerando...</span>
                  </>
                ) : (
                  <>
                    <Globe className="mr-2 h-4 w-4" />
                    <span>Criar Site</span>
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