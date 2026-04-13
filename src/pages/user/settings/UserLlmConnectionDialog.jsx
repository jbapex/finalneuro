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

const llmProviderOptions = ['OpenAI', 'OpenRouter', 'Google'];

const getDefaultApiUrl = (provider) => {
  if (provider === 'OpenAI') return 'https://api.openai.com/v1';
  if (provider === 'OpenRouter') return 'https://openrouter.ai/api/v1';
  if (provider === 'Google') return 'https://generativelanguage.googleapis.com';
  return '';
};

const UserLlmConnectionDialog = ({ isOpen, setIsOpen, editingConnection, onFinished }) => {
  const { user } = useAuth();
  const [showApiKey, setShowApiKey] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState([]);
  const [googleModels, setGoogleModels] = useState([]);
  const [openaiModels, setOpenaiModels] = useState([]);
  const [isLoadingOpenRouter, setIsLoadingOpenRouter] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);
  const [isLoadingOpenAI, setIsLoadingOpenAI] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    provider: 'OpenRouter',
    api_key: '',
    api_url: getDefaultApiUrl('OpenRouter'),
    default_model: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [openRouterSearch, setOpenRouterSearch] = useState('');

  const debouncedApiKey = useDebounce(formData.api_key, 500);

  const fetchOpenRouterModels = useCallback(async (apiKey) => {
    if (!apiKey) return;
    setIsLoadingOpenRouter(true);
    setOpenRouterModels([]);
    try {
      const { data, error } = await supabase.functions.invoke('get-openrouter-models', { body: { apiKey } });
      if (error) throw new Error(error.message);
      const list = normalizeOpenRouterModelsList(data).filter(isOpenRouterTextChatModel);
      const normalized = toOpenRouterIdNameList(list).sort(compareOpenRouterLlmModels);
      setOpenRouterModels(normalized);
    } catch (err) {
      toast.error('Falha ao buscar modelos OpenRouter', { description: 'Verifique a chave da API e tente novamente.' });
      setOpenRouterModels([]);
    } finally {
      setIsLoadingOpenRouter(false);
    }
  }, []);

  const fetchGoogleModels = useCallback(async (apiKey) => {
    if (!apiKey) return;
    setIsLoadingGoogle(true);
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
      setIsLoadingGoogle(false);
    }
  }, []);

  const fetchOpenAIModels = useCallback(async (apiKey) => {
    if (!apiKey) return;
    setIsLoadingOpenAI(true);
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
      setIsLoadingOpenAI(false);
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
        const prov = editingConnection.provider || 'OpenRouter';
        setFormData({
          name: editingConnection.name ?? '',
          provider: prov,
          api_key: editingConnection.api_key ?? '',
          api_url: editingConnection.api_url || getDefaultApiUrl(prov),
          default_model: editingConnection.default_model ?? '',
        });
      } else {
        setFormData({
          name: '',
          provider: 'OpenRouter',
          api_key: '',
          api_url: getDefaultApiUrl('OpenRouter'),
          default_model: '',
        });
      }
      setShowApiKey(false);
      setOpenRouterSearch('');
    }
  }, [editingConnection, isOpen]);

  const handleProviderChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      provider: value,
      api_url: getDefaultApiUrl(value),
      default_model: '',
    }));
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!user) return;
    if (!formData.name?.trim() || !formData.api_key?.trim()) {
      toast.error('Campos obrigatórios', { description: 'Preencha o nome e a chave da API.' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: formData.name.trim(),
        provider: formData.provider,
        api_key: formData.api_key,
        api_url: formData.api_url || null,
        default_model: formData.default_model || null,
        capabilities: { text_generation: true },
      };
      if (editingConnection?.id) {
        const { error } = await supabase.from('user_ai_connections').update(payload).eq('id', editingConnection.id);
        if (error) throw error;
        toast.success('Conexão atualizada');
      } else {
        const { error } = await supabase.from('user_ai_connections').insert(payload);
        if (error) throw error;
        toast.success('Conexão criada');
      }
      setIsOpen(false);
      onFinished?.();
    } catch (e) {
      toast.error(e?.message ?? 'Erro ao salvar');
    } finally {
      setIsSaving(false);
    }
  };

  const openRouterModelsFiltered =
    formData.provider === 'OpenRouter' && openRouterSearch.trim()
      ? openRouterModels.filter((m) => {
          const q = openRouterSearch.trim().toLowerCase();
          return (
            (m.id && m.id.toLowerCase().includes(q)) ||
            (m.name && String(m.name).toLowerCase().includes(q))
          );
        })
      : openRouterModels;

  const currentModels =
    formData.provider === 'OpenRouter'
      ? openRouterModelsFiltered
      : formData.provider === 'Google'
        ? googleModels
        : openaiModels;
  const isLoadingModels =
    formData.provider === 'OpenRouter'
      ? isLoadingOpenRouter
      : formData.provider === 'Google'
        ? isLoadingGoogle
        : isLoadingOpenAI;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingConnection ? 'Editar' : 'Nova'} conexão LLM</DialogTitle>
          <DialogDescription>Configure uma conexão para geração de texto (Chat de IA). Selecione o provedor e informe a API Key; os modelos serão carregados automaticamente.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="llm-name">Nome</Label>
            <Input
              id="llm-name"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="Ex: Minha OpenAI"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="llm-provider">Provedor</Label>
            <Select value={formData.provider || ''} onValueChange={handleProviderChange}>
              <SelectTrigger id="llm-provider">
                <SelectValue placeholder="Selecione um provedor" />
              </SelectTrigger>
              <SelectContent>
                {llmProviderOptions.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="llm-api_key">Chave da API (API Key)</Label>
            <div className="relative">
              <Input
                id="llm-api_key"
                type={showApiKey ? 'text' : 'password'}
                value={formData.api_key}
                onChange={(e) => setFormData((p) => ({ ...p, api_key: e.target.value }))}
                placeholder="sk-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">A lista de modelos será carregada após inserir uma chave válida.</p>
          </div>
          {formData.provider === 'OpenRouter' && openRouterModels.length > 0 && (
            <div className="grid gap-2">
              <Label htmlFor="llm-or-search">Buscar modelo</Label>
              <Input
                id="llm-or-search"
                value={openRouterSearch}
                onChange={(e) => setOpenRouterSearch(e.target.value)}
                placeholder="Ex.: free, llama, gemma…"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Modelos gratuitos OpenRouter costumam ter <code className="text-xs">:free</code> no ID ou o roteador{' '}
                <code className="text-xs">openrouter/free</code>; aparecem no topo da lista.
              </p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="llm-model">Modelo padrão</Label>
            <Select
              value={formData.default_model || ''}
              onValueChange={(value) => setFormData((p) => ({ ...p, default_model: value }))}
              disabled={isLoadingModels}
            >
              <SelectTrigger id="llm-model">
                {isLoadingModels ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando modelos...
                  </span>
                ) : currentModels.length === 0 ? (
                  <SelectValue placeholder="Informe a chave da API para carregar os modelos" />
                ) : (
                  <SelectValue placeholder="Selecione um modelo" />
                )}
              </SelectTrigger>
              <SelectContent className="max-h-[min(24rem,70vh)]">
                {currentModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name || m.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserLlmConnectionDialog;
