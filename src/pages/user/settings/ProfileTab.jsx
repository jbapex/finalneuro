import React, { useState, useEffect } from 'react';
    import { useForm } from 'react-hook-form';
    import { zodResolver } from '@hookform/resolvers/zod';
    import * as z from 'zod';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useToast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
    import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

    const profileSchema = z.object({
        name: z.string().min(2, { message: 'O nome deve ter pelo menos 2 caracteres.' }),
        email: z.string().email({ message: 'Por favor, insira um email válido.' }),
    });

    const passwordSchema = z
        .object({
            newPassword: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres.' }),
            confirmPassword: z.string(),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
            message: 'As senhas não coincidem.',
            path: ['confirmPassword'],
        });
    
    const ProfileTab = () => {
        const { user, profile, refreshProfile } = useAuth();
        const { toast } = useToast();
        const [isSubmitting, setIsSubmitting] = useState(false);
        const [passwordSubmitting, setPasswordSubmitting] = useState(false);

        const passwordForm = useForm({
            resolver: zodResolver(passwordSchema),
            defaultValues: { newPassword: '', confirmPassword: '' },
        });
    
        const form = useForm({
            resolver: zodResolver(profileSchema),
            defaultValues: {
                name: '',
                email: '',
            },
        });
    
        useEffect(() => {
            if (user && profile) {
                form.reset({
                    name: profile.name || user.user_metadata?.name || '',
                    email: user.email,
                });
            }
        }, [user, profile, form]);
    
        const onSubmit = async (values) => {
            setIsSubmitting(true);
            
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ name: values.name })
                .eq('id', user.id);
    
            if (profileError) {
                toast({
                    title: 'Erro ao atualizar perfil',
                    description: profileError.message,
                    variant: 'destructive',
                });
                setIsSubmitting(false);
                return;
            }
    
            let emailUpdated = false;
            if (values.email !== user.email) {
                const { error: emailError } = await supabase.auth.updateUser({ email: values.email });
                if (emailError) {
                    toast({
                        title: 'Erro ao atualizar e-mail',
                        description: emailError.message,
                        variant: 'destructive',
                    });
                } else {
                    emailUpdated = true;
                }
            }
    
            await refreshProfile();
    
            toast({
                title: 'Perfil atualizado!',
                description: `Seu perfil foi salvo. ${emailUpdated ? 'Verifique seu novo e-mail para confirmação.' : ''}`,
            });
    
            setIsSubmitting(false);
        };

        const onPasswordSubmit = async (values) => {
            setPasswordSubmitting(true);
            const { error } = await supabase.auth.updateUser({ password: values.newPassword });
            if (error) {
                toast({
                    title: 'Erro ao alterar senha',
                    description: error.message,
                    variant: 'destructive',
                });
            } else {
                passwordForm.reset({ newPassword: '', confirmPassword: '' });
                toast({
                    title: 'Senha atualizada',
                    description: 'Sua nova senha já está em vigor.',
                });
            }
            setPasswordSubmitting(false);
        };
    
        if (!user || !profile) {
            return <div>Carregando perfil...</div>;
        }
    
        return (
            <>
            <Card>
                <CardHeader>
                    <CardTitle>Perfil</CardTitle>
                    <CardDescription>Atualize suas informações de perfil.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nome</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Seu nome" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>E-mail</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="seu@email.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
            <Card className="mt-6">
                <CardHeader>
                    <CardTitle>Alterar senha</CardTitle>
                    <CardDescription>Defina uma nova senha para sua conta.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...passwordForm}>
                        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                            <FormField
                                control={passwordForm.control}
                                name="newPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nova senha</FormLabel>
                                        <FormControl>
                                            <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={passwordForm.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirmar nova senha</FormLabel>
                                        <FormControl>
                                            <Input type="password" autoComplete="new-password" placeholder="••••••••" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={passwordSubmitting}>
                                {passwordSubmitting ? 'Atualizando...' : 'Atualizar senha'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
            </>
        );
    };
    
    export default ProfileTab;