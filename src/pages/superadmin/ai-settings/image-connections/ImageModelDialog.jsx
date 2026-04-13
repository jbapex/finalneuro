import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';

const ImageModelDialog = ({ isOpen, setIsOpen, editingModel, connection, onFinished }) => {
  const [formData, setFormData] = useState({
    model_name: '',
    capabilities: { image: true },
    pricing: {},
    status: 'active'
  });
  const [openRouterModels, setOpenRouterModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    const fetchOpenRouterImageModels = async () => {
      if (connection?.provider === 'OpenRouter') {
        setIsLoadingModels(true);
        setOpenRouterModels([]);
        try {
          const apiKey = connection?.api_key?.trim?.() ?? '';
          if (!apiKey) {
            setOpenRouterModels([]);
            setIsLoadingModels(false);
            return;
          }
          const { data, error } = await supabase.functions.invoke('get-openrouter-models', {
            body: { apiKey },
          });
          if (error) throw error;
          const list = data?.models ?? data?.data ?? (Array.isArray(data) ? data : []);
          const imageModels = list.filter((m) =>
            m?.architecture?.output_modalities?.includes?.('image')
          );
          const sorted = imageModels.slice().sort((a, b) => (a.name || a.id || '').localeCompare(b.name || b.id || ''));
          setOpenRouterModels(sorted);
        } catch (error) {
          toast({
            title: "Erro ao buscar modelos de imagem",
            description: "Não foi possível carregar a lista de modelos do OpenRouter.",
            variant: "destructive",
          });
        } finally {
          setIsLoadingModels(false);
        }
      } else {
        setOpenRouterModels([]);
      }
    };

    if (isOpen && connection) {
      fetchOpenRouterImageModels();
    }
  }, [isOpen, connection?.id, connection?.provider, connection?.api_key]);

  useEffect(() => {
    if (editingModel) {
      setFormData({
        model_name: editingModel.model_name || '',
        capabilities: editingModel.capabilities || { image: true },
        pricing: editingModel.pricing || {},
        status: editingModel.status || 'active'
      });
    } else {
      resetForm();
    }
  }, [editingModel, isOpen]);

  const resetForm = () => {
    setFormData({
      model_name: '',
      capabilities: { image: true },
      pricing: {},
      status: 'active'
    });
    setOpenRouterModels([]);
    setIsLoadingModels(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.model_name || !connection?.id) {
      toast({ title: "Campos obrigatórios", description: "Por favor, preencha o nome do modelo.", variant: "destructive" });
      return;
    }

    const dataToSave = {
      ai_connection_id: connection.id,
      model_name: formData.model_name,
      capabilities: formData.capabilities,
      pricing: formData.pricing,
      status: formData.status
    };

    let error;
    if (editingModel) {
      ({ error } = await supabase.from('ai_models').update(dataToSave).eq('id', editingModel.id));
    } else {
      ({ error } = await supabase.from('ai_models').insert([dataToSave]));
    }

    if (error) {
      toast({ title: `Erro ao ${editingModel ? 'atualizar' : 'criar'} modelo`, description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Modelo ${editingModel ? 'atualizado' : 'criado'}!`, description: "O modelo foi salvo com sucesso." });
      onFinished();
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsOpen(open); }}>
      <DialogContent className="glass-effect border-white/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{editingModel ? 'Editar Modelo de Imagem' : 'Novo Modelo de Imagem'}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {editingModel ? `Atualize o modelo para ${connection?.name}` : `Adicione um novo modelo para ${connection?.name}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="model-name">Nome do Modelo</Label>
            {connection?.provider === 'OpenRouter' ? (
              <Select
                onValueChange={(value) => setFormData({ ...formData, model_name: value })}
                value={formData.model_name}
                disabled={isLoadingModels || openRouterModels.length === 0}
              >
                <SelectTrigger id="model-name" className="w-full glass-effect border-white/20 text-white">
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
                    <SelectItem key={model.id} value={model.id}>{model.name} ({model.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id="model-name" value={formData.model_name} onChange={(e) => setFormData({ ...formData, model_name: e.target.value })} placeholder="Ex: dall-e-3" className="glass-effect border-white/20 text-white" required />
            )}
          </div>
          <div>
            <Label htmlFor="model-pricing">Preço por Resolução (JSON)</Label>
            <Textarea id="model-pricing" value={JSON.stringify(formData.pricing, null, 2)} onChange={(e) => { try { setFormData({ ...formData, pricing: JSON.parse(e.target.value) }); } catch (err) { /* ignore */ } }} placeholder='{"resolution_1024": 0.04}' className="glass-effect border-white/20 text-white" />
            <p className="text-xs text-gray-400 mt-1">Ex: {"{\"resolution_512\": 0.02, \"resolution_1024\": 0.04}"}</p>
          </div>
          <div>
            <Label htmlFor="model-status">Status</Label>
            <Select onValueChange={(value) => setFormData({ ...formData, status: value })} value={formData.status}>
              <SelectTrigger id="model-status" className="w-full glass-effect border-white/20 text-white">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 text-white border-white/20">
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancelar</Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">{editingModel ? 'Atualizar' : 'Salvar'} Modelo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ImageModelDialog;