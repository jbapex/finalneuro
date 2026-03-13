import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { ArrowRight, Bot, FileText, BarChart2, Clapperboard, Share2, PenSquare, MessagesSquare, Lightbulb, Search, CalendarDays, Globe, Lock, Palette, Church } from 'lucide-react';
import { cn } from '@/lib/utils';

const allTools = [
    { 
        title: 'Gerador de Conteúdo', 
        description: 'Crie textos, roteiros e ideias com agentes de IA especializados.', 
        icon: <Bot className="h-8 w-8 text-primary" />,
        path: '/ferramentas/gerador-de-conteudo',
        permissionKey: null,
    },
    { 
        title: 'Fluxo Criativo', 
        description: 'Construa e automatize seus processos de marketing com um editor visual.', 
        icon: <Share2 className="h-8 w-8 text-primary" />,
        path: '/fluxo-criativo',
        permissionKey: 'creative_flow',
    },
    { 
        title: 'Criador de Anúncios', 
        description: 'Gere anúncios de alta performance para plataformas como Meta Ads.', 
        icon: <Clapperboard className="h-8 w-8 text-primary" />,
        path: '/ferramentas/criador-de-anuncios',
        permissionKey: 'ads',
    },
    { 
        title: 'Criador de Site', 
        description: 'Construa landing pages de alta conversão com nosso editor IA.', 
        icon: <Globe className="h-8 w-8 text-primary" />,
        path: '/ferramentas/criador-de-site',
        permissionKey: 'site_builder',
    },
    { 
        title: 'NeuroDesign', 
        description: 'Design Builder premium: crie imagens com sujeito, cenário, texto e controle total de composição.', 
        icon: <Palette className="h-8 w-8 text-primary" />,
        path: '/ferramentas/neurodesign',
        permissionKey: null,
        highlight: true,
    },
    {
        title: 'Artes de Culto',
        description: 'Crie artes para igrejas: tema principal, pregador, cantores e rodapé fixo.',
        icon: <Church className="h-8 w-8 text-primary" />,
        path: '/ferramentas/artes-culto',
        permissionKey: null,
    },
    { 
        title: 'Analisador de Campanha', 
        description: 'Importe relatórios e receba análises e otimizações de IA.', 
        icon: <BarChart2 className="h-8 w-8 text-primary" />,
        path: '/ferramentas/analisador-campanha',
        permissionKey: 'campaign_analyzer',
    },
    { 
        title: 'Planejador Estratégico', 
        description: 'Crie planejamentos de marketing completos com ajuda da IA.', 
        icon: <PenSquare className="h-8 w-8 text-primary" />,
        path: '/ferramentas/planejamento',
        permissionKey: 'strategic_planner',
    },
    { 
        title: 'Chat com IA', 
        description: 'Converse com um assistente de marketing para tirar dúvidas e ter ideias.', 
        icon: <MessagesSquare className="h-8 w-8 text-primary" />,
        path: '/chat-ia',
        permissionKey: 'ai_chat',
    },
    {
        title: 'Calendário de Publicação',
        description: 'Organize e agende suas postagens com ganchos gerados por IA.',
        icon: <CalendarDays className="h-8 w-8 text-primary" />,
        path: '/clientes',
        permissionKey: 'publication_calendar',
    },
];

const ToolCard = ({ tool, isAllowed }) => {
    const { toast } = useToast();
    const navigate = useNavigate();

    const handleClick = (e) => {
        if (!isAllowed) {
            e.preventDefault();
            toast({
                title: 'Acesso Restrito',
                description: `A ferramenta "${tool.title}" não está disponível no seu plano. Considere fazer um upgrade!`,
                variant: 'destructive',
            });
        } else {
            navigate(tool.path);
        }
    };

    return (
        <div 
            onClick={handleClick}
            className={cn(
                "group relative h-full rounded-xl transition-all duration-300",
                isAllowed ? "cursor-pointer" : "cursor-not-allowed",
                tool.highlight && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background shadow-[0_0_30px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_40px_hsl(var(--primary)/0.5)]"
            )}
        >
            {tool.highlight && (
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-400 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-500 animate-pulse"></div>
            )}
            <Card className={cn(
                "h-full transition-all duration-300 ease-in-out relative bg-card",
                isAllowed ? "hover:scale-[1.02]" : "bg-muted/50 opacity-70",
                tool.highlight && "border-primary/50"
            )}>
                {!isAllowed && (
                    <div className="absolute top-3 right-3 bg-secondary p-2 rounded-full z-10 border">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                    </div>
                )}
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex items-center space-x-4">
                        {tool.icon}
                        <CardTitle className="text-lg font-semibold">{tool.title}</CardTitle>
                    </div>
                    {isAllowed && <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />}
                </CardHeader>
                <CardDescription className="p-6 pt-0">{tool.description}</CardDescription>
            </Card>
        </div>
    );
};


const ToolsPage = () => {
    const { hasPermission } = useAuth();

    return (
        <>
            <Helmet>
                <title>Ferramentas - Neuro Ápice</title>
                <meta name="description" content="Explore a suíte de ferramentas de marketing com IA para otimizar suas campanhas." />
            </Helmet>
            <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">Suíte de Ferramentas</h1>
                    <p className="text-muted-foreground mt-2">Potencialize seu marketing com nossa coleção de ferramentas inteligentes.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allTools.map((tool) => (
                        <ToolCard key={tool.title} tool={tool} isAllowed={hasPermission(tool.permissionKey)} />
                    ))}
                </div>
            </div>
        </>
    );
};

export default ToolsPage;