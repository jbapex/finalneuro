import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseUrl } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Copy, Plus, Trash2, Webhook } from 'lucide-react';

const SETTINGS_KEYS = {
  secret: 'kiwify_webhook_secret',
  planMap: 'kiwify_product_plan_map',
  freePlan: 'kiwify_free_plan_id',
  siteUrl: 'kiwify_site_url',
};

const PROCESS_STATUS_MAP = {
  pending: { label: 'Pendente', className: 'bg-yellow-500/20 text-yellow-700 border-yellow-400/30' },
  success: { label: 'Sucesso', className: 'bg-green-500/20 text-green-700 border-green-400/30' },
  error: { label: 'Erro', className: 'bg-red-500/20 text-red-700 border-red-400/30' },
  ignored: { label: 'Ignorado', className: 'bg-muted/80 text-muted-foreground border-border' },
};

const ORDER_STATUS_MAP = {
  paid: { label: 'Pago', className: 'bg-green-500/20 text-green-700 border-green-400/30' },
  active: { label: 'Ativo', className: 'bg-green-500/20 text-green-700 border-green-400/30' },
  complete: { label: 'Completo', className: 'bg-green-500/20 text-green-700 border-green-400/30' },
  approved: { label: 'Aprovado', className: 'bg-green-500/20 text-green-700 border-green-400/30' },
  refunded: { label: 'Reembolsado', className: 'bg-orange-500/20 text-orange-700 border-orange-400/30' },
  chargedback: { label: 'Chargeback', className: 'bg-red-500/20 text-red-700 border-red-400/30' },
  cancelled: { label: 'Cancelado', className: 'bg-red-500/20 text-red-700 border-red-400/30' },
  suspended: { label: 'Suspenso', className: 'bg-red-500/20 text-red-700 border-red-400/30' },
  waiting_payment: { label: 'Aguardando', className: 'bg-blue-500/20 text-blue-700 border-blue-400/30' },
  abandoned: { label: 'Abandonado', className: 'bg-muted/80 text-muted-foreground border-border' },
};

function StatusBadge({ value, map }) {
  const key = String(value || '').toLowerCase();
  const item = map[key];
  if (!item) return <Badge variant="outline">{value || '-'}</Badge>;
  return <Badge variant="outline" className={item.className}>{item.label}</Badge>;
}

const PAGE_SIZE = 20;

const KiwifyIntegration = () => {
  const { toast } = useToast();
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [freePlanId, setFreePlanId] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [mapRows, setMapRows] = useState([{ productId: '', planId: '' }]);
  const [plans, setPlans] = useState([]);
  const [saving, setSaving] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);

  const webhookUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/kiwify-webhook` : '—';

  const loadSettings = useCallback(async () => {
    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', Object.values(SETTINGS_KEYS));
    if (error) {
      toast({ title: 'Erro ao carregar integrações', description: error.message, variant: 'destructive' });
      return;
    }
    const dict = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
    setSecret(dict[SETTINGS_KEYS.secret] || '');
    setFreePlanId(dict[SETTINGS_KEYS.freePlan] || '');
    setSiteUrl(dict[SETTINGS_KEYS.siteUrl] || '');
    try {
      const parsed = dict[SETTINGS_KEYS.planMap] ? JSON.parse(dict[SETTINGS_KEYS.planMap]) : {};
      const rows = Object.entries(parsed).map(([productId, planId]) => ({
        productId,
        planId: String(planId),
      }));
      setMapRows(rows.length ? rows : [{ productId: '', planId: '' }]);
    } catch {
      setMapRows([{ productId: '', planId: '' }]);
    }
  }, [toast]);

  const loadPlans = useCallback(async () => {
    const { data, error } = await supabase.from('plans').select('id, name').order('id');
    if (!error) setPlans(data || []);
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoadingTx(true);
    let query = supabase
      .from('kiwify_transactions')
      .select(
        'id, order_id, buyer_email, buyer_name, product_name, order_status, processed_status, error_message, price, plan_id, received_at'
      )
      .order('received_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (statusFilter !== 'all') query = query.eq('processed_status', statusFilter);
    const { data } = await query;
    setTransactions(data || []);
    setLoadingTx(false);
  }, [page, statusFilter]);

  useEffect(() => {
    loadSettings();
    loadPlans();
  }, [loadSettings, loadPlans]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const persistSetting = async (key, value) => {
    const { error } = await supabase.from('system_settings').upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    if (error) throw error;
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const mapValue = {};
      mapRows.forEach(({ productId, planId }) => {
        if (String(productId || '').trim() && String(planId || '').trim()) {
          mapValue[String(productId).trim()] = Number(planId);
        }
      });
      await Promise.all([
        persistSetting(SETTINGS_KEYS.secret, secret),
        persistSetting(SETTINGS_KEYS.planMap, JSON.stringify(mapValue)),
        persistSetting(SETTINGS_KEYS.freePlan, freePlanId || ''),
        persistSetting(SETTINGS_KEYS.siteUrl, siteUrl || ''),
      ]);
      toast({ title: 'Configurações salvas', description: 'Webhook Kiwify atualizado com sucesso.' });
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: e.message || String(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const txStatusOptions = useMemo(
    () => [
      { value: 'all', label: 'Todas' },
      { value: 'pending', label: 'Pendentes' },
      { value: 'success', label: 'Sucesso' },
      { value: 'error', label: 'Erro' },
      { value: 'ignored', label: 'Ignoradas' },
    ],
    []
  );

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(String(value || ''));
      toast({ title: 'Copiado', description: `${label} copiado para a área de transferência.` });
    } catch {
      toast({ title: 'Falha ao copiar', description: 'Copie manualmente.', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Webhook className="h-6 w-6 text-primary" />
          Integração Kiwify
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure o webhook da Kiwify para ativar e desativar planos automaticamente.
        </p>
      </div>

      <Tabs defaultValue="settings" className="w-full">
        <TabsList>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="transactions">Transações</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">URL do Webhook</CardTitle>
              <CardDescription>
                Copie esta URL e cole no painel da Kiwify em <strong>Configurações → Webhook</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input readOnly value={webhookUrl} />
                <Button type="button" variant="outline" size="icon" onClick={() => copyText(webhookUrl, 'URL do Webhook')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Configure o método como POST e o Content-Type como application/json.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Token Secreto</CardTitle>
              <CardDescription>Gerado no painel da Kiwify. Usado para validar a autenticidade de cada chamada.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="Cole o token secreto da Kiwify"
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowSecret((v) => !v)}>
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="outline" size="icon" onClick={() => copyText(secret, 'Token secreto')}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mapeamento Produto - Plano</CardTitle>
              <CardDescription>
                Para cada produto da Kiwify, defina qual plano do sistema será ativado na compra.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {mapRows.map((row, idx) => (
                <div key={`map-${idx}`} className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">ID do Produto (Kiwify)</Label>
                    <Input
                      value={row.productId}
                      onChange={(e) =>
                        setMapRows((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, productId: e.target.value } : item))
                        )
                      }
                      placeholder="ex.: G7yP1fB"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Plano do Sistema</Label>
                    <Select
                      value={row.planId || ''}
                      onValueChange={(value) =>
                        setMapRows((prev) => prev.map((item, i) => (i === idx ? { ...item, planId: value } : item)))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      disabled={mapRows.length === 1}
                      onClick={() => setMapRows((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => setMapRows((prev) => [...prev, { productId: '', planId: '' }])}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar produto
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Plano no Cancelamento</CardTitle>
              <CardDescription>Plano para o qual o usuário será movido ao cancelar/reembolsar a assinatura.</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={freePlanId || ''} onValueChange={setFreePlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">URL do Sistema</CardTitle>
              <CardDescription>
                Usada como destino nos links enviados nos e-mails de boas-vindas e magic link.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://seu-dominio.com.br/ferramentas" />
            </CardContent>
          </Card>

          <div>
            <Button type="button" onClick={saveSettings} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Transações recebidas</CardTitle>
              <CardDescription>Histórico de chamadas processadas pelo webhook da Kiwify.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>Status:</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {txStatusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Comprador</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Status pedido</TableHead>
                      <TableHead>Status proc.</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Erro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!loadingTx && transactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-muted-foreground">
                          Nenhuma transação encontrada.
                        </TableCell>
                      </TableRow>
                    )}
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{tx.received_at ? new Date(tx.received_at).toLocaleString('pt-BR') : '-'}</TableCell>
                        <TableCell>{tx.order_id || '-'}</TableCell>
                        <TableCell>
                          <div className="text-sm">{tx.buyer_name || '-'}</div>
                          <div className="text-xs text-muted-foreground">{tx.buyer_email || '-'}</div>
                        </TableCell>
                        <TableCell>{tx.product_name || '-'}</TableCell>
                        <TableCell>
                          <StatusBadge value={tx.order_status} map={ORDER_STATUS_MAP} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge value={tx.processed_status} map={PROCESS_STATUS_MAP} />
                        </TableCell>
                        <TableCell>{tx.plan_id || '-'}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{tx.error_message || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">Página {page + 1}</span>
                <Button type="button" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={transactions.length < PAGE_SIZE}>
                  Próxima
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KiwifyIntegration;
