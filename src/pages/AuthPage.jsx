import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Lock, Mail, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useSystemLogo } from '@/lib/systemBranding';
import { useLandingAssets } from '@/lib/landingAssets';
import { useTheme } from '@/contexts/ThemeContext';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { lightLogoUrl, darkLogoUrl } = useSystemLogo();
  const { assets: landingAssets } = useLandingAssets();
  const { theme } = useTheme();

  useEffect(() => {
    if (searchParams.get('session_expired') === '1') {
      toast({
        title: 'Sessão expirada',
        description: 'Sua sessão expirou ou foi encerrada. Faça login novamente.',
        variant: 'destructive',
      });
    }
  }, [searchParams, toast]);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleAuth = async (e) => {
    e.preventDefault();

    if (isForgotPassword) {
      await handleResetPassword();
      return;
    }

    setLoading(true);

    const LOGIN_TIMEOUT_MS = 15000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Login está demorando. Verifique sua conexão com a internet e tente novamente.')), LOGIN_TIMEOUT_MS)
    );

    try {
      if (isLogin) {
        const signInPromise = supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        const { data, error } = await Promise.race([signInPromise, timeoutPromise]);
        if (error) {
          if (import.meta.env.DEV) {
            console.warn('[Auth] signIn error:', { status: error.status, code: error.code, message: error.message });
          }
          throw error;
        }
        if (data?.session) {
          toast({ title: "Login realizado com sucesso!", description: "Bem-vindo de volta!" });
        }
      } else {
        // Validação antes do signup: senha mínima 6 caracteres e e-mail válido
        const emailTrimmed = (formData.email || '').trim();
        const password = formData.password || '';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailTrimmed)) {
          toast({
            title: "E-mail inválido",
            description: "Digite um e-mail válido (ex.: seu@email.com).",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          toast({
            title: "Senha muito curta",
            description: "A senha deve ter no mínimo 6 caracteres.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const signUpPromise = supabase.auth.signUp({
          email: emailTrimmed,
          password,
          options: {
            data: {
              name: formData.name,
              user_type: 'user',
            },
          },
        });
        const { data, error } = await Promise.race([signUpPromise, timeoutPromise]);
        if (error) throw error;
        if (data?.user) {
          toast({ title: "Cadastro realizado!", description: "Verifique seu e-mail para confirmação." });
          setIsLogin(true);
        }
      }
    } catch (error) {
      const raw = error?.message || '';
      const status = error?.status;
      const isAlreadyRegistered = /user already registered|already been registered|email.*already/i.test(raw);
      const isNetwork = /fetch|network|failed to fetch|cors|timeout|unreachable/i.test(raw) || error?.name === 'TypeError';
      const isTimeout = raw.includes('demorando');
      const isCredentialError = /invalid.*credential|invalid.*login|email not confirmed/i.test(raw);
      const isBadKey = (status === 401 || status === 403) && !isCredentialError && /key|api/i.test(raw) && !/jwt|token/i.test(raw);
      let title = "Erro de Autenticação";
      let message = raw || "Verifique suas credenciais e tente novamente.";
      if (isAlreadyRegistered || (status === 422 && /already|registered/i.test(raw))) {
        title = "E-mail já cadastrado";
        message = "Este e-mail já está em uso. Faça login ou use \"Esqueci a senha\" para recuperar o acesso.";
        setIsLogin(true);
      } else if (status === 422) {
        title = "Cadastro não realizado";
        message = raw || "Dados inválidos. Verifique: e-mail (não utilizado em outra conta) e senha (mínimo 6 caracteres).";
      } else if (isNetwork || isTimeout) {
        title = "Sem conexão com o servidor";
        message = "Não foi possível conectar ao Supabase. Verifique a URL em .env.local e sua conexão.";
      } else if (isBadKey) {
        title = "Chave do Supabase incorreta";
        message = "A chave anon (VITE_SUPABASE_ANON_KEY) não pertence a este servidor. No painel do Supabase, Project Settings > API: copie URL e anon key para o .env.local.";
      } else if (isCredentialError || raw === "Invalid authentication credentials") {
        title = "Login não autorizado";
        message = "O servidor rejeitou o login. Confira: (1) A conta foi criada neste mesmo Supabase (URL do .env.local)? (2) No painel Supabase: Auth → URL Configuration → adicione http://localhost:3000 em Redirect URLs. (3) Auth → Providers → Email: se \"Confirm email\" estiver ativo, confirme o e-mail antes de logar.";
      }
      toast({
        title,
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const emailTrimmed = (resetEmail || formData.email || '').trim();
    if (!emailTrimmed) {
      toast({
        title: 'Informe seu e-mail',
        description: 'Digite o e-mail cadastrado para receber o link de redefinição.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth`;
      const { error } = await supabase.auth.resetPasswordForEmail(emailTrimmed, {
        redirectTo,
      });
      if (error) throw error;
      toast({
        title: 'Link enviado',
        description: 'Verifique seu e-mail para redefinir a senha.',
      });
      setIsForgotPassword(false);
      setResetEmail('');
    } catch (error) {
      toast({
        title: 'Erro ao enviar link',
        description: error?.message || 'Não foi possível enviar o link de redefinição. Tente novamente em alguns instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#050513] via-[#050513] to-black dark:from-[#050513] dark:via-[#050513] dark:to-black text-foreground flex flex-col items-center px-4 py-8 overflow-x-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
        />
        <motion.div
          animate={{ opacity: [0.1, 0.4, 0.1], scale: [1.1, 1, 1.1] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute right-[-120px] top-[40%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl"
        />
      </div>

      {/* Hero Section (Grid: Text L / Form R) */}
      <div className="relative z-10 w-full max-w-7xl grid gap-12 lg:grid-cols-[1.2fr_1fr] items-center min-h-[85vh]">
        
        {/* Coluna esquerda - Hero Text */}
        <div className="flex flex-col gap-8 text-left text-white pt-10 lg:pt-0 order-2 lg:order-1">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 border border-white/10 backdrop-blur w-fit"
          >
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-white/80 uppercase tracking-wider">
              O fim das assinaturas de IA limitadas
            </span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Sua própria plataforma de IA para <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">Marketing e Design.</span>
            </h1>
            <p className="text-base md:text-lg text-white/70 max-w-2xl leading-relaxed">
              Pare de pagar por créditos em ferramentas gringas. Tenha seu próprio sistema para gerar artes, copys e gerenciar campanhas com inteligência artificial ilimitada. Perfeito para agências, igrejas e experts escalarem suas operações.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="flex flex-wrap gap-4 pt-4">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 flex-1 min-w-[160px] backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">🎨</div>
              <div>
                <p className="text-sm font-bold text-white">Artes Ilimitadas</p>
                <p className="text-[10px] text-white/50">Sem custo por imagem</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 flex-1 min-w-[160px] backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">🤖</div>
              <div>
                <p className="text-sm font-bold text-white">Agentes Especialistas</p>
                <p className="text-[10px] text-white/50">Copy, tráfego e estratégia</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 flex-1 min-w-[160px] backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">⚙️</div>
              <div>
                <p className="text-sm font-bold text-white">Controle Total</p>
                <p className="text-[10px] text-white/50">Sua marca, suas regras</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Coluna direita - Formulário */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-md mx-auto lg:ml-auto order-1 lg:order-2"
        >
          <Card className="bg-card/90 backdrop-blur-xl border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.65)]">
            <CardHeader className="text-center pb-2">
              <div className="flex flex-col items-center gap-3">
                {(() => {
                  const prefersDark = theme === 'dark' || theme === 'system';
                  const logoToShow = prefersDark ? darkLogoUrl || lightLogoUrl : lightLogoUrl || darkLogoUrl;
                  if (logoToShow) {
                    return (
                      <img
                        src={logoToShow}
                        alt="Neuro Ápice"
                        className="h-12 w-auto object-contain drop-shadow-[0_0_22px_rgba(129,140,248,0.4)]"
                      />
                    );
                  }
                  return (
                    <div className="mx-auto bg-primary/15 p-4 rounded-2xl inline-flex items-center justify-center shadow-[0_0_30px_rgba(129,140,248,0.55)]">
                      <Brain className="w-8 h-8 text-primary" />
                    </div>
                  );
                })()}
              </div>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
                {isForgotPassword
                  ? 'Informe o e-mail cadastrado para receber o link de redefinição de senha.'
                  : 'Entre na central que une NeuroDesigner, chats de IA e performance para operar marketing, cultos e projetos em um só lugar.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 pb-6" data-auth-form>
              <form onSubmit={handleAuth} className="space-y-4">
                {isForgotPassword ? (
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="resetEmail"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="seuemail@empresa.com"
                        className="pl-10 bg-input border-input text-foreground placeholder:text-muted-foreground"
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {!isLogin && (
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome completo</Label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="name"
                            type="text"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="Seu nome"
                            className="pl-10 bg-input border-input text-foreground placeholder:text-muted-foreground"
                            required
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="seuemail@empresa.com"
                          className="pl-10 bg-input border-input text-foreground placeholder:text-muted-foreground"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Senha</Label>
                        {isLogin && (
                          <button
                            type="button"
                            onClick={() => setIsForgotPassword(true)}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Esqueceu a senha?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={handleInputChange}
                          placeholder="Digite sua senha"
                          className="pl-10 pr-20 bg-input border-input text-foreground placeholder:text-muted-foreground"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-primary"
                        >
                          {showPassword ? 'Ocultar' : 'Mostrar'}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
                        <Checkbox
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                          className="h-3.5 w-3.5"
                        />
                        <span>Lembrar de mim</span>
                      </label>
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  className="w-full min-h-[44px] touch-target btn-primary-gradient font-semibold text-sm mt-2"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isForgotPassword ? (
                    'Enviar link de redefinição'
                  ) : isLogin ? (
                    'Entrar no sistema'
                  ) : (
                    'Criar conta'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center space-y-2">
                {!isForgotPassword && (
                  <Button
                    variant="link"
                    onClick={() => {
                      setIsLogin((prev) => !prev);
                      setFormData((prev) => ({ ...prev, password: '' }));
                    }}
                    className="text-xs sm:text-sm text-muted-foreground hover:text-primary"
                  >
                    {isLogin
                      ? 'Não tem uma conta? Cadastre-se'
                      : 'Já tem uma conta? Faça login'}
                  </Button>
                )}
                {isForgotPassword && (
                  <Button
                    variant="link"
                    onClick={() => setIsForgotPassword(false)}
                    className="text-xs sm:text-sm text-muted-foreground hover:text-primary"
                  >
                    Voltar para entrar no sistema
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Seções de apresentação do produto */}
      <div className="relative z-10 w-full max-w-7xl mt-24 space-y-24 pb-20">
        
        {/* Divider / Scroll Indicator */}
        <div className="flex justify-center w-full">
          <motion.div 
            animate={{ y: [0, 10, 0] }} 
            transition={{ duration: 2, repeat: Infinity }}
            className="w-8 h-12 rounded-full border-2 border-white/20 flex justify-center p-1"
          >
            <div className="w-1.5 h-3 bg-primary rounded-full" />
          </motion.div>
        </div>

        {/* Sobre o NeuroDesigner */}
        <section className="grid gap-12 lg:grid-cols-[1.2fr_1fr] items-center">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="space-y-6">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
              Sua fábrica de artes e campanhas com IA, <br className="hidden md:block"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">do jeito que o cliente vê.</span>
            </h2>
            <p className="text-base md:text-lg text-white/70 leading-relaxed">
              Crie artes para cultos, campanhas, lançamentos e redes sociais com poucos cliques.
              O NeuroDesigner foi pensado para quem precisa produzir muito, com padrão profissional,
              sem depender de templates genéricos.
            </p>
            <ul className="text-base text-white/80 space-y-4 pt-4">
              <li className="flex items-start gap-3">
                <div className="mt-1 bg-primary/20 p-1 rounded-full"><div className="w-2 h-2 bg-primary rounded-full"/></div>
                <span>Fluxos prontos para Artes Culto, anúncios, criativos e posts.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1 bg-primary/20 p-1 rounded-full"><div className="w-2 h-2 bg-primary rounded-full"/></div>
                <span>IA ajustada para linguagem de igrejas, infoprodutos e negócios locais.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1 bg-primary/20 p-1 rounded-full"><div className="w-2 h-2 bg-primary rounded-full"/></div>
                <span>Controle total dos prompts, referências e logos do seu sistema.</span>
              </li>
            </ul>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-[2rem] blur opacity-20" />
            <div className="relative rounded-3xl border border-white/10 bg-[#0a0a1a] p-2 shadow-2xl overflow-hidden aspect-[4/3] flex flex-col">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500/50"/><div className="w-3 h-3 rounded-full bg-yellow-500/50"/><div className="w-3 h-3 rounded-full bg-green-500/50"/></div>
                <div className="mx-auto text-xs text-white/30 font-medium tracking-wider">NEURODESIGNER</div>
              </div>
              <div className="flex-1 bg-gradient-to-br from-primary/10 via-transparent to-transparent flex items-center justify-center text-center relative overflow-hidden">
                 {landingAssets.hero_print ? (
                   <img src={landingAssets.hero_print} alt="Print do NeuroDesigner" className="absolute inset-0 w-full h-full object-cover" />
                 ) : (
                   <div className="space-y-3 max-w-sm p-8">
                      <Brain className="w-12 h-12 text-primary/50 mx-auto" />
                      <p className="text-sm text-white/60">
                        Espaço reservado para print real do NeuroDesigner (fluxo de criação ou painel).
                      </p>
                   </div>
                 )}
              </div>
            </div>
          </motion.div>
        </section>

        {/* Funcionalidades Detalhadas */}
        <section className="space-y-16 py-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Tudo que você precisa em uma única plataforma
            </h2>
            <p className="text-white/60 text-lg">Substitua dezenas de ferramentas avulsas e centralize sua operação.</p>
          </div>
          
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Feature 1 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} 
              className="rounded-3xl border border-white/10 bg-[#0a0a1a] overflow-hidden group relative"
            >
              <div className="h-64 relative p-6 flex flex-col justify-end overflow-hidden">
                {landingAssets.feature_1 ? (
                  <img src={landingAssets.feature_1} alt="NeuroDesigner" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 to-black" />
                )}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a] via-[#0a0a1a]/50 to-transparent" />
                <div className="relative z-10 space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl mb-4">🎨</div>
                  <h3 className="text-2xl font-bold text-white">NeuroDesigner</h3>
                  <p className="text-white/70">Gere artes impressionantes para cultos, anúncios e redes sociais em segundos. Sem depender de designers ou templates engessados.</p>
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 bg-white/[0.02] relative z-20">
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Artes Culto</p>
                  <p className="text-white/50 text-xs">Fluxos otimizados para igrejas</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Criativos Ads</p>
                  <p className="text-white/50 text-xs">Foco em alta conversão</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Sem Limites</p>
                  <p className="text-white/50 text-xs">Gere quantas precisar</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Sua Identidade</p>
                  <p className="text-white/50 text-xs">Controle de logos e cores</p>
                </div>
              </div>
            </motion.div>

            {/* Feature 2 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }} 
              className="rounded-3xl border border-white/10 bg-[#0a0a1a] overflow-hidden group relative"
            >
              <div className="h-64 relative p-6 flex flex-col justify-end overflow-hidden">
                {landingAssets.feature_2 ? (
                  <img src={landingAssets.feature_2} alt="Agentes Especialistas" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-900/40 to-black" />
                )}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a] via-[#0a0a1a]/50 to-transparent" />
                <div className="relative z-10 space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl mb-4">🤖</div>
                  <h3 className="text-2xl font-bold text-white">Agentes Especialistas</h3>
                  <p className="text-white/70">Um time completo de IAs treinadas para copywriting, estratégia, tráfego e conteúdo, trabalhando para os seus projetos.</p>
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 bg-white/[0.02] relative z-20">
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Copywriters</p>
                  <p className="text-white/50 text-xs">Textos que vendem</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Estrategistas</p>
                  <p className="text-white/50 text-xs">Planejamento de campanhas</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Contexto Real</p>
                  <p className="text-white/50 text-xs">IA lê os dados do cliente</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Multi-Modelos</p>
                  <p className="text-white/50 text-xs">GPT-4, Claude, Gemini</p>
                </div>
              </div>
            </motion.div>
            
            {/* Feature 3 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} 
              className="rounded-3xl border border-white/10 bg-[#0a0a1a] overflow-hidden group relative"
            >
              <div className="h-64 relative p-6 flex flex-col justify-end overflow-hidden">
                {landingAssets.feature_3 ? (
                  <img src={landingAssets.feature_3} alt="Performance e Tráfego" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 to-black" />
                )}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a] via-[#0a0a1a]/50 to-transparent" />
                <div className="relative z-10 space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl mb-4">📊</div>
                  <h3 className="text-2xl font-bold text-white">Performance e Tráfego</h3>
                  <p className="text-white/70">Conecte suas contas de anúncios e veja os resultados em tempo real. A IA analisa as métricas e sugere otimizações.</p>
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 bg-white/[0.02] relative z-20">
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Meta Ads</p>
                  <p className="text-white/50 text-xs">Integração direta</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Dashboards</p>
                  <p className="text-white/50 text-xs">Visão clara de ROI/ROAS</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Análise IA</p>
                  <p className="text-white/50 text-xs">Insights automáticos</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Relatórios</p>
                  <p className="text-white/50 text-xs">Prontos para o cliente</p>
                </div>
              </div>
            </motion.div>

            {/* Feature 4 */}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }} 
              className="rounded-3xl border border-white/10 bg-[#0a0a1a] overflow-hidden group relative"
            >
              <div className="h-64 relative p-6 flex flex-col justify-end overflow-hidden">
                {landingAssets.feature_4 ? (
                  <img src={landingAssets.feature_4} alt="Gestão de Clientes" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-900/40 to-black" />
                )}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a] via-[#0a0a1a]/50 to-transparent" />
                <div className="relative z-10 space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center text-2xl mb-4">🏢</div>
                  <h3 className="text-2xl font-bold text-white">Gestão de Clientes</h3>
                  <p className="text-white/70">Organize todas as informações, campanhas, arquivos e calendário de publicações de cada cliente em um só lugar.</p>
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 bg-white/[0.02] relative z-20">
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">CRM Integrado</p>
                  <p className="text-white/50 text-xs">Dados centralizados</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Calendário</p>
                  <p className="text-white/50 text-xs">Planejamento visual</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Projetos</p>
                  <p className="text-white/50 text-xs">Kanban e tarefas</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white font-medium text-sm">Arquivos</p>
                  <p className="text-white/50 text-xs">Media center organizado</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Galeria NeuroDesigner */}
        <section className="space-y-12 py-12 relative">
          <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full -z-10" />
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Criado com NeuroDesigner
            </h2>
            <p className="text-white/60 text-lg">Resultados profissionais gerados por inteligência artificial em segundos.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Imagens geradas */}
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
              const imgUrl = landingAssets[`gallery_${i}`];
              return (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, scale: 0.9 }} 
                  whileInView={{ opacity: 1, scale: 1 }} 
                  viewport={{ once: true }} 
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="aspect-square rounded-2xl bg-white/5 border border-white/10 overflow-hidden relative group cursor-pointer"
                >
                  {imgUrl ? (
                    <img src={imgUrl} alt={`Exemplo ${i}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20 group-hover:text-white/40 transition-colors">
                      <div className="text-center space-y-2">
                        <Brain className="w-8 h-8 mx-auto opacity-50" />
                        <p className="text-xs">Exemplo {i}</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <p className="text-white text-xs font-medium">Arte gerada por IA</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Para quem é */}
        <section className="space-y-12 relative">
          <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full -z-10" />
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Feito para quem vende criatividade e resultado.
            </h2>
          </div>
          
          <div className="grid gap-6 md:grid-cols-3">
             {[
              { title: 'Agências e Social Media', desc: 'Centralize clientes, campanhas e arte em um sistema que você pode apresentar como parte da sua própria plataforma.' },
              { title: 'Igrejas e ministérios', desc: 'Planeje séries, cultos e eventos com artes, textos e descrições alinhadas à linguagem da igreja.' },
              { title: 'Experts e infoprodutores', desc: 'Organize lançamentos, conteúdos perpétuos e presença digital com IA focada em conversão.' }
            ].map((target, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }} 
                className="rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.08] to-transparent p-8 flex flex-col gap-3"
              >
                <h3 className="text-lg font-semibold text-white">{target.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{target.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Diferenciais */}
        <section className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} 
              className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-8 flex flex-col gap-4 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-2xl rounded-full" />
              <h3 className="text-2xl font-bold text-white relative z-10">Sem cobrança por créditos</h3>
              <p className="text-base text-white/80 leading-relaxed relative z-10">
                Você controla a infraestrutura e o custo de IA. O sistema não limita quantas artes ou ideias
                você pode gerar para os seus clientes. Liberdade total para escalar.
              </p>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} 
              className="rounded-3xl border border-primary/30 bg-primary/10 p-8 flex flex-col gap-4 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-2xl rounded-full" />
              <h3 className="text-2xl font-bold text-white relative z-10">Controle total do sistema</h3>
              <p className="text-base text-white/80 leading-relaxed relative z-10">
                Personalize logo, cores, textos, fluxos e integrações. O Neuro Ápice é pensado para ser a
                base da sua própria solução, não só uma conta em mais um SaaS.
              </p>
            </motion.div>
          </div>
        </section>

        {/* CTA final */}
        <motion.section initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} 
          className="rounded-[2.5rem] border border-white/20 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent px-8 py-16 md:px-16 md:py-20 flex flex-col items-center text-center gap-8 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          <div className="space-y-4 max-w-2xl relative z-10">
            <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
              Pronto para colocar o NeuroDesigner para trabalhar ao seu favor?
            </h2>
            <p className="text-base md:text-xl text-white/80">
              Crie sua conta ou faça login agora e teste na prática como é ter uma central de IA,
              design e performance sob o seu controle.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            className="min-h-[56px] px-10 text-lg rounded-full btn-primary-gradient font-bold shadow-[0_0_40px_rgba(129,140,248,0.5)] hover:shadow-[0_0_60px_rgba(129,140,248,0.7)] transition-all relative z-10"
            onClick={() => {
              const element = document.querySelector('[data-auth-form]');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
          >
            Entrar no sistema agora
          </Button>
        </motion.section>
      </div>
    </div>
  );
};

export default AuthPage;