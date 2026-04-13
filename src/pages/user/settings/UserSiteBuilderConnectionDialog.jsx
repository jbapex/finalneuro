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
import {
  compareOpenRouterLlmModels,
  isOpenRouterTextChatModel,
  normalizeOpenRouterModelsList,
  toOpenRouterIdNameList,
} from '@/lib/openRouterModels';

const siteBuilderProviderOptions = ['OpenAI', 'OpenRouter', 'Google'];

const UserSiteBuilderConnectionDialog = ({ isOpen, setIsOpen, editingConnection, onFinished }) => {
  const { user } = useAuth();
  const [showApiKey, setShowApiKey] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState([]);
  const [googleModels, setGoogleModels] = useState([]);
  const [openaiModels, setOpenaiModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingGoogleModels, setIsLoadingGoogleModels] = useState(false);
  const [isLoadingOpenAIModels, setIsLoadingOpenAIModels] = useState(false);
  const [openRouterSearch, setOpenRouterSearch] = useState('');
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
      default_model: '',
    });
    setShowApiKey(false);
    setOpenRouterModels([]);
    setGoogleModels([]);
    setOpenaiModels([]);
    setIsLoadingModels(false);
    setIsLoadingGoogleModels(false);
    setIsLoadingOpenAIModels(false);
    setOpenRouterSearch('');
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
      
      const list = normalizeOpenRouterModelsList(data).filter(isOpenRouterTextChatModel);
      const normalized = toOpenRouterIdNameList(list).sort(compareOpenRouterLlmModels);
      setOpenRouterModels(normalized);
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
      const { data, error } = await supabase.functions.invoke('get-google-models', { body: { apiKey } });
      if (error) throw new Error(error?.message || error);
      const list = data?.models ?? (Array.isArray(data) ? data : []);
      const raw = Array.isArray(list) ? list : [];
      const textModels = raw.filter((m) => {
        const name = (m?.name ?? m?.baseModelId ?? '').toLowerCase();
        return name.includes('gemini') && !name.includes('imagen');
      });
      const normalized = textModels.map((m) => {
        const id = m?.name ?? m?.baseModelId ?? '';
        const label = m?.displayName || id || '';
        return { id, name: label };
      });
      setGoogleModels(normalized.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    } catch (err) {
      toast.error('Falha ao buscar modelos Google', { description: 'Verifique a chave da API e tente novamente.' });
      setGoogleModels([]);
    } finally {
      setIsLoadingGoogleModels(false);
    }
  }, []);

  const fetchOpenAIModels = useCallback(async (apiKey) => {
    if (!apiKey) return;
    setIsLoadingOpenAIModels(true);
    setOpenaiModels([]);
    try {
      const { data, error } = await supabase.functions.invoke('get-openai-models', { body: { apiKey } });
      if (error) throw new Error(error.message);
      const list = data?.models ?? (Array.isArray(data) ? data : []);
      const normalized = Array.isArray(list) ? list.filter((m) => m?.id) : [];
      setOpenaiModels(normalized.sort((a, b) => (a.name || a.id || '').localeCompare(b.name || b.id || '')));
    } catch (err) {
      toast.error('Falha ao buscar modelos OpenAI', { description: 'Verifique a chave da API e tente novamente.' });
      setOpenaiModels([]);
    } finally {
      setIsLoadingOpenAIModels(false);
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

  useEffect(() => {
    if (formData.provider === 'OpenAI' && debouncedApiKey) {
      fetchOpenAIModels(debouncedApiKey);
    } else {
      setOpenaiModels([]);
    }
  }, [formData.provider, debouncedApiKey, fetchOpenAIModels]);


  useEffect(() => {
    if (isOpen) {
        if (editingConnection) {
          setFormData({
            name: editingConnection.name || '',
            provider: editingConnection.provider || 'OpenAI',
            api_key: editingConnection.api_key || '',
            api_url: editingConnection.api_url || '',
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
    } else if (value === 'Google') {
      newFormData.api_url = 'https://generativelanguage.googleapis.com';
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

    const dataToSave = {
      user_id: user.id,
      name: formData.name,
      provider: formData.provider,
      api_key: formData.api_key,
      api_url: formData.api_url,
      default_model: formData.default_model,
      capabilities: { "site_builder": true, "text_generation": false, "image_generation": false },
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

  const openRouterModelsFiltered =
    openRouterSearch.trim()
      ? openRouterModels.filter((m) => {
          const q = openRouterSearch.trim().toLowerCase();
          return (
            (m.id && m.id.toLowerCase().includes(q)) ||
            (m.name && String(m.name).toLowerCase().includes(q))
          );
        })
      : openRouterModels;

  const renderModelInput = () => {
    if (formData.provider === 'OpenRouter') {
      return (
        <div className="relative">
          <Select
            onValueChange={(value) => setFormData({ ...formData, default_model: value })}
            value={formData.default_model}
            disabled={isLoadingModels || openRouterModels.length === 0}
          >
            <SelectTrigger id="sb-conn-default_model" className="w-full glass-effect border-white/20">
              <SelectValue placeholder={isLoadingModels ? "Carregando modelos..." : openRouterModels.length === 0 ? "Informe a chave da API para carregar os modelos" : "Selecione um modelo"} />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 text-white border-white/20 max-h-[min(24rem,70vh)]">
              {openRouterModelsFiltered.map(model => (
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
            <SelectTrigger id="sb-conn-default_model" className="w-full glass-effect border-white/20">
              <SelectValue placeholder={isLoadingGoogleModels ? "Carregando modelos..." : googleModels.length === 0 ? "Informe a chave da API para carregar os modelos" : "Selecione um modelo"} />
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

    if (formData.provider === 'OpenAI') {
      return (
        <div className="relative">
          <Select
            onValueChange={(value) => setFormData({ ...formData, default_model: value })}
            value={formData.default_model}
            disabled={isLoadingOpenAIModels || openaiModels.length === 0}
          >
            <SelectTrigger id="sb-conn-default_model" className="w-full glass-effect border-white/20">
              <SelectValue placeholder={isLoadingOpenAIModels ? "Carregando modelos..." : openaiModels.length === 0 ? "Informe a chave da API para carregar os modelos" : "Selecione um modelo"} />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 text-white border-white/20 max-h-60">
              {openaiModels.map(model => (
                <SelectItem key={model.id} value={model.id}>{model.name || model.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLoadingOpenAIModels && <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsOpen(open); }}>
      <DialogContent className="glass-effect border-white/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{editingConnection ? 'Editar Conexão do Criador de Site' : 'Nova Conexão para Criador de Site'}</DialogTitle>
          <DialogDescription className="text-gray-400">{editingConnection ? 'Atualize os dados da conexão' : 'Adicione uma chave de API para o assistente'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="sb-conn-name">Nome da Conexão</Label>
            <Input id="sb-conn-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Meu Criador de Sites" className="glass-effect border-white/20" required />
          </div>
          <div>
            <Label htmlFor="sb-conn-provider">Provedor</Label>
            <Select onValueChange={handleProviderChange} value={formData.provider}>
              <SelectTrigger id="sb-conn-provider" className="w-full glass-effect border-white/20">
                <SelectValue placeholder="Selecione um provedor" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-white/20">
                {siteBuilderProviderOptions.map(provider => (<SelectItem key={provider} value={provider}>{provider}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="sb-conn-api_key">Chave da API (API Key)</Label>
            <div className="relative">
              <Input id="sb-conn-api_key" type={showApiKey ? 'text' : 'password'} value={formData.api_key} onChange={(e) => setFormData({ ...formData, api_key: e.target.value })} className="glass-effect border-white/20 pr-10" required />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-gray-400 hover:text-white" onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">A lista de modelos será carregada após inserir uma chave válida.</p>
          </div>
          {formData.provider === 'OpenRouter' && openRouterModels.length > 0 && (
            <div>
              <Label htmlFor="sb-or-search">Buscar modelo</Label>
              <Input
                id="sb-or-search"
                value={openRouterSearch}
                onChange={(e) => setOpenRouterSearch(e.target.value)}
                placeholder="Ex.: free, llama…"
                className="glass-effect border-white/20"
              />
            </div>
          )}
           <div>
            <Label htmlFor="sb-conn-default_model">Modelo Padrão</Label>
            {renderModelInput()}
          </div>
          {formData.provider !== 'OpenRouter' && (
            <div>
              <Label htmlFor="sb-conn-api_url">URL Base da API</Label>
              <Input id="sb-conn-api_url" value={formData.api_url} onChange={(e) => setFormData({ ...formData, api_url: e.target.value })} placeholder="Preenchido automaticamente" className="glass-effect border-white/20" />
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

export default UserSiteBuilderConnectionDialog;