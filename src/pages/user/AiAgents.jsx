import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bot, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MODULE_GENERATOR_CATEGORIES_MAIN_UI,
  moduleHasGeneratorCategory,
  getModuleGeneratorCategoryMetas,
} from '@/lib/modules/generatorCategories';
import { cn } from '@/lib/utils';

const AiAgents = () => {
  const navigate = useNavigate();
  const { authLoading, hasPermission } = useAuth();
  const { toast } = useToast();
  
  const [allModules, setAllModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');

  const fetchAllModules = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('modules')
      .select('id, name, description, config')
      .eq('is_active', true)
      .order('name');
      
    if (error) {
      toast({
        title: 'Erro ao carregar agentes',
        description: 'Não foi possível buscar os agentes de IA.',
        variant: 'destructive',
      });
      setAllModules([]);
    } else {
      setAllModules(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
        fetchAllModules();
    }
  }, [fetchAllModules, authLoading]);

  const filteredModules = useMemo(() => {
    if (categoryFilter === 'all') return allModules;
    return allModules.filter((m) => moduleHasGeneratorCategory(m.config, categoryFilter));
  }, [allModules, categoryFilter]);

  const handleCardClick = (module, isAllowed) => {
    if (isAllowed) {
      navigate(`/ferramentas/gerador-de-conteudo/${module.id}`);
    } else {
      toast({
        title: "Acesso Restrito",
        description: "Este agente não está disponível no seu plano. Considere fazer um upgrade!",
        variant: "destructive",
      });
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
        ease: 'easeOut',
      },
    }),
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Gerador de Conteúdo</h1>
        <p className="text-base text-muted-foreground">
          Explore e utilize os agentes de IA especializados para criar conteúdo. Filtre por tipo de tarefa para encontrar o agente certo.
        </p>
      </motion.div>

      {!loading && !authLoading && allModules.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground mr-1 shrink-0">Filtrar:</span>
          <Button
            type="button"
            variant={categoryFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            className="h-8"
            onClick={() => setCategoryFilter('all')}
          >
            Todos
          </Button>
          {MODULE_GENERATOR_CATEGORIES_MAIN_UI.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              variant={categoryFilter === cat.id ? 'default' : 'outline'}
              size="sm"
              className="h-8"
              onClick={() => setCategoryFilter(cat.id)}
            >
              {cat.shortLabel}
            </Button>
          ))}
        </div>
      )}

      {loading || authLoading ? (
        <div className="flex-1 flex justify-center items-center h-[calc(100vh-200px)]">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6"
          initial="hidden"
          animate="visible"
        >
          {filteredModules.map((module, index) => {
            const isAllowed = hasPermission('module_access', module.id);
            const categoryMetas = getModuleGeneratorCategoryMetas(module.config);
            return (
              <motion.div
                key={module.id}
                custom={index}
                variants={cardVariants}
                whileHover={{ y: -5, boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                className={cn('relative', isAllowed ? 'cursor-pointer' : 'cursor-not-allowed')}
                onClick={() => handleCardClick(module, isAllowed)}
                title={!isAllowed ? "Faça upgrade para acessar este agente" : ""}
              >
                <Card className={`h-full flex flex-col justify-between bg-card text-card-foreground transition-all duration-300 border-2 ${isAllowed ? 'border-transparent hover:border-primary' : 'border-dashed opacity-60'}`}>
                   {!isAllowed && (
                      <div className="absolute top-2 right-2 bg-destructive/80 text-destructive-foreground p-1.5 rounded-full z-10">
                          <Lock className="w-3.5 h-3.5" />
                      </div>
                  )}
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-center mb-2">
                      <div className={`p-3 rounded-full ${isAllowed ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Bot className={`w-7 h-7 ${isAllowed ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                      <CardTitle className={`text-center text-base font-bold ${isAllowed ? 'text-card-foreground' : 'text-muted-foreground'}`}>{module.name}</CardTitle>
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
                      {module.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
           {allModules.length === 0 && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full text-center py-10 bg-card rounded-lg border border-dashed">
                <Bot className="w-10 h-10 mx-auto text-muted-foreground" />
                <h3 className="mt-3 text-base font-semibold text-card-foreground">Nenhum Agente de IA configurado</h3>
                <p className="mt-1 text-sm text-muted-foreground">Parece que ainda não há agentes de IA ativos no sistema.</p>
            </motion.div>
          )}
          {allModules.length > 0 && filteredModules.length === 0 && !loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full text-center py-10 bg-card rounded-lg border border-dashed">
              <Bot className="w-10 h-10 mx-auto text-muted-foreground" />
              <h3 className="mt-3 text-base font-semibold text-card-foreground">Nenhum agente nesta categoria</h3>
              <p className="mt-1 text-sm text-muted-foreground">Experimente outro filtro ou &quot;Todos&quot;.</p>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default AiAgents;