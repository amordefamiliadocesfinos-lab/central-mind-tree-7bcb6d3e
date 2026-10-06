import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Factory, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TZ = 'America/Sao_Paulo';
const db = supabase as any;

type EntryRow = {
  id: string;
  production_fact_id: string;
  quantity: number | string;
  occurred_at: string;
  process: { id: string; name: string } | null;
  production_fact: {
    id: string;
    quantity: number | string;
    occurred_at: string;
    product: { id: string; name: string; cover_image_url: string | null } | null;
    variant: { id: string; variant_name: string } | null;
  } | null;
};

type FactGroup = {
  factId: string;
  occurredAt: string;
  quantity: number;
  productName: string;
  variantName: string | null;
  coverImageUrl: string | null;
  processes: string[];
};

function dateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

interface Props {
  operatorId: string;
  operatorName: string;
  onProduce: () => void;
  onSignOut: () => void;
}

export function ProductionOperatorHistory({ operatorId, operatorName, onProduce, onSignOut }: Props) {
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: queryError } = await db
      .from('production_fact_process_entries')
      .select(`
        id,production_fact_id,quantity,occurred_at,
        process:processes!production_fact_process_entries_process_id_fkey(id,name),
        production_fact:production_facts!production_fact_process_entries_production_fact_id_fkey(
          id,quantity,occurred_at,
          product:products!production_facts_product_id_fkey(id,name,cover_image_url),
          variant:product_variants!production_facts_variant_id_fkey(id,variant_name)
        )
      `)
      .eq('operator_user_id', operatorId)
      .order('occurred_at', { ascending: false })
      .limit(150);

    if (queryError) {
      console.error('Erro ao carregar lançamentos da operadora:', queryError);
      setError('Não foi possível carregar seus lançamentos.');
      setRows([]);
    } else {
      setRows((data || []) as EntryRow[]);
    }
    setLoading(false);
  }, [operatorId]);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo<FactGroup[]>(() => {
    const map = new Map<string, FactGroup>();
    for (const row of rows) {
      if (!row.production_fact) continue;
      const fact = row.production_fact;
      const current = map.get(fact.id) || {
        factId: fact.id,
        occurredAt: fact.occurred_at,
        quantity: Number(fact.quantity || 0),
        productName: fact.product?.name || 'Produto',
        variantName: fact.variant?.variant_name || null,
        coverImageUrl: fact.product?.cover_image_url || null,
        processes: [],
      };
      const processName = row.process?.name || 'Processo';
      if (!current.processes.includes(processName)) current.processes.push(processName);
      map.set(fact.id, current);
    }
    return [...map.values()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }, [rows]);

  const totalUnits = groups.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <main className="min-h-[100dvh] bg-background px-4 pb-8 pt-[max(18px,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Produção</p>
            <h1 className="text-2xl font-bold">Meus apontamentos</h1>
            <p className="mt-1 text-sm text-muted-foreground">{operatorName}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onSignOut} className="text-muted-foreground">
            <LogOut className="mr-1 h-4 w-4" />Sair
          </Button>
        </div>

        <Button onClick={onProduce} className="h-14 w-full text-base font-bold">
          <Factory className="mr-2 h-5 w-5" />Produzir
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Card><CardContent className="p-3"><p className="text-2xl font-bold">{groups.length}</p><p className="text-xs text-muted-foreground">Fatos com minha participação</p></CardContent></Card>
          <Card><CardContent className="p-3"><p className="text-2xl font-bold">{totalUnits}</p><p className="text-xs text-muted-foreground">Unidades</p></CardContent></Card>
        </div>

        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1 text-sm font-semibold"><CalendarDays className="h-4 w-4" />Mais recentes</p>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Atualizar
          </Button>
        </div>

        {loading && (
          <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        )}

        {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

        {!loading && !error && groups.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum apontamento seu ainda.</CardContent></Card>
        )}

        {!loading && groups.map((group) => (
          <Card key={group.factId}>
            <CardContent className="flex gap-3 p-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {group.coverImageUrl
                  ? <img src={group.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  : <Factory className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{group.productName}</p>
                {group.variantName && <p className="text-sm text-muted-foreground">{group.variantName}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{group.quantity} un</Badge>
                  {group.processes.map((process) => <Badge key={process} variant="outline">{process}</Badge>)}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{dateTime(group.occurredAt)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
