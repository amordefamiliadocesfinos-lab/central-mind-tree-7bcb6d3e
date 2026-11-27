import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { analyzeFinancialIntegrity, type IntegrityEntry, type IntegrityMovement, type IntegrityAccount, type IntegrityOrder } from '@/lib/financial/integrityDiagnostics';

// Read only, ordered pagination; no partial result is presented as a complete scan.
async function readAll<T extends {id: string}>(table: string, columns: string, signal: AbortSignal): Promise<T[]> {
  const result: T[] = [];
  const ids = new Set<string>();
  let expected: number | null = null;
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const { data, error, count } = await (supabase.from as any)(table).select(columns, { count: 'exact' }).order('id').range(offset, offset + size - 1).abortSignal(signal);
    if (error) throw error;
    if (!Array.isArray(data) || count == null || (expected !== null && count !== expected)) throw new Error('O conjunto mudou durante a leitura; atualize o diagnóstico.');
    expected = count;
    for (const row of data) {
      if (ids.has(row.id)) throw new Error('Leitura duplicada; atualize o diagnóstico.');
      ids.add(row.id); result.push(row);
    }
    if (result.length === expected) return result;
    if (data.length !== size || result.length > expected) throw new Error('Leitura incompleta; atualize o diagnóstico.');
  }
}
type Report = ReturnType<typeof analyzeFinancialIntegrity>;
export function MonetaryIntegrityPanel() {
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setReport(null); setError('');
    Promise.all([
      readAll<IntegrityEntry>('financial_entries','id,type,description,order_id,value:value::text,value_paid:value_paid::text,lifecycle_status,is_conciliated',controller.signal),
      readAll<IntegrityMovement>('financial_movements','id,entry_id,account_id,value:value::text',controller.signal),
      readAll<IntegrityAccount>('financial_accounts','id,name,initial_balance:initial_balance::text,current_balance:current_balance::text',controller.signal),
      readAll<IntegrityOrder>('orders','id,order_number,total_value:total_value::text',controller.signal),
    ]).then(([entries,movements,accounts,orders]) => {
      if (controller.signal.aborted) return;
      setReport(analyzeFinancialIntegrity(entries,movements,accounts,orders)); setCheckedAt(new Date().toLocaleString('pt-BR'));
    }).catch(err => { if (!controller.signal.aborted) setError(err?.message || 'Não foi possível concluir a leitura.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision]);
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-semibold">Diagnóstico monetário — somente leitura</p>
      <Button size="sm" variant="outline" disabled={loading} onClick={() => setRevision(r => r+1)}>Atualizar</Button>
    </div>
    <p className="text-xs text-muted-foreground">Escopo: registros visíveis à sessão, sem filtro de período. Leituras paginadas não são um snapshot transacional; confirme diferenças na fonte antes de regularizar. Nenhum valor é alterado aqui.</p>
    {loading && <p role="status">Consultando obrigações, movimentos, contas e pedidos…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {report && <ScrollArea className="h-[420px] rounded-md border p-3">
      <p className="text-xs text-muted-foreground">Consulta: {checkedAt} · {report.counts.entries} obrigações · {report.counts.movements} movimentos · {report.counts.accounts} contas · {report.counts.orders} pedidos</p>
      <div className="grid grid-cols-2 gap-2 my-3">
        <div className="rounded border p-2">Precisão fracionada <strong>{report.entryFindings.filter(e=>e.fractionalValue).length}</strong></div>
        <div className="rounded border p-2">Resíduos subcentavo <strong>{report.entryFindings.filter(e=>e.subcentOpen).length}</strong></div>
        <div className="rounded border p-2">Pago acima da obrigação <strong>{report.entryFindings.filter(e=>e.above).length}</strong></div>
        <div className="rounded border p-2">Pago ≠ movimentos <strong>{report.entryFindings.filter(e=>e.paidMismatch).length}</strong></div>
      </div>
      <h3 className="font-semibold text-sm mt-3">Saldos — reconstrução pelos movimentos visíveis</h3>
      {!!report.unknownMovementLinks && <p role="alert" className="text-xs text-destructive">{report.unknownMovementLinks} movimentos com vínculo ausente ou não visível; reconstrução incompleta.</p>}
      {report.accountFindings.map(a=><div key={a.id} className="border-b py-2 text-sm">
        <strong>{a.name}</strong> {a.hasDifference && <Badge variant="outline">Conferir</Badge>}
        <div className="break-all text-xs">Inicial: {a.initial} · Armazenado: {a.stored} · Reconstruído: {a.expected}</div>
        <div className="break-all text-xs">Diferença exata: {a.difference} · Em centavos: R$ {a.monetaryDifference}</div>
      </div>)}
      <p className="text-xs text-muted-foreground my-2">Diferença não comprova erro de caixa: pode decorrer de ajustes históricos ou visibilidade. Não recalcular saldo automaticamente.</p>
      <h3 className="font-semibold text-sm mt-3">Ocorrências por obrigação ({report.entryFindings.length})</h3>
      {report.entryFindings.map(e=><div key={e.id} className="border-b py-3 text-sm">
        <div className="font-medium">{e.orderNumber || e.description || e.id}</div>
        <div className="text-xs break-all text-muted-foreground">{e.id}</div>
        <div className="flex flex-wrap gap-1 my-1">{e.flags.map(flag=><Badge key={flag} variant="outline">{flag}</Badge>)}</div>
        <div className="text-xs break-all">Obrigação: {e.due} · Pago: {e.paid} · Movimentos: {e.movementSum} · Resíduo: {e.residual}</div>
        {e.orderTotal != null && <div className="text-xs">Total do pedido: {e.orderTotal}</div>}
        <p className="text-xs text-muted-foreground">{e.requiresReview ? 'Revisão individual obrigatória; não normalizar automaticamente.' : 'Candidato à revisão de precisão; confirmar origem e evidência antes de corrigir.'}</p>
      </div>)}
      {!report.entryFindings.length && <p className="text-sm">Nenhuma ocorrência entre os registros consultados.</p>}
    </ScrollArea>}
  </div>;
}
