import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Bot, Key, Eye, EyeOff, Loader2, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useDebounce } from '@/hooks/use-debounce';
import {
  compareOpenRouterLlmModels,
  isOpenRouterTextChatModel,
  normalizeOpenRouterModelsList,
  toOpenRouterIdNameList,
} from '@/lib/openRouterModels';

const providerOptions = ['OpenAI', 'Groq', 'Mistral', 'OpenRouter', 'Claude', 'Gemini', 'Grok'];

const ConnectionsTab = () => {
  const [integrations, setIntegrations] = useState([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    provider: 'OpenAI',
    api_key: '',
    default_model: 'gpt-4o',
    api_url: ''
  });
  const debouncedApiKey = useDebounce(formData.api_key, 500);

  const fetchIntegrations = useCallback(async () => {
    const { data, error } = await supabase
      .from('llm_integrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar conexões", description: error.message, variant: "destructive" });
    } else {
      setIntegrations(data);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  useEffect(() => {
    if (editingIntegration) {
      setFormData({
        name: editingIntegration.name || '',
        provider: editingIntegration.provider || 'OpenAI',
        api_key: editingIntegration.api_key || '',
        default_model: editingIntegration.default_model || '',
        api_url: editingIntegration.api_url || ''
      });
    } else {
       setFormData({
        name: '',
        provider: 'OpenAI',
        api_key: '',
        default_model: 'gpt-4o',
        api_url: 'https://api.openai.com/v1/chat/completions'
      });
    }
  }, [editingIntegration, isDialogOpen]);

  useEffect(() => {
    const fetchOpenRouterModels = async () => {
      if (formData.provider !== 'OpenRouter') {
        setOpenRouterModels([]);
        return;
      }
      if (!debouncedApiKey?.trim()) {
        setOpenRouterModels([]);
        setIsLoadingModels(false);
        return;
      }
      setIsLoadingModels(true);
      setOpenRouterModels([]);
      try {
        const { data, error } = await supabase.functions.invoke('get-openrouter-models', {
          body: { apiKey: debouncedApiKey.trim() },
        });
        if (error) throw error;
        const list = normalizeOpenRouterModelsList(data).filter(isOpenRouterTextChatModel);
        setOpenRouterModels(toOpenRouterIdNameList(list).sort(compareOpenRouterLlmModels));
      } catch (error) {
        toast({
          title: "Erro ao buscar modelos",
          description: "Não foi possível carregar a lista de modelos do OpenRouter.",
          variant: "destructive",
        });
        setOpenRouterModels([]);
      } finally {
        setIsLoadingModels(false);
      }
    };

    if (isDialogOpen) {
      fetchOpenRouterModels();
    }
  }, [formData.provider, isDialogOpen, debouncedApiKey]);

  const handleProviderChange = (value) => {
    const newFormData = { ...formData, provider: value, default_model: '' };
    if (value === 'OpenRouter') {
      newFormData.api_url = 'https://openrouter.ai/api/v1/chat/completions';
    } else if (value === 'Groq') {
      newFormData.api_url = 'https://api.groq.com/openai/v1/chat/completions';
      newFormData.default_model = 'llama3-70b-8192';
    } else if (value === 'OpenAI') {
      newFormData.api_url = 'https://api.openai.com/v1/chat/completions';
      newFormData.default_model = 'gpt-4o';
    } else {
      newFormData.api_url = '';
    }
    setFormData(newFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ title: "Campo obrigatório", description: "Por favor, dê um nome à sua conexão.", variant: "destructive" });
      return;
    }

    const integrationData = {
      name: formData.name,
      provider: formData.provider,
      api_key: formData.api_key,
      default_model: formData.default_model,
      api_url: formData.api_url || null,
    };

    if (editingIntegration) {
      const { error } = await supabase.from('llm_integrations').update(integrationData).eq('id', editingIntegration.id);
      if (error) {
        toast({ title: "Erro ao atualizar conexão", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Conexão atualizada!", description: "A configuração foi salva com sucesso." });
        fetchIntegrations();
        resetForm();
      }
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Erro de autenticação", description: "Sua sessão não foi encontrada. Faça login novamente.", variant: "destructive" });
        return;
      }
      
      const { error } = await supabase.from('llm_integrations').insert(integrationData);

      if (error) {
        toast({ title: "Erro ao criar conexão", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Conexão criada!", description: "A configuração foi salva com sucesso." });
        fetchIntegrations();
        resetForm();
      }
    }
  };

  const handleEdit = (integration) => {
    setEditingIntegration(integration);
    setIsDialogOpen(true);
  };

  const handleDelete = async (integrationId) => {
    const { error } = await supabase.from('llm_integrations').delete().eq('id', integrationId);
    if (error) {
      toast({ title: "Erro ao remover conexão", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Conexão removida!", description: "A configuração foi removida com sucesso." });
      fetchIntegrations();
    }
  };

  const handleToggleActive = async (integration, isActive) => {
    const { error } = await supabase
      .from('llm_integrations')
      .update({ is_active: isActive })
      .eq('id', integration.id);

    if (error) {
      toast({ title: `Erro ao ${isActive ? 'ativar' : 'desativar'} conexão`, description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `Conexão ${isActive ? 'ativada' : 'desativada'}!`, description: `A conexão ${integration.name} foi atualizada.` });
      fetchIntegrations();
    }
  };


  const resetForm = () => {
    setFormData({ name: '', provider: 'OpenAI', api_key: '', default_model: 'gpt-4o', api_url: 'https://api.openai.com/v1/chat/completions' });
    setEditingIntegration(null);
    setIsDialogOpen(false);
    setShowApiKey(false);
    setOpenRouterModels([]);
  };

  const maskApiKey = (key) => {
    if (!key) return '';
    return key.slice(0, 4) + '...'.repeat(Math.min(3, key.length - 8)) + key.slice(-4);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <p className="text-muted-foreground mb-4 sm:mb-0">Gerencie as chaves de API para conectar aos provedores de LLM.</p>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setIsDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground glow-effect" onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nova Conexão
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-effect border-white/20 text-white max-w-md">
            <DialogHeader>
              <DialogTitle>{editingIntegration ? 'Editar Conexão' : 'Nova Conexão LLM'}</DialogTitle>
              <DialogDescription className="text-gray-400">{editingIntegration ? 'Atualize os dados da conexão' : 'Preencha os dados da nova conexão'}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Conexão</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Meu GPT-4o, Groq Rápido" className="glass-effect border-white/20 text-white" required />
              </div>
              <div>
                <Label htmlFor="provider">Provedor (LLM)</Label>
                <Select onValueChange={handleProviderChange} value={formData.provider}>
                  <SelectTrigger id="provider" className="w-full glass-effect border-white/20 text-white">
                    <SelectValue placeholder="Selecione um provedor" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-white/20">
                    {providerOptions.map(provider => (<SelectItem key={provider} value={provider}>{provider}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="api_key">Chave da API (API Key)</Label>
                <div className="relative">
                  <Input id="api_key" type={showApiKey ? 'text' : 'password'} value={formData.api_key} onChange={(e) => setFormData({...formData, api_key: e.target.value})} className="glass-effect border-white/20 text-white pr-10" required />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-gray-400 hover:text-white" onClick={() => setShowApiKey(!showApiKey)}>
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="default_model">Modelo Padrão</Label>
                {formData.provider === 'OpenRouter' ? (
                  <Select
                    onValueChange={(value) => setFormData({ ...formData, default_model: value })}
                    value={formData.default_model}
                    disabled={isLoadingModels || !debouncedApiKey?.trim() || openRouterModels.length === 0}
                  >
                    <SelectTrigger id="default_model" className="w-full glass-effect border-white/20 text-white">
                      {isLoadingModels ? (
                        <div className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span>Carregando modelos...</span>
                        </div>
                      ) : (
                        <SelectValue placeholder="Selecione um modelo OpenRouter" />
                      )}
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-white/20 max-h-60">
                      {openRouterModels.map(model => (
                        <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="default_model" value={formData.default_model} onChange={(e) => setFormData({...formData, default_model: e.target.value})} placeholder="ex: gpt-4o, llama3-70b-8192" className="glass-effect border-white/20 text-white" />
                )}
              </div>
              <div>
                <Label htmlFor="api_url">URL da API (Opcional)</Label>
                <Input id="api_url" value={formData.api_url} onChange={(e) => setFormData({...formData, api_url: e.target.value})} placeholder="Para OpenRouter, Groq, etc." className="glass-effect border-white/20 text-white" />
                <p className="text-xs text-gray-400 mt-1">Ex: https://api.groq.com/openai/v1/chat/completions</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={resetForm}>Cancelar</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">{editingIntegration ? 'Atualizar' : 'Salvar'} Conexão</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration, index) => (
          <motion.div key={integration.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: index * 0.1 }}>
            <Card className={`glass-effect border-white/20 card-hover h-full flex flex-col ${integration.is_active ? 'border-primary/50' : 'border-dashed'}`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-gray-700 to-gray-900 rounded-lg flex items-center justify-center"><Bot className="w-6 h-6 text-white" /></div>
                    <div>
                      <CardTitle className="text-foreground">{integration.name}</CardTitle>
                      <CardDescription className="text-muted-foreground">{integration.provider} - {integration.default_model || 'N/A'}</CardDescription>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(integration)} className="text-muted-foreground hover:text-foreground"><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(integration.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-grow flex flex-col justify-between">
                <div>
                  <div className="flex items-center space-x-2"><Key className="w-4 h-4 text-muted-foreground" /><span className="text-sm text-foreground font-mono">{maskApiKey(integration.api_key)}</span></div>
                  {integration.api_url && (<div><p className="text-sm text-muted-foreground mb-1">URL da API:</p><p className="text-sm text-foreground truncate">{integration.api_url}</p></div>)}
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-white/10 pt-4 mt-4">
                  <div className="flex items-center gap-2">
                    {integration.is_active ? <Power className="w-4 h-4 text-green-500" /> : <PowerOff className="w-4 h-4 text-red-500" />}
                    <Label htmlFor={`status-switch-${integration.id}`} className={integration.is_active ? "text-green-500" : "text-red-500"}>
                      {integration.is_active ? 'Ativa' : 'Inativa'}
                    </Label>
                  </div>
                  <Switch
                    id={`status-switch-${integration.id}`}
                    checked={integration.is_active}
                    onCheckedChange={(checked) => handleToggleActive(integration, checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      {integrations.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="text-center py-12">
          <Bot className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Nenhuma conexão LLM</h3>
          <p className="text-muted-foreground mb-6">Comece configurando sua primeira conexão com um modelo de IA</p>
          <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground"><Plus className="w-4 h-4 mr-2" /> Configurar Conexão</Button>
        </motion.div>
      )}
    </div>
  );
};

export default ConnectionsTab;