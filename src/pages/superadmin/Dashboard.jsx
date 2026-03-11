import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Package,
  Brain,
  TrendingUp,
  Activity,
  DollarSign,
  UserCheck,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { useSystemLogo } from '@/lib/systemBranding';
import { useTheme } from '@/contexts/ThemeContext';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { lightLogoUrl, darkLogoUrl } = useSystemLogo();
  const { theme } = useTheme();

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now - past) / 1000);

    const intervals = {
        ano: 31536000,
        mês: 2592000,
        semana: 604800,
        dia: 86400,
        hora: 3600,
        minuto: 60,
    };

    for (const [intervalName, seconds] of Object.entries(intervals)) {
        const intervalCount = Math.floor(diffInSeconds / seconds);
        if (intervalCount >= 1) {
            const plural = intervalCount > 1 ? 's' : '';
            if (intervalName === 'mês' && intervalCount > 1) {
              return `há ${intervalCount} meses`;
            }
            return `há ${intervalCount} ${intervalName}${plural}`;
        }
    }
    return 'agora mesmo';
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_superadmin_dashboard_stats');

    if (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: 'Não foi possível buscar as estatísticas do dashboard.',
        variant: 'destructive',
      });
    } else {
      setStats(data);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const statCards = [
    {
      title: 'Total de Usuários',
      value: stats?.total_users,
      icon: Users,
      color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950/50'
    },
    {
      title: 'Planos Ativos',
      value: stats?.active_plans,
      icon: Package,
      color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950/50'
    },
    {
      title: 'Módulos Criados',
      value: stats?.created_modules,
      icon: Brain,
      color: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-950/50'
    },
    {
      title: 'Receita Mensal',
      value: `R$ ${stats?.monthly_revenue?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-950/50'
    }
  ];

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center md:text-left flex flex-col gap-2"
      >
        <div className="flex items-center gap-3">
          {(() => {
            const prefersDark = theme === 'dark' || theme === 'system';
            const logoToShow = prefersDark ? darkLogoUrl || lightLogoUrl : lightLogoUrl || darkLogoUrl;
            if (logoToShow) {
              return (
                <img
                  src={logoToShow}
                  alt="Neuro Ápice"
                  className="h-8 w-auto object-contain"
                />
              );
            }
            return (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
            );
          })()}
          <div className="flex flex-col items-start">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Dashboard do Super Admin
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Visão geral do sistema Neuro Ápice
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="bg-card border-border h-full hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                      {loading ? (
                        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mt-1" />
                      ) : (
                        <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                      )}
                    </div>
                    <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                      <Icon className="w-6 h-6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center text-foreground">
                <Activity className="w-5 h-5 mr-2" />
                Atividade do Sistema
              </CardTitle>
              <CardDescription>
                Últimas 7 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">Gráfico de atividades em desenvolvimento</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center text-foreground">
                <UserCheck className="w-5 h-5 mr-2" />
                Atividades Recentes
              </CardTitle>
              <CardDescription>
                Últimas ações no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? (
                  <div className="flex justify-center items-center h-48">
                    <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                  </div>
                ) : (
                  stats?.recent_activities?.map((activity, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.4 + index * 0.1 }}
                      className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50 border border-border"
                    >
                      <div className="w-2 h-2 bg-muted-foreground rounded-full shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{activity.action}</p>
                        <p className="text-xs text-muted-foreground">{activity.detail}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{formatTimeAgo(activity.timestamp)}</span>
                    </motion.div>
                  ))
                )}
                {!loading && stats?.recent_activities?.length === 0 && (
                  <p className="text-center text-muted-foreground py-10">Nenhuma atividade recente.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;