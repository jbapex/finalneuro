import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Edit, Save, Lock, Unlock, CheckCircle, Bot, Zap, Sparkles, Code, Copy, Wand2, BrainCircuit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import ObjectiveVisualizer from './visualizers/ObjectiveVisualizer';
import WhatToDoVisualizer from './visualizers/WhatToDoVisualizer';
import PhasesVisualizer from './visualizers/PhasesVisualizer';
import PaidTrafficVisualizer from './visualizers/PaidTrafficVisualizer';
import ScheduleVisualizer from './visualizers/ScheduleVisualizer';
import VideoIdeasVisualizer from './visualizers/VideoIdeasVisualizer';
import EditWithAiModal from './EditWithAiModal';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { getFriendlyErrorMessage } from '@/lib/utils';

const visualizers = {
  objective: ObjectiveVisualizer,
  what_to_do: WhatToDoVisualizer,
  phases: PhasesVisualizer,
  paid_traffic: PaidTrafficVisualizer,
  schedule: ScheduleVisualizer,
  video_ideas: VideoIdeasVisualizer,
};

const JsonModal = ({ content, title }) => {
  const { toast } = useToast();
  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(content, null, 2));
    toast({ title: "JSON Copiado!", description: "O conteúdo foi copiado para a área de transferência." });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Code className="w-4 h-4 mr-1" /> Ver JSON</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Conteúdo JSON: {title}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto max-h-[60vh]">{JSON.stringify(content, null, 2)}</pre>
          <Button size="icon" variant="ghost" className="absolute top-2 right-2" onClick={copyToClipboard}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};


const PromptModal = ({ prompt, onRegenerate, isLoading }) => {
    const [editablePrompt, setEditablePrompt] = useState(prompt || '');
  
    useEffect(() => {
      setEditablePrompt(prompt || '');
    }, [prompt]);
  
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" className="text-purple-500 hover:text-purple-600">
            <BrainCircuit className="w-4 h-4 mr-1" /> Ver Prompt
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prompt da IA</DialogTitle>
            <DialogDescription>Visualize e edite o prompt usado para gerar este conteúdo.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={editablePrompt}
            onChange={(e) => setEditablePrompt(e.target.value)}
            className="min-h-[300px] font-mono text-xs bg-muted"
          />
          <Button onClick={() => onRegenerate(editablePrompt)} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Regerar com este Prompt
          </Button>
        </DialogContent>
      </Dialog>
    );
  };

const StepCard = ({ step, title, description, planningId, initialData, onUpdate, isEnabled, context }) => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [content, setContent] = useState(null);
  const [isApproved, setIsApproved] = useState(false);
  const [version, setVersion] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editableContent, setEditableContent] = useState('');
  const [stepId, setStepId] = useState(null);
  const [prompt, setPrompt] = useState('');

  const isSuperAdmin = profile?.user_type === 'super_admin';

  useEffect(() => {
    if (initialData) {
      setStepId(initialData.id);
      setContent(initialData.content);
      setIsApproved(initialData.is_approved);
      setVersion(initialData.version);
      setEditableContent(JSON.stringify(initialData.content, null, 2));
      setPrompt(initialData.prompt || '');
    } else {
      setStepId(null);
      setContent(null);
      setIsApproved(false);
      setVersion(1);
      setEditableContent('');
      setPrompt('');
    }
  }, [initialData]);
  
  const handleUpsertStep = async (newContent, newPrompt) => {
    const newVersion = initialData ? version + 1 : 1;
    const dataToUpsert = {
      planning_id: planningId,
      step: step,
      content: newContent,
      version: newVersion,
      is_approved: false,
      prompt: newPrompt,
    };
  
    const { data: savedData, error: saveError } = await supabase
      .from('planning_steps')
      .upsert(dataToUpsert, { onConflict: 'planning_id,step' })
      .select()
      .single();
  
    if (saveError) throw saveError;
    
    onUpdate(savedData);
    return savedData;
  };

  const handleGenerate = async (userPromptText = '', customFullPrompt = null) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('strategic-planner', {
        body: { 
            step: step, 
            campaign_id: context.campaignId, 
            client_id: context.clientId, 
            month: context.month, 
            year: context.year,
            previous_steps: context.previousSteps,
            current_content: userPromptText ? content : null,
            user_prompt: userPromptText,
            custom_full_prompt: customFullPrompt,
        },
      });

      if (error) throw new Error(error.message.includes(":") ? error.message.split(':')[1] : error.message);
      
      await handleUpsertStep(data.content, data.prompt);
      
      toast({ title: `Etapa "${title}" ${userPromptText || customFullPrompt ? 'refinada' : 'gerada'}!`, description: 'O conteúdo foi criado com sucesso.' });

    } catch (error) {
      const friendlyMsg = getFriendlyErrorMessage(error);
      toast({ title: `Aviso ao ${userPromptText || customFullPrompt ? 'refinar' : 'gerar'} ${title}`, description: friendlyMsg, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditSave = async () => {
    setIsLoading(true);
    try {
      const parsedContent = JSON.parse(editableContent);
      await handleUpsertStep(parsedContent, prompt);
      setIsEditing(false);
      toast({ title: `Etapa "${title}" atualizada!`, description: 'Suas alterações foram salvas.' });

    } catch (error) {
      toast({ title: 'Erro ao salvar', description: 'O conteúdo parece ser um JSON inválido. Verifique a sintaxe.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveToggle = async () => {
    setIsLoading(true);
    const newApprovedState = !isApproved;
    try {
      const { data: savedData, error } = await supabase
        .from('planning_steps')
        .update({ is_approved: newApprovedState })
        .eq('id', stepId)
        .select()
        .single();
      
      if (error) throw error;

      onUpdate(savedData);
      toast({
        title: `Etapa ${newApprovedState ? 'aprovada' : 'reaberta'}!`,
        description: newApprovedState ? 'Você pode prosseguir para o próximo passo.' : 'A edição foi liberada.',
      });

    } catch (error) {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    const Visualizer = visualizers[step];
    
    if (isEditing) {
      return (
        <Textarea
          value={editableContent}
          onChange={(e) => setEditableContent(e.target.value)}
          className="min-h-[250px] font-mono text-xs bg-muted/50 border-primary/50 focus:ring-primary"
          disabled={isLoading}
        />
      );
    }
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={version}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="p-4 bg-background rounded-lg"
            >
              {Visualizer ? <Visualizer content={content} /> : <pre>{JSON.stringify(content, null, 2)}</pre>}
            </motion.div>
        </AnimatePresence>
    );
  };
  
  const cardVariants = {
    disabled: { opacity: 0.5, y: 0, filter: "blur(1px)" },
    enabled: { opacity: 1, y: 0, filter: "blur(0px)" }
  };

  return (
    <motion.div
        variants={cardVariants}
        initial="disabled"
        animate={isEnabled ? "enabled" : "disabled"}
        transition={{ duration: 0.5 }}
    >
    <Card className={`transition-all duration-300 ${!isEnabled ? 'bg-muted/30' : ''} ${isApproved ? 'border-green-500/50 shadow-green-500/10' : 'border-border'}`}>
      <CardHeader className="flex flex-row justify-between items-start">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            {title}
            {isApproved && <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700"><CheckCircle className="w-3 h-3 mr-1" /> Aprovado</Badge>}
            {content && <Badge variant="outline">v{version}</Badge>}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex gap-2 flex-shrink-0">
           {content && <JsonModal content={content} title={title} />}
           {content && isSuperAdmin && <PromptModal prompt={prompt} onRegenerate={(newPrompt) => handleGenerate('', newPrompt)} isLoading={isLoading} />}
           {content && (
            <Button size="sm" variant={isApproved ? "secondary" : "default"} onClick={handleApproveToggle} disabled={isLoading || !isEnabled}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isApproved ? <Unlock className="w-4 h-4 mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />)}
              {isApproved ? 'Desbloquear' : 'Aprovar'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {content ? renderContent() : (
             <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                <Sparkles className="w-10 h-10 text-muted-foreground mb-4" />
                <h3 className="font-semibold">Etapa Pronta para Começar</h3>
                <p className="text-sm text-muted-foreground">Clique em "Gerar com IA" para criar o conteúdo desta seção.</p>
            </div>
        )}
        <div className="flex gap-2 pt-2 items-center">
            {!isApproved && (
              <Button onClick={() => handleGenerate()} disabled={isLoading || !isEnabled} className="bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-shadow">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                {content ? 'Regerar do Zero' : 'Gerar com IA'}
              </Button>
            )}
            {content && !isApproved && (
            <>
              <EditWithAiModal onGenerate={handleGenerate} isLoading={isLoading} title={title} disabled={!isEnabled} />
              {isEditing ? (
                <Button size="sm" onClick={handleEditSave} disabled={isLoading || !isEnabled}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                   {isLoading ? '' : 'Salvar JSON'}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} disabled={isLoading || !isEnabled}>
                  <Edit className="w-4 h-4 mr-1" /> Editar JSON
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
    </motion.div>
  );
};

export default StepCard;