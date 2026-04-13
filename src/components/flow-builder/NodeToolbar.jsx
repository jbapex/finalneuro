import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Bot, MessageSquare, FileSearch, Paintbrush, Youtube, SearchCode, Globe, BookOpen, FileText, LayoutGrid, ImageIcon, Palette, Type, User } from 'lucide-react';
import { motion } from 'framer-motion';

const NodeToolbar = ({ addNode, isLoadingData }) => {
    const nodeGroups = [
        {
            title: 'Nós de Dados',
            nodes: [
                { type: 'client', label: 'Adicionar Cliente', icon: Users },
                { type: 'context', label: 'Adicionar Contexto', icon: FileText, iconColor: 'text-violet-500' },
                { type: 'knowledge', label: 'Fonte de Conhecimento', icon: BookOpen, iconColor: 'text-yellow-500' },
            ]
        },
        {
            title: 'Agentes de IA',
            nodes: [
                { type: 'agent', label: 'Adicionar Agente', icon: Bot },
                { type: 'chat', label: 'Adicionar Chat com IA', icon: MessageSquare },
            ]
        },
        {
            title: 'Suporte ao Neuro Design',
            nodes: [
                { type: 'reference_image', label: 'Imagem de referência', icon: ImageIcon, iconColor: 'text-amber-500' },
                { type: 'image_logo', label: 'Imagem para logo', icon: ImageIcon, iconColor: 'text-sky-500' },
                { type: 'colors', label: 'Cores', icon: Palette, iconColor: 'text-rose-500' },
                { type: 'styles', label: 'Estilos', icon: Type, iconColor: 'text-emerald-500' },
                { type: 'subject', label: 'Sujeito principal', icon: User, iconColor: 'text-indigo-500' },
            ]
        },
        {
            title: 'Ferramentas Avançadas',
            nodes: [
                { type: 'analysis', label: 'Análise', icon: FileSearch },
                { type: 'image_generator', label: 'Gerador de Imagem', icon: Paintbrush },
                { type: 'carousel', label: 'Adicionar Carrossel', icon: LayoutGrid, iconColor: 'text-amber-500' },
                { type: 'video_transcriber', label: 'Transcritor de Vídeo', icon: Youtube, iconColor: 'text-red-500' },
                { type: 'page_analyzer', label: 'Analisador de Página', icon: SearchCode, iconColor: 'text-cyan-500' },
                { type: 'site_creator', label: 'Criador de Site', icon: Globe, iconColor: 'text-green-500' },
            ]
        }
    ];

    return (
        <div className="h-full w-full overflow-y-auto">
            <div className="p-4">
                <h2 className="text-xl font-bold mb-6">Ferramentas</h2>
                <div className="space-y-4">
                    {nodeGroups.map((group) => (
                        <motion.div key={group.title} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Card className="hover:shadow-lg transition-shadow">
                                <CardHeader className="pb-2"><CardTitle className="text-lg">{group.title}</CardTitle></CardHeader>
                                <CardContent className="flex flex-col space-y-2">
                                    {group.nodes.map((node) => (
                                        <Button 
                                            key={node.type}
                                            onClick={() => addNode(node.type, node.label.replace('Adicionar ', ''))} 
                                            variant="outline" 
                                            className="justify-start" 
                                            disabled={isLoadingData}
                                        >
                                            <node.icon className={`mr-2 h-4 w-4 ${node.iconColor || ''}`} /> {node.label}
                                        </Button>
                                    ))}
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default NodeToolbar;