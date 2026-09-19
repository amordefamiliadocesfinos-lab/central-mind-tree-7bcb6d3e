import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PurchaseOrder } from '@/hooks/usePurchases';
import { parseDecimalInput } from '@/lib/decimal';
import {
  buildPurchaseFinancialInstallments,
  getPurchaseCommercialTotal,
  validatePurchaseFinancialInstallments,
  type PurchaseFinancialConditionPreset,
  type PurchaseFinancialInstallment,
} from '@/lib/purchases/purchaseFinancialCondition';
import { formatCurrency } from '@/lib/utils';

interface PurchaseFinancialConditionDialogProps {
  order: PurchaseOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onValidated: (installments: PurchaseFinancialInstallment[]) => void;
}

interface DraftInstallment {
  id: string;
  value: string;
  due_date: string;
}

function toDraft(installments: PurchaseFinancialInstallment[]): DraftInstallment[] {
  return installments.map(installment => ({
    id: crypto.randomUUID(),
    value: String(installment.value).replace('.', ','),
    due_date: installment.due_date,
  }));
}

function parseMoney(value: string) {
  return parseDecimalInput(value, { min: 0, maxDecimals: 2, locale: 'pt-BR' })?.number ?? 0;
}

export function PurchaseFinancialConditionDialog({
  order,
  open,
  onOpenChange,
  onValidated,
}: PurchaseFinancialConditionDialogProps) {
  const [preset, setPreset] = useState<PurchaseFinancialConditionPreset>('avista');
  const [rows, setRows] = useState<DraftInstallment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const total = useMemo(() => order ? getPurchaseCommercialTotal(order) : 0, [order]);

  useEffect(() => {
    if (!open || !order) return;
    setPreset('avista');
    setRows(toDraft(buildPurchaseFinancialInstallments('avista', getPurchaseCommercialTotal(order))));
    setError(null);
  }, [open, order]);

  const applyPreset = (nextPreset: PurchaseFinancialConditionPreset) => {
    setPreset(nextPreset);
    setError(null);
    if (nextPreset !== 'personalizado') {
      setRows(toDraft(buildPurchaseFinancialInstallments(nextPreset, total)));
    }
  };

  const addInstallment = () => {
    setPreset('personalizado');
    setError(null);
    setRows(current => [...current, {
      id: crypto.randomUUID(),
      value: '',
      due_date: '',
    }]);
  };

  const removeInstallment = (id: string) => {
    setPreset('personalizado');
    setError(null);
    setRows(current => current.filter(row => row.id !== id));
  };

  const updateInstallment = (id: string, patch: Partial<Omit<DraftInstallment, 'id'>>) => {
    setPreset('personalizado');
    setError(null);
    setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  };

  const handleValidate = () => {
    const installments = rows.map((row, index) => ({
      installment_number: index + 1,
      value: parseMoney(row.value),
      due_date: row.due_date,
    }));
    const validation = validatePurchaseFinancialInstallments(total, installments);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    setError(null);
    onValidated(validation.installments);
  };

  const enteredTotal = rows.reduce((sum, row) => sum + parseMoney(row.value), 0);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Condição financeira · ${order?.internal_purchase_number ?? 'Compra'}`}
      className="sm:max-w-2xl"
      footer={(
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p>Total comercial: <strong>{formatCurrency(total)}</strong></p>
            <p className={Math.abs(enteredTotal - total) > 0.01 ? 'text-destructive' : 'text-muted-foreground'}>
              Soma das parcelas: {formatCurrency(enteredTotal)}
            </p>
          </div>
          <Button onClick={handleValidate}>Validar condição</Button>
        </div>
      )}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Condição</Label>
          <Select value={preset} onValueChange={value => applyPreset(value as PurchaseFinancialConditionPreset)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="avista">À vista</SelectItem>
              <SelectItem value="30dias">30 dias</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Parcelas</h3>
              <p className="text-xs text-muted-foreground">A soma deve ser igual ao total comercial da compra.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addInstallment}>
              <Plus className="mr-1 h-4 w-4" />Adicionar parcela
            </Button>
          </div>

          {rows.map((row, index) => (
            <div key={row.id} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[80px_1fr_1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label>Parcela</Label>
                <Input value={index + 1} disabled />
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  inputMode="decimal"
                  value={row.value}
                  onChange={event => updateInstallment(row.id, { value: event.target.value })}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-2">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={row.due_date}
                  onChange={event => updateInstallment(row.id, { due_date: event.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={rows.length === 1}
                onClick={() => removeInstallment(row.id)}
                aria-label={`Remover parcela ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          Esta etapa apenas captura e valida a condição financeira. A criação das obrigações financeiras será feita pela etapa 02C.
        </p>
      </div>
    </ResponsiveDialog>
  );
}
