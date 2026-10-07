import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  Clock3,
  Factory,
  PackageCheck,
  Pencil,
  RefreshCw,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useActiveUser } from '@/hooks/useActiveUser';
import { toast } from 'sonner';

const OPERATIONAL_TIME_ZONE = 'America/Sao_Paulo';
const db = supabase as any;

type FactRow = {
  id: string;
  quantity: number | string;
  occurred_at: string;
  status: string;
  source: string | null;
  location: string;
  created_by: string | null;
  production_order_id: string | null;
  product: {
    id: string;
    name: string;
    cover_image_url: string | null;
    unit: string | null;
    is_intermediate: boolean | null;
  } | null;
  variant: {
    id: string;
    variant_name: string;
    unit: string | null;
  } | null;
  production_order: {
    id: string;
    internal_production_number: string | null;
    order_number: string | null;
    status: string;
    target_quantity: number | string;
  } | null;
  process_entries: Array<{
    id: string;
    operator_name: string;
    quantity: number | string;
    total_value: number | string;
    process: { id: string; name: string } | null;
  }>;
  consumptions: Array<{
    id: string;
    quantity_consumed: number | string;
    quantity_applied: number | string;
    adjustment_status: string;
    unit_snapshot: string | null;
    component: { id: string; name: string } | null;
    component_variant: { id: string; variant_name: string } | null;
  }>;
};

type FinishedMovement = {
  reference_id: string;
  quantity: number | string;
  previous_balance: number | string | null;
  new_balance: number | string | null;
  location: string;
  reference_type: string;
};

type Group = {
  key: string;
  day: string;
  productName: string;
  variantName: string | null;
  coverImageUrl: string | null;
  unit: string;
  totalQuantity: number;
  laborValue: number;
  pendingMaterialQty: number;
  facts: FactRow[];
};

function localDay(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function localTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: OPERATIONAL_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function displayDay(day: string) {
  const [year, month, date] = day.split('-');
  return `${date}/${month}/${year}`;
}

function todayLocal() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: OPERATIONAL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function factUnit(fact: FactRow) {
  return fact.variant?.unit || fact.product?.unit || 'un';
}

function pendingQty(item: FactRow['consumptions'][number]) {
  return Math.max(0, Number(item.quantity_consumed || 0) - Number(item.quantity_applied || 0));
}

function editDateTimeValue(iso: string) {
  return `${localDay(iso)}T${localTime(iso)}`;
}

function operationalDateTimeIso(value: string) {
  return new Date(`${value}:00-03:00`).toISOString();
}

function productionFactActionMessage(reason?: string | null) {
  switch (reason) {
    case 'reason_required': return 'Informe o motivo da correção.';
    case 'invalid_quantity': return 'Informe uma quantidade válida.';
    case 'occurred_at_required': return 'Informe a data e hora corretas.';
    case 'pending_material_adjustment': return 'Regularize os materiais pendentes antes de editar ou excluir este lançamento.';
    case 'production_fact_in_closing': return 'Este lançamento já entrou em um Fechamento de Produção. Revise o fechamento antes de alterar o fato.';
    case 'insufficient_finished_stock': return 'Não há saldo suficiente do produto acabado para desfazer este lançamento.';
    case 'finished_movement_not_found': return 'A entrada de estoque deste lançamento não foi localizada. A correção exige revisão técnica.';
    case 'bom_changed_review_required': return 'A composição/BOM mudou desde este lançamento. A correção exige revisão técnica para não distorcer consumos.';
    case 'intermediate_fact_not_supported': return 'Lotes intermediários ainda não entram nesta correção gerencial.';
    case 'production_fact_not_found': return 'Lançamento de produção não encontrado.';
    case 'production_fact_not_confirmed': return 'Este lançamento já não está confirmado.';
    default: return 'Não foi possível corrigir este lançamento de produção.';
  }
}

export function ProductionRealHistory() {
  const today = todayLocal();
  const { activeUser } = useActiveUser();
  const canManageFacts = ['Administrador', 'LIDER PRODUÇÃO'].includes(activeUser?.role || '');
  const [startDate, setStartDate] = useState(addDays(today, -6));
  const [endDate, setEndDate] = useState(today);
  const [facts, setFacts] = useState<FactRow[]>([]);
  const [finishedMovements, setFinishedMovements] = useState<Record<string, FinishedMovement>>({});
  const [registrars, setRegistrars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingFact, setEditingFact] = useState<FactRow | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editOccurredAt, setEditOccurredAt] = useState('');
  const [editReason, setEditReason] = useState('');
  const [factActionId, setFactActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: factsError } = await db
      .from('production_facts')
      .select(`
        id, quantity, occurred_at, status, source, location, created_by, production_order_id,
        product:products!production_facts_product_id_fkey(id,name,cover_image_url,unit,is_intermediate),
        variant:product_variants!production_facts_variant_id_fkey(id,variant_name,unit),
        production_order:production_orders!production_facts_production_order_id_fkey(
          id,internal_production_number,order_number,status,target_quantity
        ),
        process_entries:production_fact_process_entries(
          id,operator_name,quantity,total_value,
          process:processes(id,name)
        ),
        consumptions:production_fact_consumptions(
          id,quantity_consumed,quantity_applied,adjustment_status,unit_snapshot,
          component:products!production_fact_consumptions_component_id_fkey(id,name),
          component_variant:product_variants!production_fact_consumptions_variant_id_fkey(id,variant_name)
        )
      `)
      .eq('status', 'confirmed')
      .order('occurred_at', { ascending: false })
      .limit(500);

    if (factsError) {
      console.error('Erro ao carregar Produção Real:', factsError);
      setError(factsError.message || 'Não foi possível carregar a Produção Real.');
      setLoading(false);
      return;
    }

    const rows = (data || []) as FactRow[];
    setFacts(rows);

    const ids = rows.map(row => row.id);
    const creatorIds = [...new Set(rows.map(row => row.created_by).filter(Boolean))] as string[];

    if (!ids.length) {
      setFinishedMovements({});
      setRegistrars({});
      setLoading(false);
      return;
    }

    const [movementsResult, usersResult] = await Promise.all([
      db
        .from('inventory_movements')
        .select('reference_id,quantity,previous_balance,new_balance,location,movement_type,reference_type')
        .in('reference_type', ['production_fact', 'intermediate_batch_fact'])
        .eq('movement_type', 'in')
        .in('reference_id', ids),
      creatorIds.length
        ? db.from('app_users').select('auth_user_id,name').in('auth_user_id', creatorIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (movementsResult.error) {
      console.error('Erro ao carregar movimentos de entrada da Produção Real:', movementsResult.error);
    }
    if (usersResult.error) {
      console.error('Erro ao identificar responsáveis pelo registro:', usersResult.error);
    }

    const movementMap: Record<string, FinishedMovement> = {};
    for (const movement of movementsResult.data || []) {
      movementMap[movement.reference_id] = movement;
    }

    const registrarMap: Record<string, string> = {};
    for (const user of usersResult.data || []) {
      if (user.auth_user_id) registrarMap[user.auth_user_id] = user.name;
    }

    setFinishedMovements(movementMap);
    setRegistrars(registrarMap);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openEditFact = (fact: FactRow) => {
    setEditingFact(fact);
    setEditQuantity(String(Number(fact.quantity)));
    setEditOccurredAt(editDateTimeValue(fact.occurred_at));
    setEditReason('');
  };

  const handleEditFact = async () => {
    if (!editingFact) return;
    const quantity = Number(editQuantity.replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }
    if (!editOccurredAt) {
      toast.error('Informe a data e hora corretas.');
      return;
    }
    if (!editReason.trim()) {
      toast.error('Informe o motivo da correção.');
      return;
    }

    try {
      setFactActionId(editingFact.id);
      const { data, error: rpcError } = await db.rpc('correct_production_fact', {
        p_production_fact_id: editingFact.id,
        p_quantity: quantity,
        p_occurred_at: operationalDateTimeIso(editOccurredAt),
        p_reason: editReason.trim(),
      });
      if (rpcError) throw rpcError;
      const result = data as { success?: boolean; reason?: string } | null;
      if (!result?.success) {
        toast.error(productionFactActionMessage(result?.reason));
        return;
      }

      toast.success('Lançamento corrigido. O fato original foi preservado como revertido.');
      setEditingFact(null);
      await load();
    } catch (actionError: any) {
      console.error('Erro ao editar fato de produção:', actionError);
      toast.error(actionError?.message || 'Não foi possível editar este lançamento.');
    } finally {
      setFactActionId(null);
    }
  };

  const handleDeleteFact = async (fact: FactRow) => {
    const reason = window.prompt('Informe o motivo da exclusão/reversão deste lançamento:');
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error('Informe o motivo da exclusão.');
      return;
    }
    if (!window.confirm('Excluir este lançamento da Produção Real? O sistema irá reverter estoque e consumos, preservando o histórico para auditoria.')) return;

    try {
      setFactActionId(fact.id);
      const { data, error: rpcError } = await db.rpc('reverse_production_fact', {
        p_production_fact_id: fact.id,
        p_reason: reason.trim(),
      });
      if (rpcError) throw rpcError;
      const result = data as { success?: boolean; reason?: string } | null;
      if (!result?.success) {
        toast.error(productionFactActionMessage(result?.reason));
        return;
      }

      toast.success('Lançamento excluído da Produção Real e revertido com histórico preservado.');
      await load();
    } catch (actionError: any) {
      console.error('Erro ao excluir fato de produção:', actionError);
      toast.error(actionError?.message || 'Não foi possível excluir este lançamento.');
    } finally {
      setFactActionId(null);
    }
  };

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();

    for (const fact of facts) {
      const day = localDay(fact.occurred_at);
      if (day < startDate || day > endDate) continue;

      const unit = factUnit(fact);
      const productId = fact.product?.id || 'unknown';
      const variantId = fact.variant?.id || 'simple';
      const key = `${day}|${productId}|${variantId}|${unit}`;
      const labor = (fact.process_entries || []).reduce(
        (total, entry) => total + Number(entry.total_value || 0),
        0,
      );
      const pending = (fact.consumptions || []).reduce(
        (total, item) => total + pendingQty(item),
        0,
      );

      const current = map.get(key) || {
        key,
        day,
        productName: fact.product?.name || 'Produto não identificado',
        variantName: fact.variant?.variant_name || null,
        coverImageUrl: fact.product?.cover_image_url || null,
        unit,
        totalQuantity: 0,
        laborValue: 0,
        pendingMaterialQty: 0,
        facts: [],
      };

      current.totalQuantity += Number(fact.quantity || 0);
      current.laborValue += labor;
      current.pendingMaterialQty += pending;
      current.facts.push(fact);
      map.set(key, current);
    }

    return [...map.values()].sort(
      (a, b) => b.day.localeCompare(a.day) || a.productName.localeCompare(b.productName),
    );
  }, [facts, startDate, endDate]);

  const groupsByDay = useMemo(() => (
    groups.reduce<Record<string, Group[]>>((acc, group) => {
      (acc[group.day] ||= []).push(group);
      return acc;
    }, {})
  ), [groups]);

  const periodSummary = useMemo(() => ({
    facts: groups.reduce((total, group) => total + group.facts.length, 0),
    identities: groups.length,
    labor: groups.reduce((total, group) => total + group.laborValue, 0),
    pendingGroups: groups.filter(group => group.pendingMaterialQty > 0).length,
  }), [groups]);

  if (loading) {
    return <div className="space-y-3">{[0, 1, 2].map(item => <Skeleton key={item} className="h-28 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarDays className="h-5 w-5" />
            Produção Real
          </h3>
          <p className="text-sm text-muted-foreground">
            Livro factual da fábrica: o que foi produzido e quais consequências físicas foram registradas.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">
            De
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 h-9" />
          </label>
          <label className="text-xs text-muted-foreground">
            Até
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 h-9" />
          </label>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-2xl font-bold">{periodSummary.facts}</p>
            <p className="text-xs text-muted-foreground">Fatos físicos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-2xl font-bold">{periodSummary.identities}</p>
            <p className="text-xs text-muted-foreground">Produto/variante por dia</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-2xl font-bold">{formatCurrency(periodSummary.labor)}</p>
            <p className="text-xs text-muted-foreground">Mão de obra apontada</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className={periodSummary.pendingGroups ? 'text-2xl font-bold text-amber-600' : 'text-2xl font-bold'}>
              {periodSummary.pendingGroups}
            </p>
            <p className="text-xs text-muted-foreground">Produções com ajuste</p>
          </CardContent>
        </Card>
      </div>

      {!groups.length && !error && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma produção real no período selecionado.
          </CardContent>
        </Card>
      )}

      {Object.entries(groupsByDay)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([day, dayGroups]) => (
          <section key={day} className="space-y-3">
            <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 py-1 backdrop-blur">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold">{displayDay(day)}</h4>
              <Badge variant="secondary">
                {dayGroups.reduce((sum, item) => sum + item.facts.length, 0)} fato(s)
              </Badge>
            </div>

            {dayGroups.map(group => (
              <Card key={group.key} className={group.pendingMaterialQty > 0 ? 'border-amber-300' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                      {group.coverImageUrl
                        ? <img src={group.coverImageUrl} alt="" className="h-full w-full object-cover" />
                        : <Factory className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{group.productName}</CardTitle>
                      {group.variantName && <p className="text-sm text-muted-foreground">{group.variantName}</p>}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <Badge>{group.totalQuantity.toLocaleString('pt-BR')} {group.unit}</Badge>
                        <Badge variant="outline">{group.facts.length} fato(s)</Badge>
                        <Badge variant="outline">{formatCurrency(group.laborValue)} mão de obra</Badge>
                        {group.pendingMaterialQty > 0 && (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Ajuste de material
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2">
                  {group.facts.map(fact => {
                    const movement = finishedMovements[fact.id];
                    const unit = factUnit(fact);
                    const labor = (fact.process_entries || []).reduce(
                      (sum, item) => sum + Number(item.total_value || 0),
                      0,
                    );
                    const pending = (fact.consumptions || []).filter(item => pendingQty(item) > 0);
                    const registrar = fact.created_by ? registrars[fact.created_by] : null;

                    return (
                      <details key={fact.id} className="group rounded-lg border bg-muted/20">
                        <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                          <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{localTime(fact.occurred_at)}</span>
                              <span className="font-semibold">
                                {Number(fact.quantity).toLocaleString('pt-BR')} {unit}
                              </span>
                              {fact.production_order ? (
                                <Badge variant="outline">
                                  {fact.production_order.internal_production_number
                                    || fact.production_order.order_number
                                    || 'OP vinculada'}
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Produção para estoque</Badge>
                              )}
                              {fact.product?.is_intermediate && <Badge variant="outline">Lote intermediário</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {fact.process_entries?.length || 0} processo(s) · {formatCurrency(labor)} · {fact.location}
                            </p>
                          </div>
                          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                        </summary>

                        <div className="space-y-4 border-t p-3">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-md border bg-background p-2 text-sm">
                              <p className="flex items-center gap-1 font-medium">
                                <UserRound className="h-3.5 w-3.5" />
                                Registro
                              </p>
                              <p className="text-muted-foreground">
                                {registrar || 'Responsável não identificado'} · {localTime(fact.occurred_at)}
                              </p>
                            </div>
                            <div className="rounded-md border bg-background p-2 text-sm">
                              <p className="font-medium">Planejamento</p>
                              {fact.production_order ? (
                                <p className="text-muted-foreground">
                                  {fact.production_order.internal_production_number
                                    || fact.production_order.order_number
                                    || 'OP'} · {fact.production_order.status}
                                </p>
                              ) : (
                                <p className="text-muted-foreground">Sem OP · produção para estoque</p>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <Users className="h-3.5 w-3.5" />
                              Processos e operadores
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {(fact.process_entries || []).map(entry => (
                                <div key={entry.id} className="rounded-md border bg-background p-2 text-sm">
                                  <p className="font-medium">{entry.process?.name || 'Processo'}</p>
                                  <p className="text-muted-foreground">
                                    {entry.operator_name} · {Number(entry.quantity).toLocaleString('pt-BR')} {unit}
                                    {' · '}{formatCurrency(Number(entry.total_value || 0))}
                                  </p>
                                </div>
                              ))}
                              {!fact.process_entries?.length && (
                                <p className="text-sm text-muted-foreground">Sem processos associados.</p>
                              )}
                            </div>
                          </div>

                          <div>
                            <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <PackageCheck className="h-3.5 w-3.5" />
                              Materiais consumidos
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {(fact.consumptions || []).map(item => {
                                const name = item.component_variant
                                  ? `${item.component?.name || 'Material'} · ${item.component_variant.variant_name}`
                                  : item.component?.name || 'Material';
                                const itemPending = pendingQty(item);
                                return (
                                  <div key={item.id} className="rounded-md border bg-background p-2 text-sm">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="font-medium">{name}</p>
                                      {itemPending > 0 && <Badge variant="destructive">Pendente</Badge>}
                                    </div>
                                    <p className="text-muted-foreground">
                                      Previsto {Number(item.quantity_consumed || 0).toLocaleString('pt-BR')} {item.unit_snapshot || ''}
                                      {' · '}aplicado {Number(item.quantity_applied || 0).toLocaleString('pt-BR')}
                                      {' · '}pendente {itemPending.toLocaleString('pt-BR')}
                                    </p>
                                  </div>
                                );
                              })}
                              {!fact.consumptions?.length && (
                                <p className="text-sm text-muted-foreground">Sem consumos associados.</p>
                              )}
                            </div>
                          </div>

                          <div className="rounded-md border bg-background p-2 text-sm">
                            <p className="font-medium">Entrada no estoque</p>
                            {movement ? (
                              <p className="text-muted-foreground">
                                +{Number(movement.quantity).toLocaleString('pt-BR')} {unit} em {movement.location}
                                {' · '}saldo {Number(movement.previous_balance || 0).toLocaleString('pt-BR')}
                                {' → '}{Number(movement.new_balance || 0).toLocaleString('pt-BR')}
                              </p>
                            ) : (
                              <p className="text-muted-foreground">
                                Movimento de entrada não localizado para este fato.
                              </p>
                            )}
                          </div>

                          {pending.length > 0 && (
                            <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                              Este fato possui {pending.length} material(is) aguardando regularização em Produção → Ajustes.
                            </div>
                          )}

                          {canManageFacts && !fact.product?.is_intermediate && (
                            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={factActionId === fact.id || pending.length > 0}
                                onClick={() => openEditFact(fact)}
                              >
                                <Pencil className="mr-1 h-4 w-4" />
                                Editar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={factActionId === fact.id || pending.length > 0}
                                onClick={() => void handleDeleteFact(fact)}
                              >
                                <Trash2 className="mr-1 h-4 w-4" />
                                Excluir
                              </Button>
                            </div>
                          )}
                        </div>
                      </details>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </section>
        ))}

      <Dialog open={!!editingFact} onOpenChange={open => !open && setEditingFact(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar lançamento de produção</DialogTitle>
          </DialogHeader>

          {editingFact && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{editingFact.product?.name || 'Produto'}</p>
                {editingFact.variant?.variant_name && (
                  <p className="text-muted-foreground">{editingFact.variant.variant_name}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  A edição reverte o fato original e registra um novo fato corrigido. O histórico não é apagado.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Quantidade correta</Label>
                <Input
                  type="number"
                  min="0.0001"
                  step="0.01"
                  value={editQuantity}
                  onChange={event => setEditQuantity(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Data e hora corretas</Label>
                <Input
                  type="datetime-local"
                  value={editOccurredAt}
                  onChange={event => setEditOccurredAt(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Motivo da correção</Label>
                <Textarea
                  value={editReason}
                  onChange={event => setEditReason(event.target.value)}
                  placeholder="Ex.: quantidade lançada incorretamente"
                  rows={3}
                />
              </div>

              <Button
                className="w-full"
                disabled={factActionId === editingFact.id}
                onClick={() => void handleEditFact()}
              >
                Salvar correção
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
