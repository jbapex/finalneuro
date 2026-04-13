import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import ModuleForm from './modules/ModuleForm';
import ModuleCard from './modules/ModuleCard';
import { prepareModuleConfigForEditor, normalizeGeneratorCategoriesForSave } from '@/lib/modules/generatorCategories';

const ModulesManagement = () => {
  const { toast } = useToast();
  const [modules, setModules] = useState([]);
  const [llmIntegrations, setLlmIntegrations] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCustomForm, setIsCustomForm] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  
  const initialFormData = {
    name: '',
    description: '',
    base_prompt: '',
    llm_integration_id: null,
    config: {
      use_client: false,
      use_campaign: true,
      use_complementary_text: true,
      generator_categories: ['geral'],
    },
    suggested_module_ids: [],
  };
  const [formData, setFormData] = useState(initialFormData);

  const fetchModules = useCallback(async () => {
    const { data, error } = await supabase
      .from('modules')
      .select('*, llm_integration:llm_integration_id(id, name), suggestions:module_suggestions!source_module_id(suggested_module_id)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar módulos', description: error.message, variant: 'destructive' });
    } else {
      const processedModules = data.map(m => ({
        ...m,
        suggested_module_ids: m.suggestions.map(s => s.suggested_module_id),
      }));
      setModules(processedModules);
    }
  }, [toast]);

  const fetchIntegrations = useCallback(async () => {
    const { data, error } = await supabase.from('llm_integrations').select('id, name');
    if (error) {
      toast({ title: 'Erro ao carregar conexões de IA', description: error.message, variant: 'destructive' });
    } else {
      setLlmIntegrations(data);
    }
  }, [toast]);

  useEffect(() => {
    fetchModules();
    fetchIntegrations();
  }, [fetchModules, fetchIntegrations]);

  const openForm = (custom = false, moduleToEdit = null) => {
    setIsCustomForm(custom);
    if (moduleToEdit) {
      setEditingModule(moduleToEdit);
      
      const defaultConfig = {
        use_client: false,
        use_campaign: true,
        use_complementary_text: true,
      };

      const finalConfig = prepareModuleConfigForEditor({
        ...defaultConfig,
        ...(moduleToEdit.config || {}),
      });

      setFormData({
        name: moduleToEdit.name || '',
        description: moduleToEdit.description || '',
        base_prompt: moduleToEdit.base_prompt || '',
        llm_integration_id: moduleToEdit.llm_integration_id,
        config: finalConfig,
        suggested_module_ids: moduleToEdit.suggested_module_ids || [],
      });
    } else {
      setEditingModule(null);
      const baseConfig = {
        use_client: false,
        use_campaign: true,
        use_complementary_text: true,
        generator_categories: ['geral'],
      };
      setFormData({ ...initialFormData, config: baseConfig });
    }
    setIsFormOpen(true);
  };

  const handleDelete = async (moduleId) => {
    const { error } = await supabase.from('modules').delete().eq('id', moduleId);
    if (error) {
      toast({ title: 'Erro ao deletar módulo', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Módulo deletado!', description: 'O módulo foi removido com sucesso.' });
      fetchModules();
    }
  };

  const handleToggleStatus = async (module, isActive) => {
    const { error } = await supabase
      .from('modules')
      .update({ is_active: isActive })
      .eq('id', module.id);

    if (error) {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Status atualizado!', description: `O módulo ${module.name} foi ${isActive ? 'ativado' : 'desativado'}.` });
      fetchModules();
    }
  };

  const handleSubmit = async (data, moduleToEdit) => {
    const { suggested_module_ids, ...moduleData } = data;
    const dataToSave = {
      name: moduleData.name,
      description: moduleData.description,
      base_prompt: moduleData.base_prompt,
      llm_integration_id: moduleData.llm_integration_id,
      config: normalizeGeneratorCategoriesForSave(moduleData.config),
    };
    
    let response;
    let moduleId = moduleToEdit?.id;

    if (moduleToEdit) {
      response = await supabase.from('modules').update(dataToSave).eq('id', moduleToEdit.id).select().single();
    } else {
      response = await supabase.from('modules').insert([dataToSave]).select().single();
    }

    const { data: savedModule, error } = response;

    if (error) {
        toast({ title: `Erro ao ${moduleToEdit ? 'atualizar' : 'criar'} módulo`, description: error.message, variant: 'destructive' });
        return;
    }
    
    moduleId = savedModule.id;

    const { error: deleteError } = await supabase.from('module_suggestions').delete().eq('source_module_id', moduleId);
    if (deleteError) {
      console.error("Error clearing old suggestions:", deleteError);
    }
    
    if (suggested_module_ids && suggested_module_ids.length > 0) {
      const suggestionsToInsert = suggested_module_ids.map(sid => ({
        source_module_id: moduleId,
        suggested_module_id: sid
      }));
      const { error: insertSuggestionsError } = await supabase.from('module_suggestions').insert(suggestionsToInsert);
      if (insertSuggestionsError) {
        toast({ title: 'Erro ao salvar conexões', description: insertSuggestionsError.message, variant: 'destructive' });
      }
    }

    toast({ title: `Módulo ${moduleToEdit ? 'atualizado' : 'criado'}!`, description: `O módulo foi ${moduleToEdit ? 'salvo' : 'criado'} com sucesso.` });
    fetchModules();
  };

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-center md:text-left">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold gradient-text mb-2">Gerenciamento de Módulos</h1>
          <p className="text-sm md:text-base text-muted-foreground">Crie e configure os módulos de IA para seus usuários.</p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          <Button onClick={() => openForm(false)}>
            <Plus className="w-4 h-4 mr-2" /> Novo Módulo
          </Button>
          <Button variant="outline" onClick={() => openForm(true)}>
            <Settings2 className="w-4 h-4 mr-2" /> Novo Módulo Personalizado
          </Button>
        </div>
      </motion.div>

      <ModuleForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleSubmit}
        editingModule={editingModule}
        formData={formData}
        setFormData={setFormData}
        llmIntegrations={llmIntegrations}
        allModules={modules}
        isCustom={isCustomForm}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module, index) => (
          <ModuleCard
            key={module.id}
            module={module}
            index={index}
            onEdit={openForm}
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
          />
        ))}
      </div>
    </div>
  );
};

export default ModulesManagement;