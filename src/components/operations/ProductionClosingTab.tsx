import { useState } from 'react';
import { useProductionClosing, ProductionClosing, CLOSING_STATUS } from '@/hooks/useProductionClosing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Calendar, Users, Trash2, DollarSign, ArrowRight, CircleDollarSign } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

function todaySaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function daysAgoSaoPaulo(days: number) {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() - days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function formatDateOnly(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function ProductionClosingTab() {
  const {
    closings,
    loading,
    createClosing,
    confirmClosing,
    deleteClosing,
    getClosingSummaryByEmployee,
  } = useProductionClosing();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedClosing, setSelectedClosing] = useState<ProductionClosing | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmDueDate, setConfirmDueDate] = useState(todaySaoPaulo());
  const [formData, setFormData] = useState({
    start_date: daysAgoSaoPaulo(7),
    end_date: todaySaoPaulo(),
    notes: '',
  });

  const handleCreate = async () => {
    const result = await createClosing(formData.start_date, formData.end_date, formData.notes || undefined);
    if (!result) return;
    setShowCreateDialog(false);
    setFormData({ start_date: daysAgoSaoPaulo(7), end_date: todaySaoPaulo(), notes: '' });
  };

  const handleConfirm = async (id: string) => {
    if (!confirmDueDate) return;
    if (!window.confirm('Confirmar este fechamento e criar as contas a pagar no Financeiro?')) return;
    setConfirming(true);
    const ok = await confirmClosing(id, confirmDueDate);
    setConfirming(false);
    if (ok) setSelectedClosing(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este fechamento em preparação? Os apontamentos voltarão a ficar disponíveis.')) return;
    const ok = await deleteClosing(id);
    if (ok) setSelectedClosing(null);
  };

  const totalPaid = closings.filter(c => c.status === 'pago').reduce((sum, c) => sum + Number(c.total_value || 0), 0);
  const totalOpenFinance = closings.reduce((sum, closing) => sum + (closing.financial_links || []).reduce((inner, link) => {
    const entry = link.financial_entry;
    if (!entry || entry.lifecycle_status !== 'active') return inner;
    return inner + Math.max(0, Number(entry.value || 0) - Number(entry.value_paid || 0));
  }, 0), 0);
  const preparing = closings.filter(c => c.status === 'aberto').length;

  if (loading) return <p className="text-muted-foreground text-center py-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><DollarSign className="h-5 w-5" />Fechamentos ({closings.length})</h2>
          <p className="text-xs text-muted-foreground">O fechamento consolida o trabalho. O pagamento acontece no Financeiro.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-2" />Novo Fechamento</Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card><CardContent className="pt-4 text-center"><p className="text-xl sm:text-3xl font-bold">{preparing}</p><p className="text-[11px] text-muted-foreground">Em preparação</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xl sm:text-3xl font-bold text-amber-600">{formatCurrency(totalOpenFinance)}</p><p className="text-[11px] text-muted-foreground">A pagar</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><p className="text-xl sm:text-3xl font-bold text-green-600">{formatCurrency(totalPaid)}</p><p className="text-[11px] text-muted-foreground">Pago</p></CardContent></Card>
      </div>

      <Alert>
        <CircleDollarSign className="h-4 w-4" />
        <AlertDescription>Um apontamento só pode entrar em um fechamento. Ao confirmar, o sistema cria uma Conta a Pagar por operador. Pagamento parcial ou total é refletido automaticamente aqui.</AlertDescription>
      </Alert>

      <div className="space-y-2">
        {closings.length === 0 ? (
          <Card className="p-8 text-center"><Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">Nenhum fechamento ainda</p></Card>
        ) : closings.map(closing => {
          const statusConfig = CLOSING_STATUS[closing.status as keyof typeof CLOSING_STATUS] || { label: closing.status, color: 'bg-slate-500' };
          const employees = new Set((closing.items || []).map(item => item.employee_name.trim().toLocaleLowerCase('pt-BR'))).size;
          return (
            <Card key={closing.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setSelectedClosing(closing); setConfirmDueDate(todaySaoPaulo()); }}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span className="font-medium">{formatDateOnly(closing.start_date)} - {formatDateOnly(closing.end_date)}</span><Badge className={cn('text-xs text-white', statusConfig.color)}>{statusConfig.label}</Badge></div>
                    {closing.notes && <p className="text-sm text-muted-foreground">{closing.notes}</p>}
                    <p className="text-xs text-muted-foreground">{employees} operador(es) · {(closing.items || []).length} processo(s) consolidado(s)</p>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold">{formatCurrency(closing.total_value)}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Fechamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Serão incluídos somente apontamentos ainda não utilizados em outro fechamento, respeitando o dia operacional de São Paulo.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data Inicial</Label><Input type="date" className="h-12" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} /></div>
              <div><Label>Data Final</Label><Input type="date" className="h-12" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} /></div>
            <Button className="w-full h-12" onClick={() => void handleCreate()}>Gerar fechamento em preparação</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedClosing} onOpenChange={open => !open && setSelectedClosing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedClosing && (() => {
            const statusConfig = CLOSING_STATUS[selectedClosing.status as keyof typeof CLOSING_STATUS] || { label: selectedClosing.status, color: 'bg-slate-500' };
            const byEmployee = getClosingSummaryByEmployee(selectedClosing);
            return <>
              <DialogHeader><DialogTitle className="flex items-center gap-2">Fechamento <Badge className={cn('text-xs text-white', statusConfig.color)}>{statusConfig.label}</Badge></DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Card><CardContent className="pt-4 space-y-2">
                  <div className="flex justify-between gap-3"><span className="text-muted-foreground">Período:</span><span>{formatDateOnly(selectedClosing.start_date)} - {formatDateOnly(selectedClosing.end_date)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Total:</span><span className="font-bold text-lg">{formatCurrency(selectedClosing.total_value)}</span></div>
                  {selectedClosing.notes && <div><span className="text-muted-foreground">Obs:</span><p className="text-sm">{selectedClosing.notes}</p></div>}
                </CardContent></Card>

                {Object.entries(byEmployee).map(([key, data]) => {
                  const employee = data.items[0]?.employee_name || key;
                  const financial = data.financial?.financial_entry;
                  const paid = Number(financial?.value_paid || 0);
                  const value = Number(financial?.value || data.total);
                  return <Card key={key}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />{employee}<Badge variant="secondary" className="ml-auto">{formatCurrency(data.total)}</Badge></CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {data.items.map(item => <div key={item.id} className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">{item.process?.name || item.process_name_snapshot || 'Processo'}</span><span>{Number(item.total_quantity).toLocaleString('pt-BR')} un = {formatCurrency(item.total_value)}</span></div>)}
                      {financial && <div className="mt-2 rounded-lg bg-muted p-2 text-xs space-y-1">
                        <div className="flex justify-between"><span>Financeiro</span><strong>{financial.lifecycle_status === 'cancelled' ? 'Cancelado — revisar' : paid >= value ? 'Pago' : paid > 0 ? 'Parcial' : 'A pagar'}</strong></div>
                        <div className="flex justify-between"><span>Pago</span><span>{formatCurrency(paid)} / {formatCurrency(value)}</span></div>
                        <div className="flex justify-between"><span>Vencimento</span><span>{formatDateOnly(financial.due_date)}</span></div>
                      </div>}
                    </CardContent>
                  </Card>;
                })}

                {selectedClosing.status === 'aberto' ? <div className="space-y-3 rounded-xl border p-3">
                  <div><Label>Vencimento das contas a pagar</Label><Input type="date" value={confirmDueDate} onChange={e => setConfirmDueDate(e.target.value)} /></div>
                  <p className="text-xs text-muted-foreground">Ao confirmar, será criada uma obrigação financeira por operador com valor positivo. Nenhum pagamento será realizado aqui.</p>
                  <div className="flex gap-2">
                    <Button className="flex-1" disabled={confirming || !confirmDueDate} onClick={() => void handleConfirm(selectedClosing.id)}><ArrowRight className="h-4 w-4 mr-2" />{confirming ? 'Enviando...' : 'Confirmar → Financeiro'}</Button>
                    <Button variant="destructive" onClick={() => void handleDelete(selectedClosing.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div> : <Alert><CircleDollarSign className="h-4 w-4" /><AlertDescription>O pagamento deste fechamento é controlado pelo Financeiro. Alterações de valor pago são refletidas automaticamente neste status.</AlertDescription></Alert>}
              </div>
            </>;
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
