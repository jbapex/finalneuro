import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Download, Sparkles, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import RefineImageForm from '@/components/neurodesign/RefineImageForm';

const isDemoPlaceholder = (url) => url && typeof url === 'string' && url.includes('placehold.co');

const NeuralNetworkCanvas = ({ isActive }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    
    // Configuration
    const particleCount = isActive ? 80 : 35; // Mais partículas quando ativo
    const connectionDistance = isActive ? 120 : 80;
    const speedMultiplier = isActive ? 2.5 : 0.2; // Bem mais rápido quando ativo
    
    // Use a fixed purple color to ensure it renders correctly and matches the theme
    const getColor = (opacity) => `rgba(139, 92, 246, ${opacity})`;

    // Resize canvas
    const resize = () => {
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * speedMultiplier,
        vy: (Math.random() - 0.5) * speedMultiplier,
        radius: Math.random() * 1.5 + (isActive ? 2.5 : 1.5), // Larger points
        pulseOffset: Math.random() * Math.PI * 2 // Para fazer o brilho pulsar
      });
    }

    // Animation loop
    let time = 0;
    const draw = () => {
      time += 0.05;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw connections first (underneath points)
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            const opacity = 1 - (distance / connectionDistance);
            
            // Adiciona um efeito de pulso nas conexões quando ativo
            const pulse = isActive ? (Math.sin(time + p.pulseOffset) * 0.5 + 0.5) : 1;
            const finalOpacity = isActive ? opacity * 0.6 * pulse : opacity * 0.2;
            
            ctx.strokeStyle = getColor(finalOpacity);
            ctx.lineWidth = isActive ? (1 + pulse * 0.5) : 0.5;
            ctx.stroke();
          }
        }
      }

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        // Movimento mais caótico/orgânico quando ativo
        if (isActive && Math.random() < 0.02) {
            p.vx += (Math.random() - 0.5) * 0.5;
            p.vy += (Math.random() - 0.5) * 0.5;
            
            // Limitar velocidade máxima
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed > speedMultiplier * 1.5) {
                p.vx = (p.vx / speed) * speedMultiplier;
                p.vy = (p.vy / speed) * speedMultiplier;
            }
        }

        p.x += p.vx;
        p.y += p.vy;

        // Bounce off walls smoothly
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        
        // Efeito de brilho pulsante nos nós quando ativo
        const nodePulse = isActive ? (Math.sin(time * 2 + p.pulseOffset) * 0.2 + 0.8) : 0.6;
        ctx.fillStyle = getColor(isActive ? nodePulse : 0.6);
        ctx.shadowBlur = isActive ? 12 * nodePulse : 0;
        ctx.shadowColor = getColor(0.9);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow for lines
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isActive]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

const PreviewPanel = ({ project, user, selectedImage, images, isGenerating, isRefining, onRefine, onDownload, onSelectImage, hasImageConnection = true }) => {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  const imageUrl = selectedImage?.url || selectedImage?.thumbnail_url;
  const isLoading = isGenerating || isRefining;
  const showDemoNotice = !isLoading && imageUrl && isDemoPlaceholder(imageUrl);

  return (
    <div className="flex flex-col h-full p-4 sm:p-6 min-h-0 max-w-[900px] xl:max-w-[1000px] mx-auto w-full">
      <div className="flex-1 min-h-0 max-h-[70vh] rounded-lg border border-border bg-muted/50 flex items-center justify-center overflow-hidden">
        {isLoading && (
          <div className="flex flex-col items-center gap-6 text-muted-foreground text-center px-6 w-full h-full justify-center">
            <div className="relative w-full max-w-[350px] aspect-square flex items-center justify-center">
              <NeuralNetworkCanvas isActive={true} />
              
              {/* Intense Core Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/30 via-primary/10 to-transparent rounded-full animate-pulse blur-2xl pointer-events-none" style={{ animationDuration: '1.5s' }}></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-primary/40 rounded-full blur-xl animate-ping pointer-events-none" style={{ animationDuration: '2s' }}></div>
            </div>
            <div className="space-y-1 mt-4 relative z-10 bg-background/50 backdrop-blur-sm p-4 rounded-xl border border-border/50">
              <p className="font-medium text-lg text-foreground animate-pulse">{isRefining ? 'Refinando arte...' : 'Gerando arte...'}</p>
              <p className="text-sm text-muted-foreground">A rede neural está processando sua solicitação.</p>
            </div>
          </div>
        )}
        {!isLoading && !imageUrl && (
          <div className="flex flex-col items-center gap-4 text-muted-foreground text-center px-6 w-full h-full justify-center">
            <div className="relative w-full max-w-[250px] aspect-square flex items-center justify-center">
              <NeuralNetworkCanvas isActive={false} />
              
              {/* Soft Core Glow */}
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-primary/5 to-transparent rounded-full animate-pulse blur-2xl pointer-events-none" style={{ animationDuration: '4s' }}></div>
            </div>
            <div className="space-y-1 mt-4 relative z-10 bg-background/50 backdrop-blur-sm p-4 rounded-xl border border-border/50">
              <p className="font-medium text-lg text-foreground">Aguardando criação</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">Configure o builder à esquerda e clique em &quot;Gerar Imagem&quot; para iniciar a rede neural.</p>
            </div>
          </div>
        )}
        {!isLoading && imageUrl && (
          <div className="w-full h-full flex flex-col p-4 overflow-y-auto min-h-0">
            <RefineImageForm
              imageUrl={imageUrl}
              projectId={project?.id}
              user={user}
              onRefine={onRefine}
              disabled={isRefining}
              hasImageConnection={hasImageConnection}
              renderPreviewActions={() => (
                <>
                  <Button size="sm" variant="secondary" onClick={() => setFullscreenOpen(true)}>
                    <Maximize2 className="h-4 w-4 mr-1" /> Tela cheia
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onDownload?.(imageUrl)}>
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                </>
              )}
            />
            {showDemoNotice && (
              <div className="mt-3 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-700 dark:text-amber-200 text-sm text-center max-w-md">
                Modo demonstração: imagem de exemplo. Selecione uma conexão de imagem (ex.: OpenRouter) no builder para gerar imagens reais.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Criações desta galeria */}
      {images.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border min-w-0 flex-shrink-0">
          <p className="text-xs text-muted-foreground font-medium mb-2">Criações desta galeria</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.slice(0, 5).map((img) => {
              const url = img.url || img.thumbnail_url;
              const isSelected = selectedImage?.id === img.id;
              return (
                <div
                  key={img.id}
                  className={cn(
                    'w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all bg-muted/50',
                    isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                  )}
                >
                  <button
                    type="button"
                    className="relative block w-full h-full focus:outline-none focus:ring-0"
                    onClick={() => onSelectImage?.(img)}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity bg-foreground/40 flex items-center justify-center">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); onDownload?.(url); }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal tela cheia para a arte gerada */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent
          className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 gap-0 border-0 bg-background/95 dark:bg-black/95 overflow-hidden [&>button]:hidden"
          onPointerDownOutside={() => setFullscreenOpen(false)}
          onEscapeKeyDown={() => setFullscreenOpen(false)}
        >
          <button
            type="button"
            onClick={() => setFullscreenOpen(false)}
            className="absolute top-4 right-4 z-50 rounded-full bg-foreground/80 p-2 text-background hover:bg-foreground transition-colors"
            aria-label="Fechar tela cheia"
          >
            <X className="h-6 w-6" />
          </button>
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Arte em tela cheia"
              className="max-w-[95vw] max-h-[95vh] w-auto h-auto object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PreviewPanel;
