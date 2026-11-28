import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinancialEntry, FinancialAccount } from '@/hooks/useFinancial';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: FinancialEntry;
  accounts: FinancialAccount[];
  onConfirm: (value: number, accountId?: string, notes?: string, paymentDate?: string) => Promise<void>;
  partial?: boolean;
  onAdvanced?: () => void;
}

export function PaymentDialog({ open, onOpenChange, entry, accounts, onConfirm, partial = false, onAdvanced }: PaymentDialogProps) {
  const remaining = entry.value - entry.value_paid;
  const [value, setValue] = useState(partial ? '' : remaining.toString());
  const [accountId, setAccountId] = useState(entry.account_id || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [error, setError] = useState('');
  const validAccount = accounts.some(a => a.id === accountId && a.is_active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numValue = parseFloat(value);
    if (loading || !validAccount || !paymentDate || !Number.isFinite(numValue) || numValue <= 0 || numValue > remaining) return;
    setError('');

    setLoading(true);
    try {
      await onConfirm(numValue, accountId, notes || undefined, paymentDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível confirmar a baixa. Confira o lançamento antes de tentar novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleFullPayment = () => {
    setValue(remaining.toString());
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!loading) onOpenChange(next); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar {entry.type === 'pagar' ? 'Pagamento' : 'Recebimento'}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-muted p-3 space-y-1">
          <p className="font-medium">{entry.description}</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor total:</span>
            <span>{formatCurrency(entry.value)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Já pago:</span>
            <span>{formatCurrency(entry.value_paid)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span>Restante:</span>
            <span className="text-primary">{formatCurrency(remaining)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Valor da baixa *</Label>
              <Button type="button" variant="link" size="sm" onClick={handleFullPayment}>
                Baixar total
              </Button>
            </div>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={remaining}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Conta financeira *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar conta..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.filter(acc => acc.is_active).map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.current_balance)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data da movimentação *</Label>
            <Input type="date" required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <details className="space-y-2">
            <summary className="cursor-pointer text-sm text-muted-foreground">Adicionar observações</summary>
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações da baixa..."
              rows={2}
            />
          </details>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {onAdvanced && <Button type="button" variant="link" disabled={loading} onClick={onAdvanced}>Opções avançadas de baixa</Button>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !validAccount || !paymentDate || !value}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Baixa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
