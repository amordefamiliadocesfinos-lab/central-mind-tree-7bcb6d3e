import { useState } from 'react';
import { CalendarClock, CheckCircle2, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CRM_CANONICAL_RESULTS } from '@/lib/crm/canonical/results';
import type { CrmResultCode } from '@/lib/crm/canonical/types';

interface Props {
  busy?: boolean;
  onOutcome: (resultCode: CrmResultCode, scheduledFor?: string | null) => void | Promise<void>;
  onSnooze: (when: number | string) => void | Promise<void>;
}

export function AttendanceActionBar({ busy = false, onOutcome, onSnooze }: Props) {
  const [mode, setMode] = useState<'outcome' | 'snooze' | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [resultCode, setResultCode] = useState<CrmResultCode | ''>('');
  const selectedResult = CRM_CANONICAL_RESULTS.find(result => result.code === resultCode);
  const needsReturnDate = resultCode === 'CRM-RES-022';

  const submitResult = async () => {
    if (!resultCode || (needsReturnDate && !date)) return;
    await onOutcome(resultCode, date ? (time ? `${date}T${time}` : date) : null);
    setMode(null);
    setResultCode('');
    setDate(''); setTime('');
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="h-8 flex-1 gap-1 text-xs" disabled={busy} onClick={() => setMode(mode === 'outcome' ? null : 'outcome')}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          Registrar resultado <ChevronDown className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="outline" className="h-8 flex-1 gap-1 text-xs" disabled={busy} onClick={() => setMode(mode === 'snooze' ? null : 'snooze')}>
          <CalendarClock className="h-3.5 w-3.5" /> Adiar
        </Button>
      </div>
      {mode === 'outcome' && (
        <div className="space-y-2 rounded-md border bg-background p-2">
          <Select value={resultCode} onValueChange={value => setResultCode(value as CrmResultCode)}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione o resultado do atendimento" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {CRM_CANONICAL_RESULTS.map(result => (
                <SelectItem key={result.code} value={result.code} className="text-xs">
                  {result.code.replace('CRM-RES-', '')} · {result.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedResult && <p className="text-[11px] text-muted-foreground">{selectedResult.description}</p>}
          {(needsReturnDate || date) && (
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" className="h-8 text-xs" value={date} min={new Date().toISOString().slice(0, 10)} onChange={event => setDate(event.target.value)} />
              <Input type="time" className="h-8 text-xs" value={time} onChange={event => setTime(event.target.value)} aria-label="Horário do retorno (opcional)" />
            </div>
          )}
          {needsReturnDate && <p className="text-[11px] text-amber-700 dark:text-amber-400">Informe a data combinada. Sem horário, o retorno fica acionável durante todo o dia.</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setMode(null); setResultCode(''); setDate(''); setTime(''); }}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs" disabled={!resultCode || (needsReturnDate && !date) || busy} onClick={() => void submitResult()}>Confirmar resultado</Button>
          </div>
        </div>
      )}
      {mode === 'snooze' && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={async () => { await onSnooze(1); setMode(null); }}>Amanhã</Button>
            <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={async () => { await onSnooze(3); setMode(null); }}>3 dias</Button>
            <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={async () => { await onSnooze(7); setMode(null); }}>7 dias</Button>
          </div>
          <div className="flex gap-2">
            <Input type="date" className="h-8 text-xs" value={date} min={new Date().toISOString().slice(0, 10)} onChange={event => setDate(event.target.value)} />
            <Button size="sm" className="h-8 text-xs" disabled={!date} onClick={async () => { await onSnooze(date); setMode(null); setDate(''); }}>Confirmar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
