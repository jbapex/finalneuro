import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Youtube, Clipboard, Check, UploadCloud, Eye } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { v4 as uuidv4 } from 'uuid';
import ContentViewModal from '@/components/flow-builder/modals/ContentViewModal';
import { FlowNodeHeaderDelete } from '@/components/flow-builder/FlowNodeHeaderDelete';

function sanitizeFilename(filename) {
  const extension = filename.split('.').pop();
  const nameWithoutExtension = filename.substring(0, filename.lastIndexOf('.'));
  
  const sanitized = nameWithoutExtension
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .substring(0, 50);

  return `${sanitized}.${extension}`;
}

const VideoTranscriberNode = memo(({ id, data, selected }) => {
  const { onUpdateNodeData, output, mediaLibraryId: initialMediaId } = data;
  const { toast } = useToast();
  const [videoUrl, setVideoUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  const subscriptionRef = useRef(null);
  const progressIntervalRef = useRef(null);
  
  const mediaLibraryId = output?.id || initialMediaId;
  const transcript = output?.data?.transcript_text || '';

  const cleanup = useCallback(() => {
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setIsProcessing(false);
    setProcessingStatus('');
    setProgress(0);
  }, []);

  const setupSubscription = useCallback((mediaId) => {
      if (subscriptionRef.current) {
          supabase.removeChannel(subscriptionRef.current);
      }
      subscriptionRef.current = supabase
          .channel(`media-library-update:${id}:${mediaId}`)
          .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'media_library',
              filter: `id=eq.${mediaId}`
          }, (payload) => {
              const updatedMedia = payload.new;
              if (updatedMedia.status === 'completed' || updatedMedia.status === 'failed') {
                  onUpdateNodeData(id, { output: { id: updatedMedia.id, data: updatedMedia } });
                  if(updatedMedia.status === 'completed') {
                      toast({ title: 'Transcrição Concluída!' });
                  } else {
                      toast({ title: 'Erro na Transcrição', description: updatedMedia.error_message || 'A transcrição falhou.', variant: 'destructive' });
                  }
                  cleanup();
              }
          })
          .subscribe();
  }, [id, onUpdateNodeData, toast, cleanup]);

  useEffect(() => {
    if (isProcessing) return;

    const checkExistingMedia = async () => {
        if (!mediaLibraryId) return;

        const { data: media, error } = await supabase
            .from('media_library')
            .select('status, error_message, transcript_text, title')
            .eq('id', mediaLibraryId)
            .single();

        if (error) {
          console.error("Erro ao verificar mídia existente:", error);
          return;
        }

        if (media.status === 'processing') {
            setIsProcessing(true);
            setProcessingStatus('Transcrição em andamento...');
            setProgress(50);
            setupSubscription(mediaLibraryId);
        } else if (media.status === 'completed' && media.transcript_text) {
            onUpdateNodeData(id, { output: { id: mediaLibraryId, data: media } });
        }
    };

    checkExistingMedia();
  }, [mediaLibraryId, isProcessing, id, onUpdateNodeData, setupSubscription]);

  const startProgressSimulation = (durationSeconds) => {
    const estimatedTime = Math.max(30, durationSeconds * 0.2) * 1000;
    let elapsedTime = 0;

    progressIntervalRef.current = setInterval(() => {
      elapsedTime += 100;
      const currentProgress = Math.min(95, (elapsedTime / estimatedTime) * 100);
      setProgress(currentProgress);
    }, 100);
  };
  
  const processTranscription = async (mediaId, durationSeconds = 180) => {
    setIsProcessing(true);
    setProcessingStatus('Iniciando transcrição...');
    startProgressSimulation(durationSeconds);

    onUpdateNodeData(id, { mediaLibraryId: mediaId });
    setupSubscription(mediaId);

    try {
      const { error } = await supabase.functions.invoke('video-transcriber', {
        body: { media_id: mediaId },
      });
      if (error) throw new Error(error.message);
      setProcessingStatus('Processando áudio e transcrevendo...');
    } catch (error) {
      toast({ title: 'Erro ao Iniciar Transcrição', description: error.message, variant: 'destructive' });
      cleanup();
    }
  };

  const handleTranscribeUrl = async () => {
    if (!videoUrl) return toast({ title: 'URL ausente', description: 'Por favor, insira a URL de um vídeo.' });
    setIsProcessing(true);
    setProcessingStatus('Obtendo dados do vídeo...');
    setProgress(5);
    try {
      const { data: meta, error: metaError } = await supabase.functions.invoke('get-video-metadata', { body: { video_url: videoUrl } });
      if (metaError) throw metaError;

      setProcessingStatus('Salvando na biblioteca...');
      setProgress(10);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const { data: media, error: insertError } = await supabase
        .from('media_library').insert({
          user_id: user.id,
          video_url: videoUrl,
          platform: 'youtube/instagram',
          title: meta.title,
          thumbnail_url: meta.thumbnail,
          status: 'pending'
        }).select().single();
      if (insertError) throw insertError;
      
      const durationParts = meta.duration_string.split(':').map(Number);
      const durationSeconds = durationParts.reduce((acc, time) => (acc * 60) + time, 0);

      await processTranscription(media.id, durationSeconds);
    } catch (error) {
      toast({ title: 'Erro ao processar URL', description: error.message, variant: 'destructive' });
      cleanup();
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingStatus('Enviando arquivo...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado.');

      const sanitizedName = sanitizeFilename(file.name);
      const fileName = `${user.id}/${uuidv4()}-${sanitizedName}`;

      const { error: uploadError } = await supabase.storage.from('media_uploads').upload(fileName, file, {
        onProgress: ({ loaded, total }) => {
          const percentage = Math.round((loaded / total) * 100);
          setProgress(percentage * 0.5);
        }
      });
      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);

      setProcessingStatus('Salvando na biblioteca...');
      const { data: newMedia, error: insertError } = await supabase.from('media_library').insert({
        user_id: user.id,
        title: file.name,
        platform: 'upload',
        storage_path: fileName,
        video_url: null,
        status: 'pending'
      }).select().single();
      if (insertError) throw new Error(`Erro ao salvar na biblioteca: ${insertError.message}`);

      toast({ title: 'Upload concluído!', description: 'Iniciando a transcrição.' });
      
      const audio = new Audio(URL.createObjectURL(file));
      audio.onloadedmetadata = () => {
        processTranscription(newMedia.id, audio.duration);
      };
      audio.onerror = () => {
         processTranscription(newMedia.id);
      };

    } catch (error) {
      toast({ title: 'Erro na transcrição do arquivo', description: error.message, variant: 'destructive' });
      cleanup();
    } finally {
      event.target.value = '';
    }
  };

  const handleCopy = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript);
      setCopied(true);
      toast({ title: 'Copiado!', description: 'Transcrição copiada.' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleView = () => {
    setIsModalOpen(true);
  };

  const handleRefineNotImplemented = () => {
    toast({
      title: "🚧 Funcionalidade em desenvolvimento!",
      description: "Esta funcionalidade ainda não está implementada—mas não se preocupe! Você pode solicitá-la no seu próximo prompt! 🚀",
    });
  };

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return (
    <Card className="w-80 border-2 border-red-500/50 shadow-lg">
      <Handle type="target" position={Position.Left} className="!bg-red-500" />
      <CardHeader className="flex flex-row items-center gap-2 p-3 bg-red-500/10 min-w-0">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Youtube className="w-5 h-5 shrink-0 text-red-500" />
          <CardTitle className="text-base truncate">Transcritor de Vídeo</CardTitle>
        </div>
        <FlowNodeHeaderDelete nodeId={id} onRemoveNode={data.onRemoveNode} selected={selected} />
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {!isProcessing && !transcript && (
          <div className="flex items-center space-x-2">
            <Input type="url" placeholder="URL ou envie um arquivo" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} disabled={isProcessing} className="nodrag" />
            <Button onClick={() => fileInputRef.current?.click()} size="icon" variant="outline" disabled={isProcessing}><UploadCloud className="h-4 w-4" /></Button>
            <input type="file" ref={fileInputRef} className="hidden" accept="video/*,audio/*" onChange={handleFileUpload} />
            <Button onClick={handleTranscribeUrl} disabled={isProcessing || !videoUrl} size="sm">Ir</Button>
          </div>
        )}
        {isProcessing && (
          <div className="space-y-2 text-center">
              <Progress value={progress} className="w-full h-2" />
              <p className="text-xs text-muted-foreground">{processingStatus}</p>
          </div>
        )}
        <div className="relative">
          <ScrollArea className="h-40 w-full rounded-md border p-2 bg-muted nodrag">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {isProcessing && !transcript ? 'Aguardando transcrição...' : (transcript || 'A transcrição aparecerá aqui...')}
            </p>
          </ScrollArea>
          {transcript && (
            <div className="absolute top-1 right-1 flex space-x-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleView}>
                <Eye className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
      <Handle type="source" position={Position.Right} className="!bg-red-500" />
      <ContentViewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Transcrição do Vídeo"
        content={transcript}
        onRefineClick={handleRefineNotImplemented}
      />
    </Card>
  );
});

export default VideoTranscriberNode;