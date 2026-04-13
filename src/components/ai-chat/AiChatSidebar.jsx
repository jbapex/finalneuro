import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Search, MessageSquare, X, Trash2, Edit2, Check, X as XIcon, Folder, FolderPlus, Sparkles, ChevronDown, ChevronUp, Grid3X3, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

function groupSessionsByDate(sessions) {
  const groups = { today: [], thisMonth: [], older: [] };
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  (sessions || []).forEach((s) => {
    const d = new Date(s.updated_at);
    if (d >= todayStart) groups.today.push(s);
    else if (d >= monthStart) groups.thisMonth.push(s);
    else groups.older.push(s);
  });
  return groups;
}

const AiChatSidebar = ({
  sessions,
  activeSessionId,
  isSessionsLoading,
  onSelectSession,
  onNewConversation,
  onDeleteSession,
  isDesktop,
  onClose,
  onSessionUpdate,
  onSelectExpert,
  activeFolderId: activeFolderIdProp,
  onActiveFolderChange,
}) => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [folders, setFolders] = useState([]);
  const [internalFolderId, setInternalFolderId] = useState('all');
  const activeFolderId = activeFolderIdProp !== undefined ? activeFolderIdProp : internalFolderId;
  const setActiveFolderId = onActiveFolderChange ?? setInternalFolderId;
  const [experts, setExperts] = useState([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isLoadingExperts, setIsLoadingExperts] = useState(false);
  const [expertsOpen, setExpertsOpen] = useState(true);
  const [chatsOpen, setChatsOpen] = useState(true);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [openFolders, setOpenFolders] = useState({});
  const { toast } = useToast();

  const safeSessions = Array.isArray(sessions) ? sessions : [];
  const sessionsByFolderId = safeSessions.reduce((acc, s) => {
    if (s.folder_id) {
      if (!acc[s.folder_id]) acc[s.folder_id] = [];
      acc[s.folder_id].push(s);
    }
    return acc;
  }, {});
  const ungroupedSessions = safeSessions.filter((s) => !s.folder_id);

  const folderCounts = (folders || []).reduce((acc, f) => {
    acc[f.id] = (sessionsByFolderId[f.id] || []).length;
    return acc;
  }, {});

  const normalizedSearch = (searchTerm || '').toLowerCase().trim();
  const matchesSearch = (session) =>
    !normalizedSearch ||
    (session.title || '').toLowerCase().includes(normalizedSearch);

  const filteredUngrouped = (ungroupedSessions || []).filter(matchesSearch);
  const { today: sessionsToday, thisMonth: sessionsThisMonth, older: sessionsOlder } =
    groupSessionsByDate(filteredUngrouped);

  const loadFolders = async () => {
    if (!user) return;
    setIsLoadingFolders(true);
    const { data, error } = await supabase
      .from('ai_chat_folders')
      .select('id, name, created_at')
      .order('created_at', { ascending: true });
    if (error) {
      toast({
        title: 'Erro ao carregar pastas',
        description: error.message,
        variant: 'destructive',
      });
      setFolders([]);
    } else {
      setFolders(data || []);
    }
    setIsLoadingFolders(false);
  };

  const loadExperts = async () => {
    if (!user) return;
    setIsLoadingExperts(true);
    const { data, error } = await supabase
      .from('ai_chat_experts')
      .select(
        'id, user_id, name, description, icon_emoji, system_prompt, default_llm_integration_id, default_user_ai_connection_id, is_active, created_at'
      )
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) {
      toast({
        title: 'Erro ao carregar experts',
        description: error.message,
        variant: 'destructive',
      });
      setExperts([]);
    } else {
      setExperts(data || []);
    }
    setIsLoadingExperts(false);
  };

  useEffect(() => {
    loadFolders();
    loadExperts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleStartEdit = (sessionId, currentTitle) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const handleSaveEdit = async (sessionId) => {
    if (!editingTitle.trim()) {
      toast({ title: "Título inválido", description: "O título não pode estar vazio.", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase
        .from('ai_chat_sessions')
        .update({ title: editingTitle.trim() })
        .eq('id', sessionId);

      if (error) throw error;

      toast({ title: "Título atualizado!", description: "O título da conversa foi atualizado com sucesso." });
      setEditingSessionId(null);
      setEditingTitle("");
      
      if (onSessionUpdate) onSessionUpdate();
    } catch (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const handleMoveToFolder = async (sessionId, folderId) => {
    try {
      const { error } = await supabase
        .from('ai_chat_sessions')
        .update({ folder_id: folderId || null })
        .eq('id', sessionId);
      if (error) throw error;
      toast({ title: 'Conversa movida', description: folderId ? 'Conversa adicionada à pasta.' : 'Conversa removida da pasta.' });
      if (onSessionUpdate) onSessionUpdate();
    } catch (err) {
      toast({ title: 'Erro ao mover', description: err.message, variant: 'destructive' });
    }
  };

  const renderSessionItem = (session) => (
    <div
      key={session.id}
      className="group relative"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', session.id);
      }}
    >
      {editingSessionId === session.id ? (
        <div className="flex items-center gap-2 p-2 px-2 mb-0.5">
          <Input
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(session.id); else if (e.key === 'Escape') handleCancelEdit(); }}
            className="flex-1 h-8 text-sm"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={(e) => { e.stopPropagation(); handleSaveEdit(session.id); }}><Check className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}><XIcon className="h-4 w-4" /></Button>
        </div>
      ) : (
        <>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start h-auto py-2 pl-2 pr-14 rounded-md text-left gap-0 overflow-hidden",
              activeSessionId === session.id && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-medium"
            )}
            onClick={() => onSelectSession(session.id)}
          >
            <MessageSquare className="mr-2 h-4 w-4 shrink-0 opacity-80" />
            <span className="min-w-0 flex-1 truncate text-left text-sm" title={session.title || 'Sem título'}>
              {session.title || 'Sem título'}
            </span>
          </Button>
          <div className="absolute right-1 top-1/2 z-10 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()} title="Mover para pasta">
                  <FolderPlus className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => handleMoveToFolder(session.id, null)}>
                  Sem pasta
                </DropdownMenuItem>
                {(folders || []).map((folder) => (
                  <DropdownMenuItem key={folder.id} onClick={() => handleMoveToFolder(session.id, folder.id)}>
                    {folder.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleStartEdit(session.id, session.title); }}><Edit2 className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}><Trash2 className="h-3 w-3" /></Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={cn("h-full flex flex-col transition-all duration-300 bg-background dark:bg-[#151518] border-r border-border/50", isDesktop ? 'w-full' : 'w-full')}>
      <div className="p-3 border-b flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Chat IA</h2>
        {!isDesktop && (
            <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
            </Button>
        )}
      </div>
      <div className="p-3 space-y-3 shrink-0">
        <div className="relative flex items-center gap-1">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input 
            placeholder="Pesquisar" 
            className="pl-9 pr-9 h-9 bg-muted/50 border-0"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button variant="ghost" size="icon" className="absolute right-1 h-7 w-7">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 h-9" onClick={onNewConversation}>
          <Plus className="h-4 w-4" />
          Nova Conversa
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 h-9"
          onClick={() => {
            if (!user) {
              toast({ title: 'Faça login', description: 'É preciso estar logado para criar pastas.', variant: 'destructive' });
              return;
            }
            setNewFolderName('');
            setIsNewFolderOpen(true);
          }}
        >
          <Folder className="h-4 w-4" />
          Nova Pasta
        </Button>
      </div>
      <Dialog open={isNewFolderOpen} onOpenChange={(open) => { setIsNewFolderOpen(open); if (!open) setNewFolderName(''); }}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Criar nova pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Nome da pasta"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
              disabled={isCreatingFolder}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFolderOpen(false)} disabled={isCreatingFolder}>
              Cancelar
            </Button>
            <Button
              disabled={!newFolderName.trim() || isCreatingFolder}
              onClick={async () => {
                const name = newFolderName.trim();
                if (!name || !user) return;
                setIsCreatingFolder(true);
                try {
                  const { data, error } = await supabase
                    .from('ai_chat_folders')
                    .insert({ user_id: user.id, name })
                    .select('id, name, created_at')
                    .single();
                  if (error) throw error;
                  setFolders((prev) => [...(prev || []), data]);
                  setActiveFolderId(data.id);
                  setIsNewFolderOpen(false);
                  setNewFolderName('');
                  toast({ title: 'Pasta criada', description: `"${name}" foi adicionada.` });
                } catch (err) {
                  toast({
                    title: 'Erro ao criar pasta',
                    description: err?.message || 'Tente novamente.',
                    variant: 'destructive',
                  });
                } finally {
                  setIsCreatingFolder(false);
                }
              }}
            >
              {isCreatingFolder ? 'Criando…' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-3">
          {/* Pastas (compactas) */}
          <div>
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pastas</span>
            </div>
            {isLoadingFolders ? (
              <div className="space-y-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                    <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-3/5 rounded bg-muted animate-pulse" />
                  </div>
                ))}
                    </div>
            ) : (
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start px-2 py-1.5 text-sm',
                    activeFolderId === 'all' && 'bg-primary/10 text-primary font-semibold'
                  )}
                  onClick={() => setActiveFolderId('all')}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sessionId = e.dataTransfer.getData('text/plain');
                    if (sessionId) {
                      handleMoveToFolder(sessionId, null);
                    }
                  }}
                >
                  <Folder className="h-3.5 w-3.5 mr-2" />
                  Todas as conversas
                  <span className="ml-auto text-muted-foreground text-xs tabular-nums">{safeSessions.length}</span>
                </Button>
                {(folders || []).map((folder) => (
                  <div
                    key={folder.id}
                    className="group flex flex-col"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const sessionId = e.dataTransfer.getData('text/plain');
                      if (sessionId) {
                        handleMoveToFolder(sessionId, folder.id);
                      }
                    }}
                  >
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        className={cn(
                          'flex-1 justify-start px-2 py-1.5 text-sm',
                          activeFolderId === folder.id && 'bg-primary/10 text-primary font-semibold'
                        )}
                        onClick={() => {
                          setActiveFolderId(folder.id);
                          setOpenFolders((prev) => ({
                            ...prev,
                            [folder.id]: !prev[folder.id],
                          }));
                        }}
                      >
                        <Folder className="h-3.5 w-3.5 mr-2" />
                        <span className="truncate">{folder.name}</span>
                        <span className="ml-auto text-muted-foreground text-xs tabular-nums">
                          {folderCounts[folder.id] ?? 0}
                        </span>
                      </Button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-primary"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const novoNome = window.prompt('Renomear pasta', folder.name);
                          if (!novoNome || !novoNome.trim()) return;
                          const { error } = await supabase
                            .from('ai_chat_folders')
                            .update({ name: novoNome.trim() })
                            .eq('id', folder.id);
                          if (error) {
                            toast({
                              title: 'Erro ao renomear pasta',
                              description: error.message,
                              variant: 'destructive',
                            });
                          } else {
                            setFolders((prev) =>
                              prev.map((f) => (f.id === folder.id ? { ...f, name: novoNome.trim() } : f))
                            );
                          }
                        }}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = window.confirm('Excluir esta pasta? As conversas não serão apagadas.');
                          if (!ok) return;
                          const { error } = await supabase
                            .from('ai_chat_folders')
                            .delete()
                            .eq('id', folder.id);
                          if (error) {
                            toast({
                              title: 'Erro ao excluir pasta',
                              description: error.message,
                              variant: 'destructive',
                            });
                          } else {
                            setFolders((prev) => prev.filter((f) => f.id !== folder.id));
                            if (activeFolderId === folder.id) setActiveFolderId('all');
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      </div>
                    </div>
                    {openFolders[folder.id] && (sessionsByFolderId[folder.id] || []).filter(matchesSearch).length > 0 && (
                      <div className="ml-5 mt-1 space-y-0.5">
                        {(sessionsByFolderId[folder.id] || [])
                          .filter(matchesSearch)
                          .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
                          .map((session) => renderSessionItem(session))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Experts (colapsável) */}
          <div>
            <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:bg-muted/50" onClick={() => setExpertsOpen((o) => !o)}>
              <span>Experts</span>
              {expertsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {expertsOpen && (
            <>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 h-8 px-2 mt-1 text-muted-foreground">
              <Grid3X3 className="h-4 w-4" />
              Explorar
            </Button>
            {isLoadingExperts ? (
              <div className="space-y-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                    <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
                    <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {(experts || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground px-2">
                    Nenhum expert configurado ainda.
                  </p>
                ) : (
                  (experts || []).map((expert) => (
                      <Button
                      key={expert.id}
                        variant="ghost"
                      className="w-full justify-start px-2 py-1.5 text-sm"
                      onClick={() => onSelectExpert?.(expert)}
                    >
                      <span className="mr-2 flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-xs">
                        {expert.icon_emoji || <Sparkles className="h-3.5 w-3.5 text-primary" />}
                      </span>
                      <div className="flex flex-col items-start truncate">
                        <span className="truncate font-medium">{expert.name}</span>
                        {expert.description && (
                          <span className="text-[11px] text-muted-foreground truncate max-w-full">
                            {expert.description}
                          </span>
                        )}
                      </div>
                    </Button>
                  ))
                )}
              </div>
            )}
                    </>
                  )}
          </div>

          {/* Chats (colapsável, agrupados por data) */}
          <div>
            <Button variant="ghost" size="sm" className="w-full justify-between h-8 px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:bg-muted/50" onClick={() => setChatsOpen((o) => !o)}>
              <span>Chats</span>
              {chatsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {chatsOpen && (
            <>
            {isSessionsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center space-x-2 p-2.5">
                        <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
                        <div className="h-4 w-4/5 rounded-md bg-muted animate-pulse" />
                    </div>
                ))
            ) : (
            <>
              {sessionsToday.length > 0 && (
                <div className="mt-2">
                  <p className="text-[11px] font-medium text-muted-foreground px-2 mb-1">Hoje</p>
                  {sessionsToday.map((session) => renderSessionItem(session))}
                </div>
              )}
              {sessionsThisMonth.length > 0 && (
                <div className="mt-2">
                  <p className="text-[11px] font-medium text-muted-foreground px-2 mb-1">
                    {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                  </p>
                  {sessionsThisMonth.map((session) => renderSessionItem(session))}
                </div>
              )}
              {sessionsOlder.length > 0 && (
                <div className="mt-2">
                  <p className="text-[11px] font-medium text-muted-foreground px-2 mb-1">Anteriores</p>
                  {sessionsOlder.map((session) => renderSessionItem(session))}
                </div>
              )}
            </>
            )}
            </>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default AiChatSidebar;