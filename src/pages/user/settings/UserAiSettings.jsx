import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Edit, KeyRound, Image as ImageIcon, Bot, ToggleLeft, ToggleRight, Construction } from 'lucide-react';
import UserLlmConnectionDialog from '@/pages/user/settings/UserLlmConnectionDialog';
import UserImageConnectionDialog from '@/pages/user/settings/UserImageConnectionDialog';
import UserSiteBuilderConnectionDialog from '@/pages/user/settings/UserSiteBuilderConnectionDialog';
import { getDefaultAiConnection, setDefaultAiConnection } from '@/lib/userAiDefaults';

const UserAiSettings = () => {
  const { user } = useAuth();
  const [llmConnections, setLlmConnections] = useState([]);
  const [imageConnections, setImageConnections] = useState([]);
  const [siteBuilderConnections, setSiteBuilderConnections] = useState([]);
  const [isLlmDialogOpen, setIsLlmDialogOpen] = useState(false);
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [isSiteBuilderDialogOpen, setIsSiteBuilderDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [defaultLlmId, setDefaultLlmId] = useState('');
  const [defaultImageId, setDefaultImageId] = useState('');

  const fetchConnections = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_ai_connections')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      toast.error('Erro ao carregar conexões de IA', { description: error.message });
    } else {
      setLlmConnections(data.filter(c => c.capabilities?.text_generation));
      setImageConnections(data.filter(c => c.capabilities?.image_generation));
      setSiteBuilderConnections(data.filter(c => c.capabilities?.site_builder));
    }
  }, [user]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  useEffect(() => {
    if (!user?.id) return;
    setDefaultLlmId(getDefaultAiConnection(user.id, 'llm'));
    setDefaultImageId(getDefaultAiConnection(user.id, 'image'));
  }, [user?.id]);

  const handleSetDefault = (connection, type) => {
    if (!user?.id || !connection?.id) return;
    setDefaultAiConnection(user.id, type, connection.id);
    if (type === 'llm') setDefaultLlmId(String(connection.id));
    if (type === 'image') setDefaultImageId(String(connection.id));
    toast.success(`"${connection.name}" definida como padrão.`);
  };

  const handleEdit = (connection) => {
    setEditingConnection(connection);
    if (connection.capabilities?.text_generation) {
        setIsLlmDialogOpen(true);
    } else if (connection.capabilities?.image_generation) {
        setIsImageDialogOpen(true);
    } else if (connection.capabilities?.site_builder) {
        setIsSiteBuilderDialogOpen(true);
    }
  };

  const handleDelete = async (connectionId) => {
    const { error } = await supabase.from('user_ai_connections').delete().eq('id', connectionId);
    if (error) {
      toast.error('Erro ao remover conexão', { description: error.message });
    } else {
      toast.success('Conexão removida com sucesso!');
      fetchConnections();
    }
  };

  const handleToggleActive = async (connection) => {
    // Permitir múltiplas IAs ativas ao mesmo tempo - remover lógica de desativação automática
    const { error } = await supabase
      .from('user_ai_connections')
      .update({ is_active: !connection.is_active })
      .eq('id', connection.id);
    
    if (error) {
        toast.error('Erro ao ativar/desativar conexão', { description: error.message });
    } else {
        toast.success(`Conexão ${!connection.is_active ? 'ativada' : 'desativada'}!`);
        fetchConnections();
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
      },
    }),
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'llm':
        return <Bot className="w-5 h-5 text-primary" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-primary" />;
      case 'site_builder':
        return <Construction className="w-5 h-5 text-primary" />;
      default:
        return null;
    }
  };

  const renderConnectionCard = (connection, index, type) => (
    <motion.div key={connection.id} custom={index} variants={cardVariants} initial="hidden" animate="visible">
      {(() => {
        const isDefault =
          type === 'llm'
            ? String(defaultLlmId) === String(connection.id)
            : type === 'image'
              ? String(defaultImageId) === String(connection.id)
              : false;
        return (
      <Card className={`overflow-hidden border-2 ${connection.is_active ? 'border-primary shadow-lg shadow-primary/20' : 'border-border'} bg-card/50 backdrop-blur-sm`}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                {getIconForType(type)}
                {connection.name}
                {isDefault && (
                  <span className="rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Padrão
                  </span>
                )}
              </CardTitle>
              <CardDescription>{connection.provider}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleToggleActive(connection)}>
                {connection.is_active ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <KeyRound className="w-4 h-4" />
            <span className="truncate">Chave de API configurada</span>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          {(type === 'llm' || type === 'image') && (
            <Button
              variant={isDefault ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => handleSetDefault(connection, type)}
            >
              {isDefault ? 'Conexão padrão' : 'Definir padrão'}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => handleEdit(connection)}><Edit className="w-4 h-4 mr-2" /> Editar</Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(connection.id)}><Trash2 className="w-4 h-4 mr-2" /> Remover</Button>
        </CardFooter>
      </Card>
        );
      })()}
    </motion.div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-8">
      <UserLlmConnectionDialog
        isOpen={isLlmDialogOpen}
        setIsOpen={setIsLlmDialogOpen}
        editingConnection={editingConnection}
        onFinished={() => {
          setEditingConnection(null);
          fetchConnections();
        }}
      />
      <UserImageConnectionDialog
        isOpen={isImageDialogOpen}
        setIsOpen={setIsImageDialogOpen}
        editingConnection={editingConnection}
        onFinished={() => {
          setEditingConnection(null);
          fetchConnections();
        }}
      />
      <UserSiteBuilderConnectionDialog
        isOpen={isSiteBuilderDialogOpen}
        setIsOpen={setIsSiteBuilderDialogOpen}
        editingConnection={editingConnection}
        onFinished={() => {
          setEditingConnection(null);
          fetchConnections();
        }}
      />

      {/* LLM Connections */}
      <section>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Conexões de Modelos de Linguagem</h2>
            <p className="text-muted-foreground">Adicione e gerencie suas chaves de API para usar com o Chat de IA.</p>
          </div>
          <Button onClick={() => { setEditingConnection(null); setIsLlmDialogOpen(true); }} className="mt-4 sm:mt-0 glow-effect">
            <Plus className="w-4 h-4 mr-2" /> Nova Conexão de LLM
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {llmConnections.map((conn, index) => renderConnectionCard(conn, index, 'llm'))}
          </AnimatePresence>
        </div>
        {llmConnections.length === 0 && (
          <div className="text-center py-8 px-4 border-2 border-dashed rounded-lg">
            <Bot className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-sm font-semibold text-foreground">Nenhuma conexão de LLM</h3>
            <p className="mt-1 text-sm text-muted-foreground">Adicione uma chave de API para começar a conversar.</p>
          </div>
        )}
      </section>

      <div className="border-b border-border"></div>

      {/* Image Connections */}
      <section>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Conexões de Geração de Imagem</h2>
            <p className="text-muted-foreground">Adicione e gerencie suas chaves de API para usar com o Gerador de Imagens.</p>
          </div>
          <Button onClick={() => { setEditingConnection(null); setIsImageDialogOpen(true); }} className="mt-4 sm:mt-0 glow-effect">
            <Plus className="w-4 h-4 mr-2" /> Nova Conexão de Imagem
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {imageConnections.map((conn, index) => renderConnectionCard(conn, index, 'image'))}
          </AnimatePresence>
        </div>
        {imageConnections.length === 0 && (
          <div className="text-center py-8 px-4 border-2 border-dashed rounded-lg">
            <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-sm font-semibold text-foreground">Nenhuma conexão de imagem</h3>
            <p className="mt-1 text-sm text-muted-foreground">Adicione uma chave de API para começar a gerar imagens.</p>
          </div>
        )}
      </section>

      <div className="border-b border-border"></div>

      {/* Site Builder Connections */}
      <section>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Conexão para Criador de Site</h2>
            <p className="text-muted-foreground">Gerencie a chave de API para o assistente do Criador de Sites.</p>
          </div>
          <Button onClick={() => { setEditingConnection(null); setIsSiteBuilderDialogOpen(true); }} className="mt-4 sm:mt-0 glow-effect">
            <Plus className="w-4 h-4 mr-2" /> Nova Conexão para Criador de Site
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {siteBuilderConnections.map((conn, index) => renderConnectionCard(conn, index, 'site_builder'))}
          </AnimatePresence>
        </div>
        {siteBuilderConnections.length === 0 && (
          <div className="text-center py-8 px-4 border-2 border-dashed rounded-lg">
            <Construction className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-sm font-semibold text-foreground">Nenhuma conexão para o Criador de Site</h3>
            <p className="mt-1 text-sm text-muted-foreground">Adicione uma chave de API para habilitar o assistente.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default UserAiSettings;