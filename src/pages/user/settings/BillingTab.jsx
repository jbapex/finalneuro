import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function pickNextPayment(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return (
    payload?.next_payment ||
    payload?.subscription?.next_payment ||
    payload?.order?.next_payment ||
    payload?.order?.subscription?.next_payment ||
    payload?.subscription?.customer_access?.access_until ||
    payload?.subscription?.charges?.future?.[0]?.charge_date ||
    null
  );
}

function pickFrequency(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload?.Subscription?.plan?.frequency || payload?.subscription?.plan?.frequency || null;
}

const BillingTab = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [offers, setOffers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      setErr('');
      const [offersRes, txRes] = await Promise.all([
        supabase
          .from('plan_offers')
          .select(
            'id, plan_id, display_name, billing_cycle, offer_type, price_override, installment_count, installment_value, checkout_url, is_active, sort_order, plans(id,name,description,price,duration)'
          )
          .eq('is_active', true)
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true }),
        supabase
          .from('kiwify_transactions')
          .select('order_status, processed_status, price, currency, created_at, product_name, plan_id, full_payload')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      if (!mounted) return;
      if (offersRes.error || txRes.error) {
        setErr(offersRes.error?.message || txRes.error?.message || 'Erro ao carregar assinatura.');
        setOffers([]);
        setTransactions([]);
      } else {
        setOffers(offersRes.data || []);
        setTransactions(txRes.data || []);
      }
      setLoading(false);
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const currentPlanId = Number(profile?.plan_id || 0);
  const latestTx = transactions[0] || null;
  const payload = latestTx?.full_payload || null;
  const nextPayment = pickNextPayment(payload);
  const frequencyLabel = pickFrequency(payload);

  const currentPlanOffers = useMemo(
    () => offers.filter((o) => Number(o.plan_id || 0) === currentPlanId && !!o.checkout_url),
    [offers, currentPlanId]
  );

  const upgradeOffers = useMemo(() => {
    return offers.filter((o) => {
      if (!o.checkout_url) return false;
      const planId = Number(o.plan_id || 0);
      return currentPlanId > 0 ? planId !== currentPlanId : true;
    });
  }, [offers, currentPlanId]);

  if (!user) return <p className="text-sm text-muted-foreground">Faça login para ver sua assinatura.</p>;
  if (loading) return <p className="text-sm text-muted-foreground">Carregando assinatura...</p>;
  if (err)
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        Não foi possível carregar os dados da assinatura: {err}
      </div>
    );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Assinatura</CardTitle>
          <CardDescription>
            Sua assinatura é atualizada automaticamente pela Kiwify após pagamentos confirmados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Plano atual:</span>
            <Badge variant="outline">{profile?.plan_name || `Plano #${profile?.plan_id || '-'}`}</Badge>
          </div>
          {latestTx && (
            <div className="text-sm text-muted-foreground">
              Última transação: {new Date(latestTx.created_at).toLocaleString('pt-BR')} ·{' '}
              {latestTx.order_status || latestTx.processed_status || 'status desconhecido'}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vencimento da assinatura</CardTitle>
        </CardHeader>
        <CardContent>
          {nextPayment ? (
            <div className="space-y-1">
              <div className="text-sm">
                <strong>Próximo pagamento:</strong> {new Date(nextPayment).toLocaleString('pt-BR')}
              </div>
              <div className="text-sm">
                <strong>Recorrência:</strong> {frequencyLabel || 'Não informada pela Kiwify'}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Ainda não foi possível calcular o vencimento desta assinatura.
            </div>
          )}
        </CardContent>
      </Card>

      {currentPlanOffers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gerenciar plano atual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {currentPlanOffers.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <div className="font-medium">{o.display_name || o?.plans?.name || 'Oferta'}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}
                    {o.offer_type === 'founder' ? ' · Fundadora' : ''}
                  </div>
                </div>
                <Button asChild size="sm">
                  <a href={o.checkout_url} target="_blank" rel="noopener noreferrer">
                    Acessar checkout
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {upgradeOffers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ofertas de Upgrade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upgradeOffers.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <div className="font-medium">{o.display_name || o?.plans?.name || 'Oferta'}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}
                    {o.offer_type === 'founder' ? ' · Fundadora' : ''}
                  </div>
                </div>
                <Button asChild size="sm">
                  <a href={o.checkout_url} target="_blank" rel="noopener noreferrer">
                    Fazer upgrade
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default BillingTab;
