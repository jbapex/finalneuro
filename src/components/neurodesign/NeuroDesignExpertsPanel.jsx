import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Bot, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Badge } from '@/components/ui/badge';
import {
  NEURO_DESIGNER_GENERATOR_CATEGORY_ID,
  moduleHasGeneratorCategory,
  getModuleGeneratorCategoryMetas,
} from '@/lib/modules/generatorCategories';
import { cn } from '@/lib/utils';
import { ModuleChatEmbeddable } from '@/pages/user/ModuleChat';

/**
 * Lista agentes categoria Neuro Designer e abre o mesmo fluxo do Gerador de Conteúdo aqui dentro (sem sair do Neuro Designer).
 */
const NeuroDesignExpertsPanel = () => {
  const { authLoading, hasPermission } = useAuth();
  const { toast } = useToast();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModuleId, setActiveModuleId] = useState(null);

  const handleBackFromExpertChat = useCallback(() => {
    setActiveModuleId(null);
  }, []);

  const fetchModules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('modules')
      .select('id, name, description, config')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast({
        title: 'Erro ao carregar Experts',
        description: 'Não foi possível buscar os agentes.',
        variant: 'destructive',
      });
      setModules([]);
    } else {
      const list = (data || []).filter((m) =>
        moduleHasGeneratorCategory(m.config, NEURO_DESIGNER_GENERATOR_CATEGORY_ID),
      );
      setModules(list);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!authLoading) fetchModules();
  }, [fetchModules, authLoading]);

  const handleCardClick = (module, isAllowed) => {
    if (isAllowed) {
      setActiveModuleId(module.id);
    } else {
      toast({
        title: 'Acesso restrito',
        description: 'Este agente não está disponível no seu plano.',
        variant: 'destructive',
      });
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' },
    }),
  };

  const emptyCopy = useMemo(
    () => ({
      title: 'Nenhum agente Neuro Designer',
      description:
        'Peça ao administrador para marcar módulos com a categoria “Neuro Designer” no Gerador de Conteúdo.',
    }),
    [],
  );

  if (activeModuleId != null) {
    return (
      <div className="flex flex-1 flex-col min-h-0 h-full overflow-hidden">
        <ModuleChatEmbeddable
          moduleId={activeModuleId}
          embedMode
          onBack={handleBackFromExpertChat}
          rootClassName="flex-1 min-h-0"
        />
      </div>
    );
  }

  if (loading || authLoading) {
    return (
      <div className="flex-1 flex justify-center items-center min-h-[200px]">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
      <div className="max-w-4xl mb-6">
        <h2 className="text-lg font-semibold text-foreground">Experts</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha um agente e gere conteúdo aqui mesmo, sem sair do Neuro Designer.
        </p>
      </div>

      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        initial="hidden"
        animate="visible"
      >
        {modules.map((module, index) => {
          const isAllowed = hasPermission('module_access', module.id);
          const categoryMetas = getModuleGeneratorCategoryMetas(module.config);
          return (
            <motion.div
              key={module.id}
              custom={index}
              variants={cardVariants}
              whileHover={{ y: -4, boxShadow: '0 10px 24px rgba(0,0,0,0.08)' }}
              className={cn('relative', isAllowed ? 'cursor-pointer' : 'cursor-not-allowed')}
              onClick={() => handleCardClick(module, isAllowed)}
              title={!isAllowed ? 'Faça upgrade para acessar este agente' : ''}
            >
              <Card
                className={cn(
                  'h-full flex flex-col justify-between bg-card transition-all duration-300 border-2',
                  isAllowed ? 'border-transparent hover:border-primary' : 'border-dashed opacity-60',
                )}
              >
                {!isAllowed && (
                  <div className="absolute top-2 right-2 bg-destructive/80 text-destructive-foreground p-1.5 rounded-full z-10">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                )}
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-center mb-2">
                    <div className={cn('p-3 rounded-full', isAllowed ? 'bg-primary/10' : 'bg-muted')}>
                      <Bot className={cn('w-7 h-7', isAllowed ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <CardTitle
                      className={cn(
                        'text-center text-base font-bold',
                        isAllowed ? 'text-card-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {module.name}
                    </CardTitle>
                    <div className="flex flex-wrap justify-center gap-1">
                      {categoryMetas.map((meta) => (
                        <Badge key={meta.id} variant="secondary" className="text-[10px] font-normal">
                          {meta.shortLabel}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <CardDescription className="text-center text-muted-foreground text-xs">
                    {module.description || 'Sem descrição.'}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {modules.length === 0 && (
        <div className="mt-8 text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <Bot className="w-10 h-10 mx-auto text-muted-foreground" />
          <h3 className="mt-3 text-base font-semibold text-foreground">{emptyCopy.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto px-4">{emptyCopy.description}</p>
        </div>
      )}
    </div>
  );
};

export default NeuroDesignExpertsPanel;
