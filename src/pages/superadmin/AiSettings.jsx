import React from 'react';
import { motion } from 'framer-motion';
import { Wand2, Image as ImageIcon, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import ConnectionsTab from './ai-settings/ConnectionsTab';
import ImageConnectionsTab from './ai-settings/ImageConnectionsTab';
import ImagePresetsTab from './ai-settings/ImagePresetsTab';
import LogosLlmTab from './ai-settings/LogosLlmTab';
import BrandingSettings from './BrandingSettings';
import LandingSettings from './LandingSettings';

const AiSettings = () => {
  return (
    <div className="space-y-8 p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Configurações de IA</h1>
        <p className="text-muted-foreground">Gerencie suas conexões com LLMs, provedores de imagem e presets.</p>
      </motion.div>

      <Tabs defaultValue="connections" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-6">
          <TabsTrigger value="connections"><Wand2 className="w-4 h-4 mr-2" />Conexões LLM</TabsTrigger>
          <TabsTrigger value="image-connections"><ImageIcon className="w-4 h-4 mr-2" />Conexões Imagem</TabsTrigger>
          <TabsTrigger value="image-presets"><Settings className="w-4 h-4 mr-2" />Presets Imagem</TabsTrigger>
          <TabsTrigger value="logos"><ImageIcon className="w-4 h-4 mr-2" />Logos LLM</TabsTrigger>
          <TabsTrigger value="branding"><ImageIcon className="w-4 h-4 mr-2" />Logo sistema</TabsTrigger>
          <TabsTrigger value="landing"><ImageIcon className="w-4 h-4 mr-2" />Landing Page</TabsTrigger>
        </TabsList>
        <TabsContent value="connections" className="mt-6">
          <ConnectionsTab />
        </TabsContent>
        <TabsContent value="image-connections" className="mt-6">
          <ImageConnectionsTab />
        </TabsContent>
        <TabsContent value="image-presets" className="mt-6">
          <ImagePresetsTab />
        </TabsContent>
        <TabsContent value="logos" className="mt-6">
          <LogosLlmTab />
        </TabsContent>
        <TabsContent value="branding" className="mt-6">
          <BrandingSettings />
        </TabsContent>
        <TabsContent value="landing" className="mt-6">
          <LandingSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AiSettings;