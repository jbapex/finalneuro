import React, { memo, useCallback, useRef, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Upload, Loader2, X } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNeuroDesignProject } from '@/hooks/useNeuroDesignProject';
import { useToast } from '@/components/ui/use-toast';
import { uploadNeuroDesignFile } from '@/lib/neurodesignStorage';

const SubjectNode = memo(({ data, id, selected }) => {
  const { onUpdateNodeData } = data;
  const subject_gender = data.subject_gender ?? '';
  const subject_description = data.subject_description ?? '';
  const subject_image_urls = Array.isArray(data.subject_image_urls) ? data.subject_image_urls : [];
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const fileInputRef0 = useRef(null);
  const fileInputRef1 = useRef(null);
  const { user } = useAuth();
  const { getOrCreateProject } = useNeuroDesignProject();
  const { toast } = useToast();

  const updateOutput = useCallback(
    (next) => {
      if (!onUpdateNodeData) return;
      const urls = next.subject_image_urls != null ? next.subject_image_urls.filter((u) => typeof u === 'string' && u.trim()).slice(0, 2) : subject_image_urls;
      const payload = {
        subject_gender: next.subject_gender !== undefined ? next.subject_gender : subject_gender,
        subject_description: next.subject_description !== undefined ? next.subject_description : subject_description,
        subject_image_urls: urls,
      };
      const hasAny = payload.subject_gender || (payload.subject_description && payload.subject_description.trim()) || payload.subject_image_urls.length > 0;
      onUpdateNodeData(id, {
        ...payload,
        output: hasAny ? { id, data: payload } : null,
      });
    },
    [id, onUpdateNodeData, subject_gender, subject_description, subject_image_urls]
  );

  const setSubjectImageUrl = useCallback(
    (index, url) => {
      const next = [...subject_image_urls];
      next[index] = url || '';
      updateOutput({ subject_image_urls: next.filter(Boolean) });
    },
    [subject_image_urls, updateOutput]
  );

  const handleFileChange = useCallback(
    async (index, e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      if (!user) {
        toast({ title: 'Faça login', variant: 'destructive' });
        return;
      }
      const proj = await getOrCreateProject();
      if (!proj) return;
      setUploadingIndex(index);
      try {
        const publicUrl = await uploadNeuroDesignFile(user.id, proj.id, 'subject', file);
        setSubjectImageUrl(index, publicUrl);
        toast({ title: 'Foto enviada', description: 'Use este nó conectado ao gerador.' });
      } catch (err) {
        toast({ title: 'Erro ao enviar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
      } finally {
        setUploadingIndex(null);
        const ref = index === 0 ? fileInputRef0.current : fileInputRef1.current;
        if (ref) ref.value = '';
      }
    },
    [user, getOrCreateProject, setSubjectImageUrl, toast]
  );

  const handleRemove = useCallback(
    (index) => {
      setSubjectImageUrl(index, '');
    },
    [setSubjectImageUrl]
  );

  return (
    <Card className="w-64 border-2 border-indigo-500/50 shadow-lg">
      <CardHeader className="flex flex-row items-center gap-2 p-3 bg-indigo-500/10 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <User className="w-5 h-5 shrink-0 text-indigo-500" />
          <CardTitle className="text-base truncate">Sujeito principal</CardTitle>
        </div>
        <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        <div className="space-y-1">
          <Label className="text-xs">Gênero</Label>
          <Select
            value={subject_gender || 'none'}
            onValueChange={(v) => updateOutput({ subject_gender: v === 'none' ? '' : v })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="feminino">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Descrição</Label>
          <Textarea
            value={subject_description}
            onChange={(e) => updateOutput({ subject_description: e.target.value })}
            placeholder="Ex.: homem 30 anos, cabelo escuro..."
            className="min-h-[48px] text-sm resize-y"
            rows={2}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fotos do rosto (até 2)</Label>
          {[0, 1].map((idx) => {
            const url = subject_image_urls[idx];
            return (
              <div key={idx} className="space-y-1">
                <input
                  ref={idx === 0 ? fileInputRef0 : fileInputRef1}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => handleFileChange(idx, e)}
                />
                {url ? (
                  <div className="relative rounded-md border border-border overflow-hidden bg-muted">
                    <img src={url} alt={`Rosto ${idx + 1}`} className="w-full h-20 object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => handleRemove(idx)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={uploadingIndex !== null}
                    onClick={() => (idx === 0 ? fileInputRef0.current : fileInputRef1.current)?.click()}
                  >
                    {uploadingIndex === idx ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                    {uploadingIndex === idx ? 'Enviando...' : `Enviar foto ${idx + 1}`}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-indigo-500" />
    </Card>
  );
});

export default SubjectNode;
