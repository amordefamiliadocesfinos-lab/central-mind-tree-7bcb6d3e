import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type PendingRow = {
  id: string;
  production_fact_id: string;
  component_id: string;
  variant_id: string | null;
  quantity_consumed: number | string;
  quantity_applied: number | string;
  unit_snapshot: string | null;
  production_fact?: {
    id: string;
    quantity: number | string;
    occurred_at: string;
    operator_name: string | null;
    product?: { name: string } | null;
    variant?: { variant_name: string } | null;
  } | null;
  component?: { name: string } | null;
  variant?: { variant_name: string } | null;
};

export function ProductionMaterialPendingPanel() {
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('production_fact_consumptions')
      .select(`
        id, production_fact_id, component_id, variant_id,
        quantity_consumed, quantity_applied, unit_snapshot,
        production_fact:production_facts(
          id, quantity, occurred_at, operator_name,
          product:products(name),
          variant:product_variants(variant_name)
        ),
        component:products!production_fact_consumptions_component_id_fkey(name),
        variant:product_variants(variant_name)
      `)
      .eq('adjustment_status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao carregar pendências de produção:', error);
      toast.error('Não foi possível carregar os ajustes de materiais.');
    } else {
      setRows((data || []) as PendingRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, PendingRow[]>();
    rows.forEach((row) => {
      const list = map.get(row.production_fact_id) || [];
      list.push(row);
      map.set(row.production_fact_id, list);
    });
    return Array.from(map.entries());
  }, [rows]);

  const reconcile = async (factId: string) => {
    setReconcilingId(factId);
    const { data, error } = await (supabase as any).rpc('reconcile_production_fact_materials', {
      p_production_fact_id: factId,
    });
    setReconcilingId(null);

    if (error) {
      console.error('Erro ao regularizar materiais:', error);
      toast.error('Erro técnico ao regularizar os materiais.');
      return;
    }

    if (data?.all_resolved) {
      toast.success('Consumos pendentes regularizados.');
    } else {
      toast.warning('Ainda faltam materiais. Ajuste o estoque e tente novamente.');
    }
    notifyInventoryChanged();
    load();
  };

  if (loading) {
    return <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (grouped.length === 0) {
    return (
      <Card className="border-emerald-500/30">
        <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          <div><p className="font-semibold">Nenhum ajuste pendente</p><p className="text-sm text-muted-foreground">Os consumos de produção estão regularizados.</p></div>
          <Button variant="outline" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold"><AlertTriangle className="h-5 w-5 text-amber-500" />Ajustes de materiais</h2>
          <p className="text-sm text-muted-foreground">A produção já entrou no estoque. Aqui ficam somente os consumos que ainda precisam ser regularizados.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {grouped.map(([factId, items]) => {
        const fact = items[0].production_fact;
        return (
          <Card key={factId} className="border-amber-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {fact?.product?.name || 'Produção'}{fact?.variant?.variant_name ? ` · ${fact.variant.variant_name}` : ''}
              </CardTitle>
              <div className="text-sm text-muted-foreground">
                {Number(fact?.quantity || 0)} produzidos · {fact?.operator_name || 'Operador não informado'}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {items.map((item) => {
                  const required = Number(item.quantity_consumed) || 0;
                  const applied = Number(item.quantity_applied) || 0;
                  const pending = Math.max(0, required - applied);
                  return (
                    <div key={item.id} className="rounded-xl bg-muted/50 p-3 text-sm">
                      <div className="font-medium">{item.component?.name || 'Componente'}{item.variant?.variant_name ? ` · ${item.variant.variant_name}` : ''}</div>
                      <div className="text-muted-foreground">Pendente: <span className="font-semibold text-foreground">{pending} {item.unit_snapshot || ''}</span> · requerido {required} · aplicado {applied}</div>
                    </div>
                  );
                })}
              </div>
              <Button className="w-full" disabled={reconcilingId === factId} onClick={() => reconcile(factId)}>
                {reconcilingId === factId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Regularizar após ajuste do estoque
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
