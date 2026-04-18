import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Settings, Menu, Users, SlidersHorizontal, GitFork, Lock } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import MobileNavBar from '@/components/MobileNavBar';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useSystemLogo } from '@/lib/systemBranding';
const mainNavItems = [{
  to: '/clientes',
  icon: Users,
  label: 'Clientes',
  permissionKey: 'publication_calendar'
}, {
  to: '/ferramentas',
  icon: SlidersHorizontal,
  label: 'Ferramentas',
  permissionKey: null
}, {
  to: '/chat-ia',
  icon: Bot,
  label: 'Chat IA',
  permissionKey: 'ai_chat'
}, {
  to: '/fluxo-criativo',
  icon: GitFork,
  label: 'Fluxo Criativo',
  permissionKey: 'creative_flow'
}];
const NavItem = ({
  to,
  icon: Icon,
  label,
  isCollapsed,
  isAllowed,
  onNavigate
}) => {
  const { toast } = useToast();
  const location = useLocation();
  const handleClick = (e) => {
    if (!isAllowed) {
      e.preventDefault();
      toast({
        title: "Acesso Restrito",
        description: `O recurso "${label}" não está disponível no seu plano.`,
        variant: "destructive"
      });
    } else {
      onNavigate?.();
    }
  };
  return (
    <NavLink
      to={isAllowed ? to : '#'}
      onClick={handleClick}
      className={cn(
        'flex min-h-[44px] items-center gap-3 rounded-lg py-2 transition-all',
        isCollapsed ? 'justify-center px-2' : 'px-3',
        isAllowed ? 'cursor-pointer hover:bg-muted' : 'cursor-not-allowed opacity-60',
        location.pathname.startsWith(to) && to !== '/' && isAllowed ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!isCollapsed && <span className="font-medium flex-1">{label}</span>}
      {!isAllowed && <Lock className="h-4 w-4 shrink-0" />}
    </NavLink>
  );
};
const UserLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const {
    user,
    profile,
    signOut,
    hasPermission
  } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { lightLogoUrl, darkLogoUrl, iconLogoUrl, iconLightLogoUrl, iconDarkLogoUrl } = useSystemLogo();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const location = useLocation();
  const isNeuroDesignPage =
    location.pathname.startsWith('/ferramentas/neurodesign') || location.pathname === '/ferramentas/artes-culto';
  const isNeuroMotionPage = location.pathname === '/ferramentas/neuro-motion';
  const isChatIaPage = location.pathname === '/chat-ia';
  /** Ferramentas com canvas amplo: sidebar recolhida + logo compacta como no NeuroDesign */
  const isWideCanvasToolPage = isNeuroDesignPage || isNeuroMotionPage;

  // Em Chat IA, NeuroDesign, Artes de Culto e NeuroMotion, recolher o menu principal para dar mais espaço ao conteúdo
  useEffect(() => {
    if ((isChatIaPage || isWideCanvasToolPage) && isDesktop) {
      setIsSidebarCollapsed(true);
    } else if (!isChatIaPage && !isWideCanvasToolPage) {
      setIsSidebarCollapsed(false);
    }
  }, [isChatIaPage, isWideCanvasToolPage, isDesktop]);
  const getInitials = name => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length > 1) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };
  const toggleSidebar = () => {
    if (isDesktop) {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    } else {
      setIsSidebarOpen(!isSidebarOpen);
    }
  };

  /** Logo horizontal no topo: mesma escala em todas as rotas e breakpoints */
  const brandLogoImgClass =
    'h-8 w-auto max-h-8 max-w-[min(9.5rem,46vw)] object-contain object-left sm:h-9 sm:max-h-9 sm:max-w-[min(10.5rem,40vw)] lg:h-10 lg:max-h-10 lg:max-w-[11.5rem]';

  const renderBrandInner = ({ variant = 'rail' } = {}) => {
    const prefersDark = theme === 'dark' || theme === 'system';
    const logoToShow = prefersDark ? darkLogoUrl || lightLogoUrl : lightLogoUrl || darkLogoUrl;
    let iconToShow = logoToShow;
    if (prefersDark && iconDarkLogoUrl) {
      iconToShow = iconDarkLogoUrl;
    } else if (!prefersDark && iconLightLogoUrl) {
      iconToShow = iconLightLogoUrl;
    } else if (iconLogoUrl) {
      iconToShow = iconLogoUrl;
    }

    if (logoToShow) {
      if (variant === 'header' || variant === 'mobileBar') {
        return <img src={logoToShow} alt="Neuro Ápice" className={cn(brandLogoImgClass, variant === 'mobileBar' && 'object-center')} />;
      }
      if (isSidebarCollapsed) {
        return (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
            <img src={iconToShow} alt="Neuro Ápice" className="h-full w-full object-cover" />
          </div>
        );
      }
      return <img src={logoToShow} alt="Neuro Ápice" className="h-10 max-h-10 w-full object-contain px-1" />;
    }
    return (
      <>
        <Bot className="h-6 w-6 shrink-0 text-primary" />
        {!isSidebarCollapsed && <span>Neuro Ápice</span>}
      </>
    );
  };

  const sidebarWidthMotion = {
    width: isSidebarCollapsed ? '5rem' : '16rem',
  };
  const sidebarWidthTransition = {
    duration: 0.3,
    ease: 'easeInOut',
  };

  const SidebarContent = ({
    includeHeaderLogo = true,
  } = {}) => (
    <div className="flex h-full max-h-screen flex-col">
      {includeHeaderLogo ? (
        <div className="flex h-14 shrink-0 items-center border-b px-2 lg:h-[60px] lg:px-4">
          <NavLink to="/ferramentas" className="flex w-full items-center justify-center font-semibold">
            {renderBrandInner()}
          </NavLink>
        </div>
      ) : null}
      <div className={`flex flex-1 flex-col overflow-hidden ${isChatIaPage || isWideCanvasToolPage ? '' : 'border-r'}`}>
        <div className="flex-1 overflow-y-auto pt-2">
          <nav className={`grid items-start px-2 text-sm font-medium lg:px-4 ${isSidebarCollapsed ? 'gap-2' : ''}`}>
            {mainNavItems.map(item => <NavItem key={item.to} {...item} isCollapsed={isSidebarCollapsed} isAllowed={hasPermission(item.permissionKey)} onNavigate={!isDesktop ? () => setIsSidebarOpen(false) : undefined} />)}
          </nav>
        </div>
        <div className="mt-auto p-4 border-t">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:bg-muted cursor-pointer ${isSidebarCollapsed ? 'justify-center' : ''}`}>
                  <Avatar className="h-8 w-8">
                      <AvatarFallback>{getInitials(profile?.name || user?.email)}</AvatarFallback>
                  </Avatar>
                  {!isSidebarCollapsed && <div className="flex flex-col truncate">
                          <span className="font-semibold text-sm text-foreground truncate">{profile?.name || user?.email}</span>
                          <span className="text-xs text-muted-foreground">{profile?.plans?.name || 'Plano Básico'}</span>
                      </div>}
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>{profile?.name || 'Minha Conta'}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings/profile')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
  return (
    <div
      className={cn(
        'flex w-full max-w-full flex-col overflow-x-hidden',
        isNeuroMotionPage ? 'h-dvh max-h-dvh overflow-hidden' : 'min-h-screen'
      )}
    >
      <header
        className={cn(
          'sticky top-0 z-30 flex w-full shrink-0 items-center border-b',
          isNeuroMotionPage ? 'h-12 bg-card/80 lg:h-11' : 'h-14 bg-card lg:h-[60px]'
        )}
      >
        {isDesktop ? (
          <div className="flex h-full w-full min-w-0 items-center justify-between gap-3 px-3 sm:px-4 lg:px-6">
            <NavLink to="/ferramentas" className="flex min-w-0 shrink-0 items-center font-semibold">
              {renderBrandInner({ variant: 'header' })}
            </NavLink>
            <ThemeToggle />
          </div>
        ) : (
          <div className="flex h-full w-full min-w-0 items-center gap-2 px-2 sm:px-3">
            <Button variant="ghost" size="icon" className="touch-target shrink-0" onClick={toggleSidebar} aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
            <NavLink to="/ferramentas" className="flex min-w-0 flex-1 items-center justify-center font-semibold">
              {renderBrandInner({ variant: 'mobileBar' })}
            </NavLink>
            <ThemeToggle />
          </div>
        )}
      </header>

      <div
        className={cn(
          'grid min-h-0 w-full max-w-full flex-1 overflow-x-hidden md:grid-cols-[auto_1fr]',
          isNeuroMotionPage && 'min-h-0 overflow-hidden'
        )}
      >
        {isDesktop ? (
          <motion.div
            animate={sidebarWidthMotion}
            transition={sidebarWidthTransition}
            className={cn(
              'hidden min-h-0 h-full max-h-full bg-card md:block',
              isNeuroMotionPage && 'max-h-full overflow-hidden'
            )}
          >
            <SidebarContent includeHeaderLogo={false} />
          </motion.div>
        ) : (
          <AnimatePresence>
            {isSidebarOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/60"
                  onClick={toggleSidebar}
                />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="fixed left-0 top-0 z-50 h-full w-64 bg-card"
                >
                  <SidebarContent />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        )}

        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-col',
            isNeuroMotionPage && 'h-full overflow-hidden'
          )}
        >
          <main
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-x-hidden bg-muted/40',
              isNeuroMotionPage && 'overflow-hidden',
              !isNeuroMotionPage && !isChatIaPage && 'gap-4',
              isChatIaPage || isNeuroMotionPage ? '' : 'pb-20 md:pb-0'
            )}
          >
            <Outlet />
          </main>
        </div>
      </div>
      {!isDesktop && <MobileNavBar />}
    </div>
  );
};
export default UserLayout;