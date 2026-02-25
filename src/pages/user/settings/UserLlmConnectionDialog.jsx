import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/customSupabaseClient';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';

const textProviderOptions = ['OpenAI', 'OpenRouter', 'Google'];

const UserLlmConnectionDialog = ({ isOpen, setIsOpen, editingConnection, onFinished }) => {
  const { user } = useAuth();
  const [showApiKey, setShowApiKey] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState([]);
  const [googleModels, setGoogleModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingGoogleModels, setIsLoadingGoogleModels] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    provider: 'OpenAI',
    api_key: '',
    api_url: '',
    default_model: '',
  });

  const debouncedApiKey = useDebounce(formData.api_key, 500);

  const resetForm = () => {
    setFormData({
      name: '',
      provider: 'OpenAI',
      api_key: '',
      api_url: 'https://api.openai.com/v1',
      default_model: 'gpt-4o-mini',
    });
    setShowApiKey(false);
    setOpenRouterModels([]);
    setGoogleModels([]);
    setIsLoadingModels(false);
    setIsLoadingGoogleModels(false);
  };

  const fetchOpenRouterModels = useCallback(async (apiKey) => {
    if (!apiKey) return;
    setIsLoadingModels(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-openrouter-models', {
        body: { apiKey },
      });

      if (error) {
        throw new Error(error.message);
      }
      
      const sortedModels = data.models.sort((a, b) => a.name.localeCompare(b.name));
      setOpenRouterModels(sortedModels);
    } catch (error) {
      toast.error('Falha ao buscar modelos da OpenRouter', { description: 'Verifique se sua chave de API está correta e tente novamente.' });
      setOpenRouterModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  const fetchGoogleModels = useCallback(async (apiKey) => {
    if (!apiKey) return;
    setIsLoadingGoogleModels(true);
    setGoogleModels([]);
    try {
      const { data, error } = await supabase.functions.invoke('get-google-models', {
        body: { apiKey },
      });

      if (error) {
        throw new Error(error.message);
      }

      const list = data?.models ?? (Array.isArray(data) ? data : []);
      const raw = Array.isArray(list) ? list : [];
      const textModels = raw
        .filter((m) => {
          const name = (m?.name ?? m?.baseModelId ?? '').toLowerCase();
          return name.includes('gemini') && !name.includes('imagen');
        })
        .map((m) => ({
          id: m?.name ?? m?.baseModelId ?? '',
          name: m?.displayName || m?.name || m?.baseModelId || '',
        }))
        .filter((m) => m.id);
      const sorted = textModels.slice().sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
      setGoogleModels(sorted);
    } catch (err) {
      toast.error('Falha ao buscar modelos da API Google', { description: 'Verifique se sua chave de API está correta e tente novamente.' });
      setGoogleModels([]);
    } finally {
      setIsLoadingGoogleModels(false);
    }
  }, []);

  useEffect(() => {
    if (formData.provider === 'OpenRouter' && debouncedApiKey) {
      fetchOpenRouterModels(debouncedApiKey);
    } else {
      setOpenRouterModels([]);
    }
  }, [formData.provider, debouncedApiKey, fetchOpenRouterModels]);

  useEffect(() => {
    if (formData.provider === 'Google' && debouncedApiKey) {
      fetchGoogleModels(debouncedApiKey);
    } else {
      setGoogleModels([]);
    }
  }, [formData.provider, debouncedApiKey, fetchGoogleModels]);

  const defaultApiUrlForProvider = (provider) => {
    if (provider === 'Google') return 'https://generativelanguage.googleapis.com';
    if (provider === 'OpenRouter') return 'https://openrouter.ai/api/v1';
    if (provider === 'OpenAI') return 'https://api.openai.com/v1';
    return '';
  };

  useEffect(() => {
    if (isOpen) {
        if (editingConnection) {
          const provider = editingConnection.provider || 'OpenAI';
          const rawApiUrl = editingConnection.api_url || '';
          setFormData({
            name: editingConnection.name || '',
            provider,
            api_key: editingConnection.api_key || '',
            api_url: rawApiUrl.trim() || defaultApiUrlForProvider(provider),
            default_model: editingConnection.default_model || '',
          });
        } else {
          resetForm();
        }
    }
  }, [editingConnection, isOpen]);

  const handleProviderChange = (value) => {
    const newFormData = { ...formData, provider: value, default_model: '' };
    if (value === 'OpenRouter') {
      newFormData.api_url = 'https://openrouter.ai/api/v1';
    } else if (value === 'OpenAI') {
      newFormData.api_url = 'https://api.openai.com/v1';
      newFormData.default_model = 'gpt-4o-mini';
    } else if (value === 'Google') {
      newFormData.api_url = 'https://generativelanguage.googleapis.com';
      newFormData.default_model = '';
    } else {
      newFormData.api_url = '';
    }
    setFormData(newFormData);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user || !formData.name || !formData.api_key || !formData.default_model) {
      toast.error("Campos obrigatórios", { description: "Por favor, preencha nome, chave de API e modelo padrão." });
      return;
    }

    const apiUrlToSave = (formData.api_url || '').trim() || defaultApiUrlForProvider(formData.provider);
    const dataToSave = {
      user_id: user.id,
      name: formData.name,
      provider: formData.provider,
      api_key: formData.api_key,
      api_url: apiUrlToSave,
      default_model: formData.default_model,
      capabilities: { "text_generation": true, "image_generation": false, "site_builder": false },
      is_active: false,
    };

    let error;
    if (editingConnection) {
      ({ error } = await supabase.from('user_ai_connections').update(dataToSave).eq('id', editingConnection.id));
    } else {
      ({ error } = await supabase.from('user_ai_connections').insert([dataToSave]));
    }

    if (error) {
      toast.error(`Erro ao ${editingConnection ? 'atualizar' : 'criar'} conexão`, { description: error.message });
    } else {
      toast.success(`Conexão ${editingConnection ? 'atualizada' : 'criada'}!`);
      onFinished();
      setIsOpen(false);
    }
  };

  const renderModelInput = () => {
    if (formData.provider === 'OpenRouter') {
      return (
        <div className="relative">
          <Select
            onValueChange={(value) => setFormData({ ...formData, default_model: value })}
            value={formData.default_model}
            disabled={isLoadingModels || openRouterModels.length === 0}
          >
            <SelectTrigger id="llm-conn-default_model" className="w-full glass-effect border-white/20">
              <SelectValue placeholder={isLoadingModels ? "Carregando modelos..." : "Selecione um modelo"} />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 text-white border-white/20 max-h-60">
              {openRouterModels.map(model => (
                <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLoadingModels && <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
        </div>
      );
    }

    if (formData.provider === 'Google') {
      return (
        <div className="relative">
          <Select
            onValueChange={(value) => setFormData({ ...formData, default_model: value })}
            value={formData.default_model}
            disabled={isLoadingGoogleModels || googleModels.length === 0}
          >
            <SelectTrigger id="llm-conn-default_model" className="w-full glass-effect border-white/20">
              <SelectValue placeholder={isLoadingGoogleModels ? "Carregando modelos..." : googleModels.length === 0 ? "Nenhum modelo encontrado" : "Selecione um modelo"} />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 text-white border-white/20 max-h-60">
              {googleModels.map(model => (
                <SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLoadingGoogleModels && <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
        </div>
      );
    }

    return (
        <Input 
          id="llm-conn-default_model" 
          value={formData.default_model} 
          onChange={(e) => setFormData({ ...formData, default_model: e.target.value })} 
          placeholder="Ex: gpt-4o-mini" 
          className="glass-effect border-white/20" 
          required
        />
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsOpen(open); }}>
      <DialogContent className="glass-effect border-white/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{editingConnection ? 'Editar Conexão de LLM' : 'Nova Conexão de LLM'}</DialogTitle>
          <DialogDescription className="text-gray-400">{editingConnection ? 'Atualize os dados da conexão' : 'Adicione uma nova chave de API para LLMs'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="llm-conn-name">Nome da Conexão</Label>
            <Input id="llm-conn-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Meu OpenAI Pessoal" className="glass-effect border-white/20" required />
          </div>
          <div>
            <Label htmlFor="llm-conn-provider">Provedor</Label>
            <Select onValueChange={handleProviderChange} value={formData.provider}>
              <SelectTrigger id="llm-conn-provider" className="w-full glass-effect border-white/20">
                <SelectValue placeholder="Selecione um provedor" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-white/20">
                {textProviderOptions.map(provider => (<SelectItem key={provider} value={provider}>{provider}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="llm-conn-api_key">Chave da API (API Key)</Label>
            <div className="relative">
              <Input id="llm-conn-api_key" type={showApiKey ? 'text' : 'password'} value={formData.api_key} onChange={(e) => setFormData({ ...formData, api_key: e.target.value })} className="glass-effect border-white/20 pr-10" required />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-gray-400 hover:text-white" onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            {(formData.provider === 'OpenRouter' || formData.provider === 'Google') && <p className="text-xs text-muted-foreground mt-1">A lista de modelos será carregada após inserir uma chave válida.</p>}
          </div>
           <div>
            <Label htmlFor="llm-conn-default_model">Modelo Padrão</Label>
            {renderModelInput()}
          </div>
          {formData.provider !== 'OpenRouter' && (
            <div>
              <Label htmlFor="llm-conn-api_url">URL Base da API</Label>
              <Input id="llm-conn-api_url" value={formData.api_url} onChange={(e) => setFormData({ ...formData, api_url: e.target.value })} placeholder="Preenchido automaticamente" className="glass-effect border-white/20" />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">{editingConnection ? 'Atualizar' : 'Salvar'} Conexão</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserLlmConnectionDialog;