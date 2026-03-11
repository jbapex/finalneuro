import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Modal do banco de imagens do Site Builder.
 * Lista imagens do projeto (tabela site_project_images) e permite upload.
 * - Modo substituir: ao selecionar, chama onImageSelect({ signedUrl, alt_text }).
 * - Modo inserir: insertMode=true, sectionId e onImageSelectInsert(image, sectionId); ao selecionar chama onImageSelectInsert.
 */
const ImageBankModal = ({
  isOpen,
  onClose,
  projectId,
  onImageSelect,
  insertMode = false,
  sectionId = null,
  onImageSelectInsert,
}) => {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchImages = useCallback(async () => {
    if (!projectId || !isOpen) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('site_project_images')
      .select('id, image_url, alt_text, created_at')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar imagens', description: error.message, variant: 'destructive' });
      setImages([]);
    } else {
      setImages(data || []);
    }
    setIsLoading(false);
  }, [projectId, isOpen, toast]);

  useEffect(() => {
    if (isOpen && projectId) fetchImages();
  }, [isOpen, projectId, fetchImages]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user || !projectId) return;
    setIsUploading(true);
    let success = 0;
    for (const file of files) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/site_projects/${projectId}/${uuidv4()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('image_bank')
        .upload(path, file, { upsert: false });
      if (uploadError) {
        toast({ title: `Erro ao enviar ${file.name}`, description: uploadError.message, variant: 'destructive' });
        continue;
      }
      const { data: { publicUrl } } = supabase.storage.from('image_bank').getPublicUrl(path);
      const { error: insertError } = await supabase
        .from('site_project_images')
        .insert({
          project_id: projectId,
          user_id: user.id,
          image_url: publicUrl,
          alt_text: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || '',
        });
      if (insertError) {
        toast({ title: `Erro ao salvar ${file.name}`, description: insertError.message, variant: 'destructive' });
      } else {
        success++;
      }
    }
    setIsUploading(false);
    e.target.value = '';
    if (success > 0) {
      toast({ title: 'Upload concluído', description: `${success} imagem(ns) adicionada(s).` });
      fetchImages();
    }
  };

  const handleSelect = (row) => {
    const image = { signedUrl: row.image_url, alt_text: row.alt_text || '' };
    if (insertMode && onImageSelectInsert && sectionId) {
      onImageSelectInsert(image, sectionId);
      onClose();
      return;
    }
    onImageSelect?.(image);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{insertMode ? 'Inserir imagem na seção' : 'Banco de imagens'}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {insertMode
            ? 'Escolha uma imagem para inserir na seção selecionada. Você pode enviar novas imagens abaixo.'
            : 'Clique em uma imagem para usá-la no site. Você pode enviar novas imagens abaixo.'}
        </p>
        <div className="flex items-center gap-2 border rounded-md p-2 bg-muted/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading || !user}
            onClick={() => document.getElementById('site-bank-upload').click()}
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Enviar imagem
          </Button>
          <input
            id="site-bank-upload"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
        <div className="flex-1 min-h-0 overflow-auto border rounded-md p-3 bg-muted/20">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma imagem no projeto. Envie imagens para usar aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  className="relative aspect-square rounded-lg border-2 border-transparent hover:border-primary overflow-hidden bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                  onClick={() => handleSelect(img)}
                >
                  <img
                    src={img.image_url}
                    alt={img.alt_text || 'Imagem'}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageBankModal;
