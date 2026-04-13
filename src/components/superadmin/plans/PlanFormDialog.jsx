import React from 'react';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, Megaphone, ClipboardList, Image as ImageIcon, Search, MessageSquare, Share2, FileText, Lightbulb, CalendarDays, Palette } from 'lucide-react';

const accessOptions = [
    { id: 'has_creative_flow_access', label: 'Fluxo Criativo', icon: Share2 },
    { id: 'has_site_builder_access', label: 'Criador de Sites', icon: Globe },
    { id: 'has_ads_access', label: 'ADS Inteligente', icon: Megaphone },
    { id: 'has_strategic_planner_access', label: 'Planejamento Estratégico', icon: ClipboardList },
    { id: 'has_campaign_analyzer_access', label: 'Analisador de Ads', icon: Search },
    { id: 'has_image_generator_access', label: 'Gerador de Imagem', icon: ImageIcon },
    { id: 'has_neurodesign_access', label: 'NeuroDesign', icon: Palette },
    { id: 'has_ai_chat_access', label: 'Chat IA', icon: MessageSquare },
    { id: 'has_transcriber_access', label: 'Transcritor de Vídeo', icon: FileText },
    { id: 'has_trending_topics_access', label: 'Assuntos em Alta', icon: Lightbulb },
    { id: 'has_keyword_planner_access', label: 'Planejador de Palavras-chave', icon: Search },
    { id: 'has_publication_calendar_access', label: 'Calendário de Publicação', icon: CalendarDays },
];

const PlanFormDialog = ({
  onSubmit,
  editingPlan,
  formData,
  setFormData,
  modules,
  aiModels,
  onOpenChange,
}) => {
  const handleSubmitInternal = (e) => {
    e.preventDefault();
    onSubmit(e);
  };

  const handleModuleChange = (moduleId) => {
    const stringModuleId = moduleId.toString();
    setFormData(prev => {
      const newModuleIds = prev.module_ids.includes(stringModuleId)
        ? prev.module_ids.filter(id => id !== stringModuleId)
        : [...prev.module_ids, stringModuleId];
      return { ...prev, module_ids: newModuleIds };
    });
  };

  const handleImageModelChange = (modelId) => {
    const stringModelId = modelId.toString();
    setFormData(prev => {
      const newAllowedModelIds = prev.plan_image_generation_config.allowed_model_ids.includes(stringModelId)
        ? prev.plan_image_generation_config.allowed_model_ids.filter(id => id !== stringModelId)
        : [...prev.plan_image_generation_config.allowed_model_ids, stringModelId];
      return {
        ...prev,
        plan_image_generation_config: {
          ...prev.plan_image_generation_config,
          allowed_model_ids: newAllowedModelIds,
        },
      };
    });
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{editingPlan ? 'Editar Plano' : 'Criar Novo Plano'}</DialogTitle>
        <DialogDescription>
          {editingPlan ? 'Atualize as informações e módulos do plano' : 'Preencha os dados e selecione os módulos do novo plano'}
        </DialogDescription>
      </DialogHeader>
      
      <form onSubmit={handleSubmitInternal} className="space-y-4 max-h-[80vh] overflow-y-auto pr-4">
        <div>
          <Label htmlFor="name">Nome do Plano</Label>
          <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
        </div>
        <div>
          <Label htmlFor="description">Descrição</Label>
          <Textarea id="description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="price">Preço (R$)</Label>
            <Input id="price" type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} required />
          </div>
          <div>
            <Label htmlFor="max_users">Máx. Usuários</Label>
            <Input id="max_users" type="number" value={formData.max_users} onChange={(e) => setFormData({...formData, max_users: e.target.value})} required />
          </div>
          <div>
            <Label htmlFor="duration">Duração (dias)</Label>
            <Input id="duration" type="number" value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} required />
          </div>
          <div>
            <Label htmlFor="limite_execucoes_dia">Limite Diário</Label>
            <Input id="limite_execucoes_dia" type="number" value={formData.limite_execucoes_dia} onChange={(e) => setFormData({...formData, limite_execucoes_dia: e.target.value})} required />
          </div>
        </div>
        <div>
          <Label>Módulos de Conteúdo Inclusos</Label>
          <div className="space-y-2 p-3 rounded-md border max-h-48 overflow-y-auto">
              {modules.map(module => (
                  <div key={module.id} className="flex items-center space-x-2">
                     <Checkbox
                          id={`module-${module.id}`}
                          checked={formData.module_ids.includes(module.id.toString())}
                          onCheckedChange={() => handleModuleChange(module.id)}
                      />
                      <Label htmlFor={`module-${module.id}`} className="font-normal">{module.name}</Label>
                  </div>
              ))}
          </div>
        </div>
        <div>
          <Label>Suíte de Ferramentas</Label>
          <div className="space-y-2 p-3 rounded-md border max-h-48 overflow-y-auto">
              {accessOptions.map(opt => (
                <div key={opt.id} className="flex items-center space-x-2">
                    <Checkbox
                        id={opt.id}
                        checked={formData[opt.id]}
                        onCheckedChange={(checked) => setFormData({ ...formData, [opt.id]: !!checked })}
                    />
                    <Label htmlFor={opt.id} className="font-normal flex items-center gap-2">
                        <opt.icon className="w-4 h-4" /> {opt.label}
                    </Label>
                </div>
              ))}
          </div>
        </div>
        {formData.has_image_generator_access && (
          <div>
            <Label>Configurações de Geração de Imagem</Label>
            <div className="space-y-2 p-3 rounded-md border">
                <div>
                    <Label htmlFor="max_size">Tamanho Máximo (px)</Label>
                    <Select
                        value={formData.plan_image_generation_config.max_size.toString()}
                        onValueChange={(value) => setFormData(prev => ({
                            ...prev,
                            plan_image_generation_config: { ...prev.plan_image_generation_config, max_size: parseInt(value) }
                        }))}
                    >
                        <SelectTrigger id="max_size"><SelectValue placeholder="Selecione o tamanho máximo" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="512">512x512</SelectItem>
                            <SelectItem value="1024">1024x1024</SelectItem>
                            <SelectItem value="2048">2048x2048</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="max_images_per_job">Máx. Imagens por Geração</Label>
                    <Input
                        id="max_images_per_job"
                        type="number"
                        value={formData.plan_image_generation_config.max_images_per_job}
                        onChange={(e) => setFormData(prev => ({
                            ...prev,
                            plan_image_generation_config: { ...prev.plan_image_generation_config, max_images_per_job: parseInt(e.target.value) }
                        }))}
                        min="1"
                        max="4"
                    />
                </div>
                <div>
                    <Label htmlFor="creative_flow_limit">Máx. Fluxos Criativos por Usuário</Label>
                    <Input
                        id="creative_flow_limit"
                        type="number"
                        value={formData.plan_image_generation_config.creative_flow_limit ?? 3}
                        onChange={(e) => setFormData(prev => ({
                            ...prev,
                            plan_image_generation_config: {
                              ...prev.plan_image_generation_config,
                              creative_flow_limit: Math.max(1, parseInt(e.target.value || '3', 10))
                            }
                        }))}
                        min="1"
                    />
                </div>
                <div>
                    <Label htmlFor="cost_markup_percentage">Markup de Custo (%)</Label>
                    <Input
                        id="cost_markup_percentage"
                        type="number"
                        value={formData.plan_image_generation_config.cost_markup_percentage}
                        onChange={(e) => setFormData(prev => ({
                            ...prev,
                            plan_image_generation_config: { ...prev.plan_image_generation_config, cost_markup_percentage: parseInt(e.target.value) }
                        }))}
                        min="0"
                    />
                </div>
                <div>
                    <Label>Modelos de Imagem Permitidos</Label>
                    <div className="space-y-2 p-3 rounded-md border max-h-48 overflow-y-auto">
                        {aiModels.map(model => (
                            <div key={model.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`image-model-${model.id}`}
                                    checked={formData.plan_image_generation_config.allowed_model_ids.includes(model.id.toString())}
                                    onCheckedChange={() => handleImageModelChange(model.id)}
                                />
                                <Label htmlFor={`image-model-${model.id}`} className="font-normal">{model.model_name}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit">{editingPlan ? 'Atualizar' : 'Criar'} Plano</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default PlanFormDialog;