import React, { memo, useCallback, useRef, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ImageIcon, Upload, Loader2, X } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNeuroDesignProject } from '@/hooks/useNeuroDesignProject';
import { useToast } from '@/components/ui/use-toast';
import { uploadNeuroDesignFile } from '@/lib/neurodesignStorage';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';

const ImageLogoNode = memo(({ data, id, selected }) => {
  const { onUpdateNodeData } = data;
  const logoUrl = data.logo_url ?? '';
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const { user } = useAuth();
  const { getOrCreateProject } = useNeuroDesignProject();
  const { toast } = useToast();

  const setOutput = useCallback(
    (url) => {
      if (!onUpdateNodeData) return;
      onUpdateNodeData(id, {
        logo_url: url,
        output: url ? { id, data: { logo_url: url } } : null,
      });
    },
    [id, onUpdateNodeData]
  );

  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      if (!user) {
        toast({ title: 'Faça login', variant: 'destructive' });
        return;
      }
      const proj = await getOrCreateProject();
      if (!proj) return;
      setUploading(true);
      try {
        const publicUrl = await uploadNeuroDesignFile(user.id, proj.id, 'logo', file);
        setOutput(publicUrl);
        toast({ title: 'Logo enviada', description: 'Conecte este nó ao gerador para usar na arte.' });
      } catch (err) {
        toast({ title: 'Erro ao enviar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [user, getOrCreateProject, setOutput, toast]
  );

  const handleRemove = useCallback(() => setOutput(''), [setOutput]);

  return (
    <Card className="w-64 border-2 border-sky-500/50 shadow-lg">
      <CardHeader className="flex flex-row items-center gap-2 p-3 bg-sky-500/10 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ImageIcon className="w-5 h-5 shrink-0 text-sky-500" />
          <CardTitle className="text-base truncate">Imagem para logo</CardTitle>
        </div>
        <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="space-y-1">
          <Label className="text-xs">Enviar logo</Label>
          {logoUrl ? (
            <div className="relative rounded-md border border-border overflow-hidden bg-muted">
              <img src={logoUrl} alt="Logo" className="w-full h-28 object-contain bg-background" />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={handleRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {uploading ? 'Enviando...' : 'Escolher imagem da logo'}
            </Button>
          )}
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-sky-500" />
    </Card>
  );
});

export default ImageLogoNode;
