import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Copy, CopyCheck, Eye, EyeOff } from 'lucide-react';

const SMTP_KEYS = {
  siteUrl: 'smtp_site_url',
  allowList: 'smtp_uri_allow_list',
  host: 'smtp_host',
  port: 'smtp_port',
  user: 'smtp_user',
  pass: 'smtp_pass',
  adminEmail: 'smtp_admin_email',
  senderName: 'smtp_sender_name',
  portainerUrl: 'portainer_url',
  portainerApiKey: 'portainer_api_key',
  portainerEndpointId: 'portainer_endpoint_id',
  portainerStackId: 'portainer_stack_id',
  portainerAuthServiceName: 'portainer_auth_service_name',
};

const defaultForm = {
  siteUrl: 'https://neuro.jbapex.com.br',
  allowList: 'https://neuro.jbapex.com.br,https://neuro.jbapex.com.br/ferramentas',
  host: '',
  port: '587',
  user: '',
  pass: '',
  adminEmail: '',
  senderName: 'Neuro Apice',
  portainerUrl: '',
  portainerApiKey: '',
  portainerEndpointId: '',
  portainerStackId: '',
  portainerAuthServiceName: 'supabase_auth',
};

const EmailSmtpSettings = () => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', Object.values(SMTP_KEYS));
    if (error) {
      toast({ title: 'Erro ao carregar configurações SMTP', description: error.message, variant: 'destructive' });
      return;
    }
    const dict = Object.fromEntries((data || []).map((x) => [x.key, x.value ?? '']));
    setForm({
      siteUrl: dict[SMTP_KEYS.siteUrl] || defaultForm.siteUrl,
      allowList: dict[SMTP_KEYS.allowList] || defaultForm.allowList,
      host: dict[SMTP_KEYS.host] || '',
      port: dict[SMTP_KEYS.port] || '587',
      user: dict[SMTP_KEYS.user] || '',
      pass: dict[SMTP_KEYS.pass] || '',
      adminEmail: dict[SMTP_KEYS.adminEmail] || '',
      senderName: dict[SMTP_KEYS.senderName] || 'Neuro Apice',
      portainerUrl: dict[SMTP_KEYS.portainerUrl] || '',
      portainerApiKey: dict[SMTP_KEYS.portainerApiKey] || '',
      portainerEndpointId: dict[SMTP_KEYS.portainerEndpointId] || '',
      portainerStackId: dict[SMTP_KEYS.portainerStackId] || '',
      portainerAuthServiceName: dict[SMTP_KEYS.portainerAuthServiceName] || 'supabase_auth',
    });
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const smtpBlock = useMemo(
    () => `environment:
  GOTRUE_SITE_URL: ${form.siteUrl || 'https://seu-dominio.com'}
  GOTRUE_URI_ALLOW_LIST: ${form.allowList || 'https://seu-dominio.com'}

  GOTRUE_SMTP_HOST: ${form.host || 'smtp.seuprovedor.com'}
  GOTRUE_SMTP_PORT: ${form.port || '587'}
  GOTRUE_SMTP_USER: ${form.user || 'seu_usuario_smtp'}
  GOTRUE_SMTP_PASS: ${form.pass || 'sua_senha_smtp'}
  GOTRUE_SMTP_ADMIN_EMAIL: ${form.adminEmail || 'acesso@seu-dominio.com'}
  GOTRUE_SMTP_SENDER_NAME: ${form.senderName || 'Neuro Apice'}`,
    [form]
  );

  const save = async () => {
    setSaving(true);
    const rows = [
      { key: SMTP_KEYS.siteUrl, value: form.siteUrl },
      { key: SMTP_KEYS.allowList, value: form.allowList },
      { key: SMTP_KEYS.host, value: form.host },
      { key: SMTP_KEYS.port, value: form.port },
      { key: SMTP_KEYS.user, value: form.user },
      { key: SMTP_KEYS.pass, value: form.pass },
      { key: SMTP_KEYS.adminEmail, value: form.adminEmail },
      { key: SMTP_KEYS.senderName, value: form.senderName },
      { key: SMTP_KEYS.portainerUrl, value: form.portainerUrl },
      { key: SMTP_KEYS.portainerApiKey, value: form.portainerApiKey },
      { key: SMTP_KEYS.portainerEndpointId, value: form.portainerEndpointId },
      { key: SMTP_KEYS.portainerStackId, value: form.portainerStackId },
      { key: SMTP_KEYS.portainerAuthServiceName, value: form.portainerAuthServiceName || 'supabase_auth' },
    ].map((r) => ({ ...r, updated_at: new Date().toISOString() }));

    const { error } = await supabase.from('system_settings').upsert(rows, { onConflict: 'key' });
    if (error) {
      toast({ title: 'Erro ao salvar SMTP', description: error.message, variant: 'destructive' });
      setSaving(false);
      return;
    }
    toast({ title: 'Configurações SMTP salvas com sucesso' });
    setSaving(false);
  };

  const applyOnServer = async () => {
    setApplying(true);
    const { data, error } = await supabase.functions.invoke('apply-smtp-portainer', { body: {} });
    if (error) {
      toast({ title: 'Falha ao aplicar SMTP no servidor', description: error.message, variant: 'destructive' });
      setApplying(false);
      return;
    }
    toast({
      title: 'SMTP aplicado com sucesso no servidor',
      description: data?.message || 'Stack atualizada e serviço de auth reiniciado.',
    });
    setApplying(false);
  };

  const copyBlock = async () => {
    await navigator.clipboard.writeText(smtpBlock);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Mail className="w-7 h-7" />
          Configurações de E-mail (SMTP)
        </h1>
        <p className="text-muted-foreground">
          Configure os dados SMTP e copie o bloco pronto para aplicar no serviço <code>supabase_auth</code> no Portainer.
        </p>
      </div>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardContent className="pt-6 text-sm text-amber-700 dark:text-amber-300">
          Salve os dados primeiro. Depois aplique no servidor para o serviço de autenticação carregar as variáveis.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuração SMTP</CardTitle>
          <CardDescription>Esses campos serão usados para autenticação por e-mail e reset de senha.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Site URL</Label>
            <Input value={form.siteUrl} onChange={(e) => setField('siteUrl', e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>URI Allow List</Label>
            <Input value={form.allowList} onChange={(e) => setField('allowList', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>SMTP Host</Label>
            <Input value={form.host} onChange={(e) => setField('host', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>SMTP Port</Label>
            <Input value={form.port} onChange={(e) => setField('port', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>SMTP User</Label>
            <Input value={form.user} onChange={(e) => setField('user', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>SMTP Pass</Label>
            <div className="flex items-center gap-2">
              <Input type={showPass ? 'text' : 'password'} value={form.pass} onChange={(e) => setField('pass', e.target.value)} />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowPass((v) => !v)}>
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>SMTP Admin Email</Label>
            <Input value={form.adminEmail} onChange={(e) => setField('adminEmail', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>SMTP Sender Name</Label>
            <Input value={form.senderName} onChange={(e) => setField('senderName', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integração Portainer</CardTitle>
          <CardDescription>Dados para aplicar automaticamente as variáveis no stack.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Portainer URL</Label>
            <Input value={form.portainerUrl} onChange={(e) => setField('portainerUrl', e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Portainer API Key</Label>
            <div className="flex items-center gap-2">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={form.portainerApiKey}
                onChange={(e) => setField('portainerApiKey', e.target.value)}
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowApiKey((v) => !v)}>
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Endpoint ID</Label>
            <Input value={form.portainerEndpointId} onChange={(e) => setField('portainerEndpointId', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Stack ID</Label>
            <Input value={form.portainerStackId} onChange={(e) => setField('portainerStackId', e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Auth Service Name</Label>
            <Input value={form.portainerAuthServiceName} onChange={(e) => setField('portainerAuthServiceName', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bloco pronto para Portainer</CardTitle>
          <CardDescription>Copie e use no compose/env do serviço de auth.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={smtpBlock} readOnly className="min-h-[220px] font-mono text-xs" />
          <Button type="button" variant="outline" onClick={copyBlock}>
            {copied ? <CopyCheck className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? 'Copiado' : 'Copiar bloco'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar SMTP'}
        </Button>
        <Button type="button" variant="secondary" onClick={applyOnServer} disabled={applying}>
          {applying ? 'Aplicando...' : 'Aplicar no servidor'}
        </Button>
      </div>
    </div>
  );
};

export default EmailSmtpSettings;
