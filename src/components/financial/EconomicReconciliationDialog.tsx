import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useEconomicReconciliation, type EconomicPredictionSnapshotRecord, type ReconciliationOrderCandidate, type ReconciliationSaveResult } from '@/hooks/useEconomicReconciliation';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelAccountId: string | null;
  productId: string | null;
};

const money = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function EconomicReconciliationDialog({ open, onOpenChange, channelAccountId, productId }: Props) {
  const { loading, saving, error, listSnapshots, listCandidateOrders, reconcileSnapshotWithOrder } = useEconomicReconciliation();
  const [snapshots, setSnapshots] = useState<EconomicPredictionSnapshotRecord[]>([]);
  const [snapshotId, setSnapshotId] = useState('');
  const [orders, setOrders] = useState<ReconciliationOrderCandidate[]>([]);
  const [orderId, setOrderId] = useState('');
  const [result, setResult] = useState<ReconciliationSaveResult | null>(null);

  const selectedSnapshot = useMemo(() => snapshots.find((item) => item.id === snapshotId) ?? null, [snapshots, snapshotId]);
  const selectedOrder = useMemo(() => orders.find((item) => item.id === orderId) ?? null, [orders, orderId]);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setOrderId('');
    listSnapshots(channelAccountId, productId).then((items) => {
      setSnapshots(items);
      setSnapshotId(items[0]?.id ?? '');
    });
  }, [open, channelAccountId, productId, listSnapshots]);

  useEffect(() => {
    if (!selectedSnapshot) { setOrders([]); setOrderId(''); return; }
    listCandidateOrders(selectedSnapshot).then((items) => {
      setOrders(items);
      setOrderId(items[0]?.id ?? '');
    });
  }, [selectedSnapshot?.id, listCandidateOrders]);

  const save = async () => {
    if (!selectedSnapshot || !selectedOrder) return;
    const saved = await reconcileSnapshotWithOrder(selectedSnapshot, selectedOrder);
    if (saved) setResult(saved);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Reconciliar previsão econômica</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Snapshot previsto</Label>
            <Select value={snapshotId} onValueChange={(value) => { setSnapshotId(value); setResult(null); }} disabled={loading || snapshots.length === 0}>
              <SelectTrigger><SelectValue placeholder={loading ? 'Carregando snapshots...' : 'Selecione o snapshot'} /></SelectTrigger>
              <SelectContent>
                {snapshots.map((snapshot) => (
                  <SelectItem key={snapshot.id} value={snapshot.id}>
                    {new Date(snapshot.created_at).toLocaleString('pt-BR')} · previsto {money(Number(snapshot.result_snapshot?.repasse ?? NaN))} · {snapshot.confidence.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loading && snapshots.length === 0 && <p className="text-xs text-amber-600">Nenhum snapshot congelado para a Conta/Produto atual.</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Pedido Shopee real</Label>
            <Select value={orderId} onValueChange={(value) => { setOrderId(value); setResult(null); }} disabled={loading || !selectedSnapshot || orders.length === 0}>
              <SelectTrigger><SelectValue placeholder={loading ? 'Carregando pedidos...' : 'Selecione o Pedido'} /></SelectTrigger>
              <SelectContent>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {(order.order_number || order.id.slice(0, 8))} · {new Date(order.order_date + 'T12:00:00').toLocaleDateString('pt-BR')} · {money(order.total_value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!loading && selectedSnapshot && orders.length === 0 && <p className="text-xs text-amber-600">Nenhum Pedido compatível encontrado para este snapshot.</p>}
          </div>

          {selectedSnapshot && selectedOrder && (
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Previsto</span><strong>{money(Number(selectedSnapshot.result_snapshot?.repasse ?? NaN))}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pedido bruto</span><strong>{money(selectedOrder.total_value)}</strong></div>
              <p className="mt-2 text-xs text-muted-foreground">O líquido real só será atribuído se Settlement/Financeiro permitirem vínculo sem rateio presumido.</p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {result && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2">
                {result.status === 'reconciled' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                <Badge variant={result.status === 'reconciled' ? 'default' : 'secondary'}>{result.status.toUpperCase()}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Observado líquido</span><span>{money(result.comparison.observedNet)}</span>
                <span className="text-muted-foreground">Financeiro líquido</span><span>{money(result.comparison.financialNet)}</span>
                <span className="text-muted-foreground">Δ previsto × observado</span><span>{money(result.comparison.predictedVsObservedDelta)}</span>
                <span className="text-muted-foreground">Δ previsto × financeiro</span><span>{money(result.comparison.predictedVsFinancialDelta)}</span>
              </div>
              {result.comparison.pending.length > 0 && <p className="text-xs text-amber-600">Pendências: {result.comparison.pending.join(' · ')}</p>}
              <p className="text-xs text-muted-foreground">Reconciliação registrada como novo fato auditável: {result.reconciliationId}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={save} disabled={saving || !selectedSnapshot || !selectedOrder}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar reconciliação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}