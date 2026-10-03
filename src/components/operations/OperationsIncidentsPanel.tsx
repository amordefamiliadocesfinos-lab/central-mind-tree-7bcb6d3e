import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Plus, RefreshCw, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Incident = {
  id: string;
  area: string;
  incident_type: string;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string | null;
  source_type: string | null;
  source_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  expected_quantity: number | string | null;
  applied_quantity: number | string;
  pending_quantity: number | string;
  unit: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  product?: { name: string } | null;
  variant?: { variant_name: string } | null;
};

const AREA_LABELS: Record<string, string> = {
  production: 'Produção', separation: 'Separação', receiving: 'Recebimento',
  inventory: 'Estoque', purchases: 'Compras', other: 'Outro',
};
const STATUS_LABELS: Record<string, string> = {
  open: 'Pendente', in_review: 'Em regularização', resolved: 'Resolvido', dismissed: 'Encerrado',
};

interface Props { area?: string }

export function OperationsIncidentsPanel({ area }: Props) {
  const [rows, setRows] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'all'>('pending');
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState({ area: area || 'inventory', type: 'manual_divergence', title: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from('operational_incidents').select(`
      id,area,incident_type,status,severity,title,description,source_type,source_id,
      product_id,variant_id,expected_quantity,applied_quantity,pending_quantity,unit,metadata,
      created_at,resolved_at,resolution_note,
      product:products(name),variant:product_variants(variant_name)
    `).order('created_at', { ascending: false });
    if (area) query = query.eq('area', area);
    const { data, error } = await query;
    if (error) {
      console.error(error);
      toast.error('Não foi possível carregar as intercorrências.');
    } else setRows((data || []) as Incident[]);
    setLoading(false);
  }, [area]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => rows.filter((item) => {
    if (statusFilter === 'pending') return item.status === 'open' || item.status === 'in_review';
    if (statusFilter === 'resolved') return item.status === 'resolved' || item.status === 'dismissed';
    return true;
  }), [rows, statusFilter]);

  const pendingCount = rows.filter((item) => item.status === 'open' || item.status === 'in_review').length;

  const reconcile = async (incident: Incident) => {
    setBusyId(incident.id);
    const { data, error } = await (supabase as any).rpc('reconcile_operational_incident', {
      p_incident_id: incident.id,
      p_resolution_note: null,
    });
    setBusyId(null);
    if (error) {
      console.error(error);
      toast.error(error.message?.includes('manager_required') ? 'Somente gestor pode regularizar intercorrências.' : 'Não foi possível regularizar.');
      return;
    }
    if (Number(data?.pending_quantity || 0) > 0) toast.warning('A operação continua registrada, mas ainda existe saldo pendente.');
    else toast.success('Intercorrência regularizada.');
    notifyInventoryChanged();
    load();
  };

  const submitReport = async () => {
    if (!report.title.trim()) return toast.error('Informe um título.');
    const { error } = await (supabase as any).rpc('report_operational_incident', {
      p_area: report.area,
      p_incident_type: report.type,
      p_title: report.title.trim(),
      p_description: report.description.trim() || null,
      p_product_id: null,
      p_variant_id: null,
      p_expected_quantity: null,
      p_applied_quantity: 0,
      p_unit: null,
      p_source_type: 'manual',
      p_source_id: null,
      p_metadata: {},
    });
    if (error) return toast.error('Não foi possível registrar a intercorrência.');
    toast.success('Intercorrência registrada para acompanhamento.');
    setShowReport(false);
    setReport({ area: area || 'inventory', type: 'manual_divergence', title: '', description: '' });
    load();
  };

  if (loading) return <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold"><AlertTriangle className="h-5 w-5 text-amber-500" />Central de Intercorrências</h2>
        <p className="text-sm text-muted-foreground">O fato físico continua. Toda divergência permanece aqui até ser resolvida.</p>
      </div>
      <div className="flex gap-2">
        {!area && <Button variant="outline" onClick={() => setShowReport(true)}><Plus className="mr-2 h-4 w-4" />Registrar</Button>}
        <Button variant="outline" size="icon" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-2">
      <button onClick={() => setStatusFilter('pending')} className={`rounded-xl border p-3 text-left ${statusFilter === 'pending' ? 'border-amber-500 bg-amber-50/50' : ''}`}><div className="text-2xl font-bold">{pendingCount}</div><div className="text-xs text-muted-foreground">Pendentes</div></button>
      <button onClick={() => setStatusFilter('resolved')} className={`rounded-xl border p-3 text-left ${statusFilter === 'resolved' ? 'border-emerald-500 bg-emerald-50/50' : ''}`}><div className="text-2xl font-bold">{rows.length - pendingCount}</div><div className="text-xs text-muted-foreground">Resolvidas</div></button>
      <button onClick={() => setStatusFilter('all')} className={`rounded-xl border p-3 text-left ${statusFilter === 'all' ? 'border-primary' : ''}`}><div className="text-2xl font-bold">{rows.length}</div><div className="text-xs text-muted-foreground">Todas</div></button>
    </div>

    {visible.length === 0 ? <Card className="border-emerald-500/30"><CardContent className="flex min-h-48 flex-col items-center justify-center gap-2 text-center"><CheckCircle2 className="h-10 w-10 text-emerald-600" /><p className="font-semibold">Nenhuma intercorrência nesta visão</p><p className="text-sm text-muted-foreground">Nada ficou escondido ou pendente.</p></CardContent></Card> :
      <div className="space-y-3">{visible.map((item) => {
        const expected = Number(item.expected_quantity || 0);
        const applied = Number(item.applied_quantity || 0);
        const pending = Number(item.pending_quantity || 0);
        const automatic = item.source_type === 'production_fact_consumption' || item.source_type === 'order_separation';
        return <Card key={item.id} className={item.severity === 'critical' && item.status !== 'resolved' ? 'border-red-500/40' : item.status === 'resolved' ? 'border-emerald-500/30' : 'border-amber-500/30'}>
          <CardHeader className="pb-2"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{item.title}</CardTitle><div className="mt-1 flex flex-wrap gap-1"><Badge variant="outline">{AREA_LABELS[item.area] || item.area}</Badge><Badge variant={item.status === 'resolved' ? 'secondary' : 'outline'}>{STATUS_LABELS[item.status] || item.status}</Badge></div></div><div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString('pt-BR')}</div></div></CardHeader>
          <CardContent className="space-y-3">
            {(item.product || item.variant) && <div><p className="font-medium">{item.product?.name || 'Produto'}{item.variant?.variant_name ? ` · ${item.variant.variant_name}` : ''}</p></div>}
            {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
            {item.expected_quantity !== null && <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-3 text-center text-sm"><div><div className="font-bold">{expected}</div><div className="text-xs text-muted-foreground">Esperado</div></div><div><div className="font-bold">{applied}</div><div className="text-xs text-muted-foreground">Aplicado</div></div><div><div className="font-bold text-amber-600">{pending}</div><div className="text-xs text-muted-foreground">Pendente {item.unit || ''}</div></div></div>}
            {item.resolution_note && <div className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">{item.resolution_note}</div>}
            {(item.status === 'open' || item.status === 'in_review') && <Button className="w-full" disabled={busyId === item.id} onClick={() => reconcile(item)}>{busyId === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wrench className="mr-2 h-4 w-4" />}{automatic ? 'Tentar regularizar' : 'Marcar como resolvida'}</Button>}
          </CardContent>
        </Card>;
      })}</div>}

    <Dialog open={showReport} onOpenChange={setShowReport}><DialogContent><DialogHeader><DialogTitle>Registrar intercorrência</DialogTitle></DialogHeader><div className="space-y-4"><div><Label>Área</Label><Select value={report.area} onValueChange={(value) => setReport((current) => ({ ...current, area: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(AREA_LABELS).map(([value,label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div><Label>Título</Label><Input value={report.title} onChange={(e) => setReport((current) => ({ ...current, title: e.target.value }))} placeholder="Ex.: recebimento físico ainda não lançado" /></div><div><Label>Descrição</Label><Textarea rows={4} value={report.description} onChange={(e) => setReport((current) => ({ ...current, description: e.target.value }))} /></div><Button className="w-full" onClick={submitReport}>Registrar para resolver depois</Button></div></DialogContent></Dialog>
  </div>;
}
