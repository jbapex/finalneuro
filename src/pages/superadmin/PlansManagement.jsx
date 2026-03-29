import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Package, DollarSign, Users, BrainCircuit, Repeat, Globe, Megaphone, ClipboardList, Image as ImageIcon, Search, MessageSquare, Share2, FileText, Lightbulb, CalendarDays, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import PlanFormDialog from '@/components/superadmin/plans/PlanFormDialog';

const PlansManagement = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState([]);
  const [modules, setModules] = useState([]);
  const [aiModels, setAiModels] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const initialFormData = {
    name: '',
    description: '',
    price: '',
    duration: '30',
    max_users: '',
    limite_execucoes_dia: '10',
    module_ids: [],
    has_site_builder_access: false,
    has_ads_access: false,
    has_strategic_planner_access: false,
    has_campaign_analyzer_access: false,
    has_image_generator_access: false,
    has_ai_chat_access: false,
    has_creative_flow_access: false,
    has_transcriber_access: false,
    has_trending_topics_access: false,
    has_keyword_planner_access: false,
    has_publication_calendar_access: false,
    has_neurodesign_access: false,
    plan_image_generation_config: {
      max_size: 1024,
      max_images_per_job: 2,
      creative_flow_limit: 3,
      allowed_model_ids: [],
      cost_markup_percentage: 20,
    },
  };
  const [formData, setFormData] = useState(initialFormData);

  const fetchPlans = useCallback(async () => {
    const { data, error } = await supabase
      .from('plans')
      .select('*, plan_modules(module_id)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar planos", description: error.message, variant: 'destructive' });
    } else {
      const formattedPlans = data.map(plan => ({
        ...plan,
        module_ids: plan.plan_modules.map(pm => pm.module_id)
      }));
      setPlans(formattedPlans);
    }
  }, [toast]);

  const fetchModules = useCallback(async () => {
    const { data, error } = await supabase.from('modules').select('id, name');
    if (error) {
      toast({ title: "Erro ao carregar módulos", description: error.message, variant: 'destructive' });
    } else {
      setModules(data);
    }
  }, [toast]);

  const fetchAiModels = useCallback(async () => {
    const { data, error } = await supabase.from('ai_models').select('id, model_name, capabilities');
    if (error) {
      toast({ title: "Erro ao carregar modelos de IA", description: error.message, variant: 'destructive' });
    } else {
      setAiModels(data.filter(m => m.capabilities?.image));
    }
  }, [toast]);

  useEffect(() => {
    fetchPlans();
    fetchModules();
    fetchAiModels();
  }, [fetchPlans, fetchModules, fetchAiModels]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const planData = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      max_users: parseInt(formData.max_users),
      duration: parseInt(formData.duration),
      limite_execucoes_dia: parseInt(formData.limite_execucoes_dia),
      has_site_builder_access: formData.has_site_builder_access,
      has_ads_access: formData.has_ads_access,
      has_strategic_planner_access: formData.has_strategic_planner_access,
      has_campaign_analyzer_access: formData.has_campaign_analyzer_access,
      has_image_generator_access: formData.has_image_generator_access,
      has_ai_chat_access: formData.has_ai_chat_access,
      has_creative_flow_access: formData.has_creative_flow_access,
      has_transcriber_access: formData.has_transcriber_access,
      has_trending_topics_access: formData.has_trending_topics_access,
      has_keyword_planner_access: formData.has_keyword_planner_access,
      has_publication_calendar_access: formData.has_publication_calendar_access,
      has_neurodesign_access: formData.has_neurodesign_access,
      plan_image_generation_config: {
        ...formData.plan_image_generation_config,
        max_size: parseInt(formData.plan_image_generation_config.max_size),
        max_images_per_job: parseInt(formData.plan_image_generation_config.max_images_per_job),
        creative_flow_limit: parseInt(formData.plan_image_generation_config.creative_flow_limit || 3),
        cost_markup_percentage: parseInt(formData.plan_image_generation_config.cost_markup_percentage),
        allowed_model_ids: formData.plan_image_generation_config.allowed_model_ids.map(Number),
      },
    };

    if (editingPlan) {
      const { data: updatedPlan, error: planError } = await supabase
        .from('plans')
        .update(planData)
        .eq('id', editingPlan.id)
        .select()
        .single();

      if (planError) {
        toast({ title: 'Erro ao atualizar plano', description: planError.message, variant: 'destructive' });
        return;
      }

      await supabase.from('plan_modules').delete().eq('plan_id', updatedPlan.id);
      
      if (formData.module_ids.length > 0) {
        const modulesToInsert = formData.module_ids.map(module_id => ({
          plan_id: updatedPlan.id,
          module_id: parseInt(module_id, 10)
        }));
        const { error: modulesError } = await supabase.from('plan_modules').insert(modulesToInsert);
        if (modulesError) {
          toast({ title: 'Erro ao associar módulos ao plano', description: modulesError.message, variant: 'destructive' });
          return;
        }
      }
      
      toast({ title: "Plano atualizado!", description: "O plano foi atualizado com sucesso." });
    } else {
      const { data: newPlan, error: planError } = await supabase
        .from('plans')
        .insert([planData])
        .select()
        .single();

      if (planError) {
        toast({ title: 'Erro ao criar plano', description: planError.message, variant: 'destructive' });
        return;
      }

      if (formData.module_ids.length > 0) {
        const modulesToInsert = formData.module_ids.map(module_id => ({
          plan_id: newPlan.id,
          module_id: parseInt(module_id, 10)
        }));
        const { error: modulesError } = await supabase.from('plan_modules').insert(modulesToInsert);
        if (modulesError) {
          toast({ title: 'Erro ao associar módulos ao plano', description: modulesError.message, variant: 'destructive' });
          return;
        }
      }

      toast({ title: "Plano criado!", description: "Novo plano foi criado com sucesso." });
    }

    fetchPlans();
    resetForm();
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      price: plan.price.toString(),
      duration: plan.duration.toString(),
      max_users: plan.max_users.toString(),
      limite_execucoes_dia: plan.limite_execucoes_dia.toString(),
      module_ids: plan.module_ids.map(id => id.toString()),
      has_site_builder_access: plan.has_site_builder_access || false,
      has_ads_access: plan.has_ads_access || false,
      has_strategic_planner_access: plan.has_strategic_planner_access || false,
      has_campaign_analyzer_access: plan.has_campaign_analyzer_access || false,
      has_image_generator_access: plan.has_image_generator_access || false,
      has_ai_chat_access: plan.has_ai_chat_access || false,
      has_creative_flow_access: plan.has_creative_flow_access || false,
      has_transcriber_access: plan.has_transcriber_access || false,
      has_trending_topics_access: plan.has_trending_topics_access || false,
      has_keyword_planner_access: plan.has_keyword_planner_access || false,
      has_publication_calendar_access: plan.has_publication_calendar_access || false,
      has_neurodesign_access: plan.has_neurodesign_access || false,
      plan_image_generation_config: {
        max_size: plan.plan_image_generation_config?.max_size || 1024,
        max_images_per_job: plan.plan_image_generation_config?.max_images_per_job || 2,
        creative_flow_limit: plan.plan_image_generation_config?.creative_flow_limit || 3,
        allowed_model_ids: plan.plan_image_generation_config?.allowed_model_ids?.map(String) || [],
        cost_markup_percentage: plan.plan_image_generation_config?.cost_markup_percentage || 20,
      },
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (planId) => {
    await supabase.from('plan_modules').delete().eq('plan_id', planId);
    const { error } = await supabase.from('plans').delete().eq('id', planId);
    
    if (error) {
      toast({ title: "Erro ao remover plano", description: error.message, variant: 'destructive' });
    } else {
      toast({ title: "Plano removido!", description: "O plano foi removido com sucesso." });
      fetchPlans();
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingPlan(null);
    setIsDialogOpen(false);
  };

  const getModuleNames = (moduleIds) => {
    if (!moduleIds || moduleIds.length === 0) return 'Nenhum módulo incluso.';
    return moduleIds
      .map(id => modules.find(module => module.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  const getImageModelNames = (modelIds) => {
    if (!modelIds || modelIds.length === 0) return 'Nenhum modelo de imagem permitido.';
    return modelIds
      .map(id => aiModels.find(model => model.id === id)?.model_name)
      .filter(Boolean)
      .join(', ');
  };

  const getAccessList = (plan) => {
    const accesses = [];
    if(plan.has_site_builder_access) accesses.push({ icon: Globe, label: 'Criador de Sites' });
    if(plan.has_ads_access) accesses.push({ icon: Megaphone, label: 'ADS Inteligente' });
    if(plan.has_strategic_planner_access) accesses.push({ icon: ClipboardList, label: 'Planejamento' });
    if(plan.has_campaign_analyzer_access) accesses.push({ icon: Search, label: 'Analisador de Ads' });
    if(plan.has_image_generator_access) accesses.push({ icon: ImageIcon, label: 'Gerador de Imagem' });
    if(plan.has_ai_chat_access) accesses.push({ icon: MessageSquare, label: 'Chat IA' });
    if(plan.has_creative_flow_access) accesses.push({ icon: Share2, label: 'Fluxo Criativo' });
    if(plan.has_transcriber_access) accesses.push({ icon: FileText, label: 'Transcritor' });
    if(plan.has_trending_topics_access) accesses.push({ icon: Lightbulb, label: 'Assuntos em Alta' });
    if(plan.has_keyword_planner_access) accesses.push({ icon: Search, label: 'Planejador de Palavras' });
    if(plan.has_publication_calendar_access) accesses.push({ icon: CalendarDays, label: 'Calendário de Posts' });
    if(plan.has_neurodesign_access) accesses.push({ icon: Palette, label: 'NeuroDesign' });
    return accesses;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setIsDialogOpen(open);
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row justify-between items-center text-center md:text-left"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text mb-2">Gerenciamento de Planos</h1>
            <p className="text-sm md:text-base text-muted-foreground">Crie e gerencie planos de assinatura e seus módulos.</p>
          </div>
  
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)} className="mt-4 sm:mt-0">
              <Plus className="w-4 h-4 mr-2" />
              Novo Plano
            </Button>
          </DialogTrigger>
        </motion.div>
  
        <PlanFormDialog
          onSubmit={handleSubmit}
          editingPlan={editingPlan}
          formData={formData}
          setFormData={setFormData}
          modules={modules}
          aiModels={aiModels}
          onOpenChange={setIsDialogOpen}
        />
      </Dialog>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {plans.map((plan, index) => (
          <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.1 }}>
            <Card className="bg-card h-full flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center"><Package className="w-6 h-6 text-primary" /></div>
                    <div>
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription>{plan.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)} className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 flex-grow flex flex-col">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2"><DollarSign className="w-4 h-4 text-green-500" /><span className="text-2xl font-bold">R$ {plan.price.toFixed(2)}</span></div>
                  <span className="text-sm text-muted-foreground">/{plan.duration} dias</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground"><Users className="w-4 h-4" /><span>Até {plan.max_users} usuários</span></div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground"><Repeat className="w-4 h-4" /><span>{plan.limite_execucoes_dia} execuções/dia</span></div>
                
                <div className="p-3 rounded-lg bg-muted/50 flex-grow mt-2 space-y-2">
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center"><BrainCircuit className="w-4 h-4 mr-1" /> Módulos de Conteúdo Inclusos:</p>
                        <p className="text-xs">{getModuleNames(plan.module_ids)}</p>
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center">Suíte de Ferramentas:</p>
                        <div className="text-xs space-y-1">
                            {getAccessList(plan).length > 0 ? getAccessList(plan).map(access => {
                              const Icon = access.icon;
                              return <p key={access.label} className="flex items-center gap-2"><Icon className="w-3 h-3 text-primary" /> {access.label}</p>;
                            }) : <p>Nenhuma ferramenta especial inclusa.</p>}
                        </div>
                    </div>
                    {plan.has_image_generator_access && plan.plan_image_generation_config && (
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center"><ImageIcon className="w-4 h-4 mr-1" /> Modelos de Imagem Permitidos:</p>
                            <p className="text-xs">{getImageModelNames(plan.plan_image_generation_config.allowed_model_ids)}</p>
                        </div>
                    )}
                    {plan.has_creative_flow_access && (
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center"><Share2 className="w-4 h-4 mr-1" /> Limite de Fluxos Criativos:</p>
                            <p className="text-xs">{plan.plan_image_generation_config?.creative_flow_limit || 3} fluxos</p>
                        </div>
                    )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {plans.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="text-center py-12">
          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nenhum plano criado</h3>
          <p className="text-muted-foreground mb-6">Comece criando seu primeiro plano de assinatura</p>
          <Button onClick={() => setIsDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Criar Primeiro Plano</Button>
        </motion.div>
      )}
    </div>
  );
};

export default PlansManagement;