import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OPERATIONAL_DESTINATION_LABELS } from '@/lib/orders/operationalDestination';
import type { OperationalDestination } from '@/lib/orders/operationalDestination';

interface OperationalDestinationFieldsProps {
  destination: OperationalDestination | null | undefined;
  logisticsMode: string | null | undefined;
  details: Record<string, unknown> | null | undefined;
  onChange: (value: {
    destination: OperationalDestination | null;
    logisticsMode: string;
    details: Record<string, unknown>;
  }) => void;
}

export function OperationalDestinationFields({
  destination,
  logisticsMode,
  details,
  onChange,
}: OperationalDestinationFieldsProps) {
  const notes = typeof details?.notes === 'string' ? details.notes : '';
  const currentValue = destination ?? '__undefined__';

  const emit = (next: Partial<{
    destination: OperationalDestination | null;
    logisticsMode: string;
    details: Record<string, unknown>;
  }>) => onChange({
    destination: destination ?? null,
    logisticsMode: logisticsMode ?? '',
    details: details ?? {},
    ...next,
  });

  return <section className="space-y-3 rounded-lg border bg-muted/20 p-3">
    <Label className="text-sm font-semibold">DESTINO OPERACIONAL</Label>
    <div>
      <Label htmlFor="operational-destination" className="text-xs">Destino</Label>
      <Select value={currentValue} onValueChange={value => emit({ destination: value === '__undefined__' ? null : value as OperationalDestination })}>
        <SelectTrigger id="operational-destination" className="mt-1 h-10"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__undefined__">Destino a definir</SelectItem>
          {Object.entries(OPERATIONAL_DESTINATION_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    <div>
      <Label htmlFor="operational-logistics-mode" className="text-xs">Modalidade / observação logística</Label>
      <Input id="operational-logistics-mode" className="mt-1 h-10" value={logisticsMode ?? ''} onChange={event => emit({ logisticsMode: event.target.value })} placeholder="Ex.: entrega agendada" />
    </div>
    <div>
      <Label htmlFor="operational-destination-details" className="text-xs">Detalhes do destino</Label>
      <Textarea id="operational-destination-details" className="mt-1" value={notes} onChange={event => emit({ details: event.target.value.trim() ? { notes: event.target.value } : {} })} placeholder="Ex.: Cliente solicitou envio após as 18h" rows={2} />
    </div>
  </section>;
}
