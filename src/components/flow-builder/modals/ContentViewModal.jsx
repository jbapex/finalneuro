import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Copy, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import ReactMarkdown from 'react-markdown';

const ContentViewModal = ({ isOpen, onClose, title, content, onRefineClick }) => {
    const { toast } = useToast();

    const handleCopy = () => {
        navigator.clipboard.writeText(content);
        toast({
            title: "Copiado!",
            description: "O conteúdo foi copiado para a área de transferência.",
        });
    };

    const handleRefine = () => {
        onClose();
        onRefineClick?.();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[60vw] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Visualize, copie ou refine o conteúdo gerado pelo agente de IA.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow relative min-h-0">
                    <ScrollArea className="h-full w-full rounded-md border p-4">
                         <ReactMarkdown className="prose dark:prose-invert max-w-none text-left">{content}</ReactMarkdown>
                    </ScrollArea>
                </div>
                <div className="flex justify-end pt-4 gap-2">
                    <Button variant="outline" onClick={handleRefine}>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Refinar com IA
                    </Button>
                    <Button onClick={handleCopy}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar Conteúdo
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ContentViewModal;