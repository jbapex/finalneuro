import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Loader2, Trash2, Edit, MoreVertical, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Helmet } from 'react-helmet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FlowsListPage = () => {
  const [flows, setFlows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();

  const getCreativeFlowLimit = useCallback(() => {
    if (profile?.user_type === 'super_admin') return Number.POSITIVE_INFINITY;
    const raw =
      profile?.creative_flow_limit ??
      profile?.plans?.creative_flow_limit ??
      profile?.plan_image_generation_config?.creative_flow_limit ??
      profile?.plans?.plan_image_generation_config?.creative_flow_limit ??
      profile?.max_creative_flows ??
      profile?.plans?.max_creative_flows;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
    return 3;
  }, [profile]);

  const creativeFlowLimit = getCreativeFlowLimit();
  const hasReachedFlowLimit = Number.isFinite(creativeFlowLimit) && flows.length >= creativeFlowLimit;

  const fetchFlows = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('creative_flows')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      toast({
        title: 'Erro ao buscar fluxos',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setFlows(data);
    }
    setIsLoading(false);
  }, [toast, user]);

  useEffect(() => {
    if (user && profile) {
        const hasPlanAccess = profile.plans?.has_creative_flow_access;
        const hasIndividualAccess = profile.has_creative_flow_access;
        const userIsSuperAdmin = profile.user_type === 'super_admin';

        if (!userIsSuperAdmin && !hasPlanAccess && !hasIndividualAccess) {
            toast({ title: "Acesso Negado", description: "Este recurso não está disponível no seu plano.", variant: "destructive"});
            navigate('/ferramentas');
            return;
        }
        fetchFlows();
    }
  }, [fetchFlows, user, profile, navigate, toast]);

  const handleCreateFlow = () => {
    if (hasReachedFlowLimit) {
      toast({
        title: 'Limite de fluxos atingido',
        description: `Seu plano permite até ${creativeFlowLimit} fluxos criativos. Exclua um fluxo ou solicite liberação de mais.`,
        variant: 'destructive',
      });
      return;
    }
    navigate('/fluxo-criativo');
  };
  
  const handleDeleteFlow = async (flowId) => {
    const { error } = await supabase
      .from('creative_flows')
      .delete()
      .eq('id', flowId);

    if (error) {
      toast({
        title: 'Erro ao excluir fluxo',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setFlows(flows.filter(f => f.id !== flowId));
      toast({
        title: 'Fluxo excluído',
        description: 'O fluxo foi removido com sucesso.',
      });
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
    },
  };

  return (
    <>
      <Helmet>
        <title>Meus Fluxos Criativos</title>
        <meta name="description" content="Crie e gerencie seus fluxos criativos de marketing." />
      </Helmet>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meus Fluxos Criativos</h1>
            <p className="text-muted-foreground mt-1">
              Crie e gerencie seus fluxos de trabalho inteligentes.
              {Number.isFinite(creativeFlowLimit) ? ` (${flows.length}/${creativeFlowLimit} usados)` : ''}
            </p>
          </div>
          <Button className="mt-4 sm:mt-0" onClick={handleCreateFlow} disabled={hasReachedFlowLimit}>
            <Plus className="mr-2 h-4 w-4" /> Criar Novo Fluxo
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <AnimatePresence>
            {flows.length > 0 ? (
              <motion.div
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {flows.map((flow) => (
                  <motion.div key={flow.id} variants={itemVariants}>
                    <Card className="h-full flex flex-col hover:shadow-primary/20 hover:shadow-lg transition-shadow duration-300 bg-card text-card-foreground border">
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg font-bold text-card-foreground">{flow.name}</CardTitle>
                            <CardDescription className="text-muted-foreground">
                              Atualizado em: {new Date(flow.updated_at).toLocaleDateString()}
                            </CardDescription>
                          </div>
                           <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/fluxo-criativo/${flow.id}`)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta ação não pode ser desfeita. Isso excluirá permanentemente o fluxo "{flow.name}".
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteFlow(flow.id)} className="bg-destructive hover:bg-destructive/90">
                                      Sim, excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <div className="p-4 pt-0 mt-auto">
                        <Button className="w-full" onClick={() => navigate(`/fluxo-criativo/${flow.id}`)}>
                          <Workflow className="mr-2 h-4 w-4" /> Abrir Fluxo
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16 border-2 border-dashed rounded-lg"
              >
                <Workflow className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Nenhum fluxo criativo encontrado</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Comece criando seu primeiro fluxo para vê-lo aqui.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </>
  );
};

export default FlowsListPage;