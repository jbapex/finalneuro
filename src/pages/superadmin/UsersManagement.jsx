import React, { useState, useEffect, useCallback } from 'react';
    import { motion } from 'framer-motion';
    import { useToast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { fetchNeurodesignCarouselFlags, setNeurodesignCarouselAccess } from '@/lib/neurodesignCarouselAccess';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
    import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
    import { MoreHorizontal, Edit, BrainCircuit } from 'lucide-react';
    import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Label } from '@/components/ui/label';
    import { Switch } from '@/components/ui/switch';
    import { Badge } from '@/components/ui/badge';
    import { useForm, Controller } from 'react-hook-form';
    import { zodResolver } from '@hookform/resolvers/zod';
    import * as z from 'zod';
    import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
    
    const userSchema = z.object({
        name: z.string().min(2, "Nome é obrigatório"),
        email: z.string().email("E-mail inválido"),
        user_type: z.enum(['user', 'admin']),
        plan_id: z.number().nullable(),
        module_ids: z.array(z.number()),
        has_site_builder_access: z.boolean(),
        has_ads_access: z.boolean(),
        has_strategic_planner_access: z.boolean(),
        has_custom_ai_access: z.boolean(),
        neurodesign_carousel_access: z.boolean(),
    });

    const UsersManagement = () => {
      const { toast } = useToast();
      const [users, setUsers] = useState([]);
      const [plans, setPlans] = useState([]);
      const [modules, setModules] = useState([]);
      const [searchTerm, setSearchTerm] = useState('');
      const [isFormOpen, setIsFormOpen] = useState(false);
      const [editingUser, setEditingUser] = useState(null);

      const form = useForm({
        resolver: zodResolver(userSchema),
        defaultValues: {
            name: '',
            email: '',
            user_type: 'user',
            plan_id: null,
            module_ids: [],
            has_site_builder_access: false,
            has_ads_access: false,
            has_strategic_planner_access: false,
            has_custom_ai_access: false,
            neurodesign_carousel_access: false,
        },
      });

      const fetchData = useCallback(async () => {
        const { data: usersData, error: usersError } = await supabase.rpc('get_all_users_with_details');
        if (usersError) {
          toast({ title: 'Erro ao carregar usuários', description: usersError.message, variant: 'destructive' });
          setUsers([]);
        } else {
          const base = usersData || [];
          const ids = base.map((u) => u.id).filter(Boolean);
          if (ids.length === 0) {
            setUsers(base);
          } else {
            const { rows: flags, error: flagsError } = await fetchNeurodesignCarouselFlags(supabase, ids);
            if (flagsError) {
              setUsers(base.map((u) => ({ ...u, neurodesign_carousel_access: false })));
            } else {
              const map = Object.fromEntries((flags || []).map((f) => [f.id, Boolean(f.neurodesign_carousel_access)]));
              setUsers(base.map((u) => ({ ...u, neurodesign_carousel_access: map[u.id] ?? false })));
            }
          }
        }
        
        const { data: plansData, error: plansError } = await supabase.from('plans').select('id, name');
        if (plansError) toast({ title: 'Erro ao carregar planos', description: plansError.message, variant: 'destructive' });
        else setPlans(plansData || []);

        const { data: modulesData, error: modulesError } = await supabase.rpc('get_all_active_modules');
        if (modulesError) toast({ title: 'Erro ao carregar módulos', description: modulesError.message, variant: 'destructive' });
        else setModules(modulesData || []);
      }, [toast]);
    
      useEffect(() => {
        fetchData();
      }, [fetchData]);
    
      const handleEdit = (user) => {
        setEditingUser(user);
        form.reset({
            name: user.name,
            email: user.email,
            user_type: user.user_type,
            plan_id: user.plan_id,
            module_ids: user.module_ids || [],
            has_site_builder_access: user.has_site_builder_access || false,
            has_ads_access: user.has_ads_access || false,
            has_strategic_planner_access: user.has_strategic_planner_access || false,
            has_custom_ai_access: user.has_custom_ai_access || false,
            neurodesign_carousel_access: user.neurodesign_carousel_access || false,
        });
        setIsFormOpen(true);
      };

      const handleCloseForm = () => {
          setEditingUser(null);
          setIsFormOpen(false);
          form.reset();
      };
    
      const onSubmit = async (data) => {
        if (!editingUser) return;
        
        const { module_ids, email, neurodesign_carousel_access, ...profileData } = data;

        const { error: profileError } = await supabase
            .from('profiles')
            .update(profileData)
            .eq('id', editingUser.id);
        
        if (profileError) {
            toast({ title: 'Erro ao atualizar perfil', description: profileError.message, variant: 'destructive' });
            return;
        }

        const { error: carouselError } = await setNeurodesignCarouselAccess(
          supabase,
          editingUser.id,
          neurodesign_carousel_access
        );
        if (carouselError) {
          toast({ title: 'Erro ao atualizar acesso Carrossel', description: carouselError.message, variant: 'destructive' });
          return;
        }

        const { error: deleteModulesError } = await supabase.from('user_modules').delete().eq('user_id', editingUser.id);
        if (deleteModulesError) { 
            toast({ title: 'Erro ao limpar módulos antigos', description: deleteModulesError.message, variant: 'destructive' });
        }
        
        if (module_ids && module_ids.length > 0) {
            const modulesToInsert = module_ids.map(module_id => ({ user_id: editingUser.id, module_id }));
            const { error: insertModulesError } = await supabase.from('user_modules').insert(modulesToInsert);
            if (insertModulesError) {
                toast({ title: 'Erro ao atribuir novos módulos', description: insertModulesError.message, variant: 'destructive' });
            }
        }

        toast({ title: 'Usuário atualizado com sucesso!' });
        handleCloseForm();
        fetchData();
      };

      const filteredUsers = users.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    
      return (
        <div className="space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                <h1 className="text-3xl font-bold gradient-text">Gerenciamento de Usuários</h1>
                <p className="text-muted-foreground">Visualize e gerencie todos os usuários da plataforma.</p>
            </motion.div>
    
            <div className="flex justify-between items-center">
                <Input
                    placeholder="Buscar por nome ou e-mail..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                />
            </div>
    
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }}>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead className="hidden md:table-cell">Plano</TableHead>
                            <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                            <TableHead className="hidden lg:table-cell">Acessos</TableHead>
                            <TableHead className="hidden xl:table-cell">Atualizado em</TableHead>
                            <TableHead><span className="sr-only">Ações</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.map(user => (
                            <TableRow key={user.id}>
                                <TableCell>
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-sm text-muted-foreground">{user.email}</div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">{plans.find(p => p.id === user.plan_id)?.name || 'Nenhum'}</TableCell>
                                <TableCell className="hidden lg:table-cell"><Badge variant={user.user_type === 'admin' ? 'default' : 'secondary'}>{user.user_type}</Badge></TableCell>
                                <TableCell className="hidden lg:table-cell">
                                    <div className="flex flex-wrap gap-1">
                                        {user.has_site_builder_access && <Badge variant="outline">Sites</Badge>}
                                        {user.has_ads_access && <Badge variant="outline">Anúncios</Badge>}
                                        {user.has_strategic_planner_access && <Badge variant="outline">Planner</Badge>}
                                        {user.has_custom_ai_access && <Badge variant="outline" className="text-primary border-primary">IA Custom</Badge>}
                                        {user.neurodesign_carousel_access && <Badge variant="outline">Carrossel ND</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell className="hidden xl:table-cell">{new Date(user.updated_at).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEdit(user)}><Edit className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </motion.div>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-[625px]">
                    <DialogHeader>
                        <DialogTitle>Editar Usuário</DialogTitle>
                        <DialogDescription>Altere as informações e permissões do usuário.</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-6">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItemRow><FormLabel>Nome</FormLabel><FormControl><Input {...field} /></FormControl></FormItemRow>)} />
                            <FormField control={form.control} name="email" render={({ field }) => (<FormItemRow><FormLabel>E-mail</FormLabel><FormControl><Input type="email" {...field} disabled /></FormControl></FormItemRow>)} />
                            
                            <FormField
                                control={form.control} name="plan_id"
                                render={({ field }) => (
                                    <FormItemRow>
                                        <FormLabel>Plano</FormLabel>
                                        <Select onValueChange={(v) => field.onChange(v === 'none' ? null : Number(v))} value={field.value ? String(field.value) : 'none'}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Nenhum Plano</SelectItem>
                                                {plans.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItemRow>
                                )}
                            />

                            <div className="space-y-2 p-4 border rounded-md">
                                <h4 className="font-semibold text-sm">Permissões de Ferramentas</h4>
                                <FormField control={form.control} name="has_site_builder_access" render={({ field }) => (<SwitchItem field={field} label="Acesso ao Criador de Sites" />)} />
                                <FormField control={form.control} name="has_ads_access" render={({ field }) => (<SwitchItem field={field} label="Acesso ao Criador de Anúncios" />)} />
                                <FormField control={form.control} name="has_strategic_planner_access" render={({ field }) => (<SwitchItem field={field} label="Acesso ao Planejador Estratégico" />)} />
                                <FormField control={form.control} name="has_custom_ai_access" render={({ field }) => (<SwitchItem field={field} label="Acesso à Conexão de IA Personalizada" icon={BrainCircuit} />)} />
                                <FormField control={form.control} name="neurodesign_carousel_access" render={({ field }) => (<SwitchItem field={field} label="NeuroDesign: aba Carrossel (acesso antecipado)" />)} />
                            </div>

                            <Controller
                                control={form.control} name="module_ids"
                                render={({ field }) => (
                                    <div className="space-y-2 p-4 border rounded-md">
                                        <h4 className="font-semibold text-sm">Módulos Individuais</h4>
                                        <div className="max-h-40 overflow-y-auto space-y-2">
                                            {modules.map(module => (
                                                <div key={module.id} className="flex items-center space-x-2">
                                                    <input
                                                        type="checkbox"
                                                        id={`module-${module.id}`}
                                                        checked={field.value?.includes(module.id)}
                                                        onChange={(e) => {
                                                            const currentValues = field.value || [];
                                                            const newValues = e.target.checked
                                                                ? [...currentValues, module.id]
                                                                : currentValues.filter(id => id !== module.id);
                                                            field.onChange(newValues);
                                                        }}
                                                    />
                                                    <Label htmlFor={`module-${module.id}`}>{module.name}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            />
                        
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={handleCloseForm}>Cancelar</Button>
                                <Button type="submit">Salvar Alterações</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
      );
    };

    const FormItemRow = ({ children }) => <div className="grid grid-cols-4 items-center gap-4">{children}</div>;
    const SwitchItem = ({ field, label, icon: Icon }) => (
        <FormItem className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4 text-muted-foreground"/>}
                <FormLabel htmlFor={field.name}>{label}</FormLabel>
            </div>
            <FormControl>
                <Switch id={field.name} checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
        </FormItem>
    );
    
    export default UsersManagement;