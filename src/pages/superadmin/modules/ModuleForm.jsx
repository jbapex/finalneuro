import React, { useState, useEffect, useCallback } from 'react';
import { Info, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { MODULE_GENERATOR_CATEGORIES, getModuleGeneratorCategoryIds } from '@/lib/modules/generatorCategories';

const ModuleForm = ({
  isOpen,
  onOpenChange,
  onSubmit,
  editingModule,
  formData,
  setFormData,
  llmIntegrations,
  allModules,
  isCustom,
}) => {
  const [connectAgents, setConnectAgents] = useState(false);

  const resetForm = useCallback(() => {
    setFormData({
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
    });
    setConnectAgents(false);
    onOpenChange(false);
  }, [setFormData, onOpenChange]);

  const handleConfigChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      config: {
        ...prev.config,
        [key]: value,
      },
    }));
  };

  const toggleGeneratorCategory = (catId) => {
    setFormData((prev) => {
      const current = getModuleGeneratorCategoryIds(prev.config);
      const next = new Set(current);
      if (next.has(catId)) {
        if (next.size <= 1) return prev;
        next.delete(catId);
      } else {
        next.add(catId);
      }
      return {
        ...prev,
        config: {
          ...prev.config,
          generator_categories: Array.from(next),
        },
      };
    });
  };

  const handleSuggestedModuleChange = (moduleId) => {
    setFormData(prev => {
      const newIds = new Set(prev.suggested_module_ids || []);
      if (newIds.has(moduleId)) {
        newIds.delete(moduleId);
      } else {
        newIds.add(moduleId);
      }
      return { ...prev, suggested_module_ids: Array.from(newIds) };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSubmit = { ...formData };
    if (!connectAgents) {
      dataToSubmit.suggested_module_ids = [];
    }
    onSubmit(dataToSubmit, editingModule);
    resetForm();
  };
  
  useEffect(() => {
    if (editingModule?.suggested_module_ids?.length > 0) {
      setConnectAgents(true);
    } else {
      setConnectAgents(false);
    }
  }, [editingModule]);
  
  useEffect(() => {
    if (!isOpen) {
        resetForm();
    }
  }, [isOpen, resetForm]);

  const availableModules = allModules.filter(m => m.id !== editingModule?.id);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px] bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle>
            {editingModule
              ? `Editar Módulo ${isCustom ? 'Personalizado' : ''}`
              : `Criar Novo Módulo ${isCustom ? 'Personalizado' : ''}`}
          </DialogTitle>
          <DialogDescription>
            Preencha os campos para {editingModule ? 'atualizar' : 'criar'} um módulo de IA.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          <div>
            <Label htmlFor="name">Nome do Módulo</Label>
            <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="llm_integration_id">Conexão de IA (Cérebro)</Label>
            <Select
              value={formData.llm_integration_id ? String(formData.llm_integration_id) : 'none'}
              onValueChange={(value) => setFormData({ ...formData, llm_integration_id: value !== 'none' ? Number(value) : null })}
            >
              <SelectTrigger id="llm_integration_id" className="w-full">
                <SelectValue placeholder="Selecione a conexão de IA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma (Padrão do Sistema)</SelectItem>
                {llmIntegrations.map(integration => (
                  <SelectItem key={integration.id} value={String(integration.id)}>{integration.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 p-4 border rounded-md">
            <h4 className="font-semibold text-sm">Categorias no Gerador de Conteúdo</h4>
            <p className="text-xs text-muted-foreground">
              Selecione uma ou mais: o agente aparece em cada filtro escolhido (ex.: vídeo e campanhas).
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {MODULE_GENERATOR_CATEGORIES.map((cat) => {
                const selected = getModuleGeneratorCategoryIds(formData.config).includes(cat.id);
                return (
                  <div key={cat.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`gen-cat-${cat.id}`}
                      checked={selected}
                      onCheckedChange={() => toggleGeneratorCategory(cat.id)}
                    />
                    <Label htmlFor={`gen-cat-${cat.id}`} className="text-sm font-normal leading-tight cursor-pointer">
                      {cat.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </div>
          
          {isCustom && (
            <div className="space-y-3 p-4 border rounded-md">
              <h4 className="font-semibold text-sm">Etapas de Configuração</h4>
              <div className="flex items-center space-x-2">
                <Checkbox id="use_client" checked={formData.config.use_client} onCheckedChange={(checked) => handleConfigChange('use_client', !!checked)} />
                <Label htmlFor="use_client">Usar seleção de Cliente</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="use_campaign" checked={formData.config.use_campaign} onCheckedChange={(checked) => handleConfigChange('use_campaign', !!checked)} />
                <Label htmlFor="use_campaign">Usar seleção de Campanha</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="use_complementary_text" checked={formData.config.use_complementary_text} onCheckedChange={(checked) => handleConfigChange('use_complementary_text', !!checked)} />
                <Label htmlFor="use_complementary_text">Usar campo de Texto Complementar</Label>
              </div>
            </div>
          )}

          <div className="space-y-3 p-4 border rounded-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Conexão entre Agentes</h4>
              </div>
              <Switch checked={connectAgents} onCheckedChange={setConnectAgents} />
            </div>
            {connectAgents && (
              <div className="space-y-2 pt-2 border-t">
                <Label>Sugerir este módulo após:</Label>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {availableModules.map(module => (
                    <div key={module.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`suggest-${module.id}`}
                        checked={(formData.suggested_module_ids || []).includes(module.id)}
                        onCheckedChange={() => handleSuggestedModuleChange(module.id)}
                      />
                      <Label htmlFor={`suggest-${module.id}`}>{module.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="base_prompt">Prompt Base</Label>
            <Textarea
              id="base_prompt"
              value={formData.base_prompt}
              onChange={(e) => setFormData({ ...formData, base_prompt: e.target.value })}
              className="min-h-[150px]"
              placeholder="Ex: Crie uma arte estática. Use as informações em [CONTEXTO] quando fornecidas."
              required
            />
            <div className="flex items-start text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded-md space-y-1">
              <Info className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
              <span className="block">
                O sistema adiciona automaticamente um bloco <code className="bg-gray-700 px-1 py-0.5 rounded text-foreground font-mono">[CONTEXTO]</code> com dados do cliente, campanha e contexto selecionado (quando disponíveis). O modelo já é instruído a usar esse bloco; você pode reforçar no prompt algo como &quot;use as informações em [CONTEXTO]&quot;.
              </span>
              <span className="block">
                Variáveis: <code className="bg-gray-700 px-1 py-0.5 rounded text-foreground font-mono">{'{{resultado_agente:NOME_DO_AGENTE}}'}</code> para usar o output de outro agente.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={resetForm}>Cancelar</Button>
            <Button type="submit">
              {editingModule ? 'Salvar Alterações' : 'Criar Módulo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ModuleForm;