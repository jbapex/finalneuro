import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Edit, Trash2, BrainCircuit, Power, PowerOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { getModuleGeneratorCategoryMetas } from '@/lib/modules/generatorCategories';

const ModuleCard = ({ module, index, onEdit, onDelete, onToggleStatus }) => {
  const categoryMetas = getModuleGeneratorCategoryMetas(module.config);
  return (
    <motion.div
      key={module.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
    >
      <Card className={cn(
        "bg-card hover:border-primary/50 transition-all duration-300 h-full flex flex-col",
        !module.is_active && "bg-muted/50 border-dashed"
      )}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3">
              <Bot className={cn("w-6 h-6 text-muted-foreground", !module.is_active && "opacity-50")} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className={cn("text-foreground", !module.is_active && "text-muted-foreground")}>{module.name}</CardTitle>
                  {categoryMetas.map((meta) => (
                    <Badge key={meta.id} variant="secondary" className="text-[10px] font-normal shrink-0">
                      {meta.shortLabel}
                    </Badge>
                  ))}
                </div>
                <CardDescription className="text-muted-foreground">{module.description}</CardDescription>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="ghost" size="icon" onClick={() => onEdit(!!module.config, module)} className="text-muted-foreground hover:text-foreground"><Edit className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => onDelete(module.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col justify-between">
          <p className={cn(
            "text-sm text-muted-foreground italic whitespace-pre-wrap break-words mb-4",
            !module.is_active && "opacity-60"
          )}>
            "{module.base_prompt.substring(0, 100)}{module.base_prompt.length > 100 ? '...' : ''}"
          </p>
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground border-t border-border pt-3">
              <BrainCircuit className="w-4 h-4"/>
              <span>
                  {module.llm_integration ? `Cérebro: ${module.llm_integration.name}` : 'Cérebro: Padrão do Sistema'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                <div className="flex items-center gap-2">
                    {module.is_active ? <Power className="w-4 h-4 text-green-500" /> : <PowerOff className="w-4 h-4 text-red-500" />}
                    <Label htmlFor={`status-switch-${module.id}`} className={cn("font-medium", module.is_active ? "text-green-500" : "text-red-500")}>
                        {module.is_active ? 'Ativo' : 'Inativo'}
                    </Label>
                </div>
                <Switch
                    id={`status-switch-${module.id}`}
                    checked={module.is_active}
                    onCheckedChange={(checked) => onToggleStatus(module, checked)}
                />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ModuleCard;