import { useCallback, useEffect, useMemo, useState } from 'react';
import { PackageOpen, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import { useStorageLocations } from '@/hooks/useStorageLocations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PHYSICAL_STATES = [
  { family: 'italac', product: 'Italac 395 g', productId: '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b', state: 'originalBoxes27', action: 'open_original_box', label: 'Caixa original fechada (27 × 395 g)', result: '27 unidades intactas por caixa' },
  { family: 'italac', product: 'Italac 395 g', productId: '0d1fb8c8-4938-4bbf-b8f0-b0a525c78d9b', state: 'intactUnits395', action: 'open_intact_unit', label: 'Unidade intacta de 395 g', result: '395 g por unidade para consumo' },
  { family: 'sorbato', product: 'Sorbato de Potássio', productId: '6f43ad65-74d5-4db9-b931-1ecd6d124987', state: 'originalPackages1kg', action: 'open_original_package', label: 'Pacote original fechado de 1 kg', result: '1.000 g por pacote para consumo' },
  { family: 'acido', product: 'Ácido Cítrico', productId: 'ef118d1c-e7c7-45e3-b796-3a9908840f3c', state: 'originalPackages1kg', action: 'open_original_package', label: 'Pacote original fechado de 1 kg', result: '1.000 g por pacote para consumo' },
  { family: 'ivoti', product: 'Doce Cremoso Ivoti', productId: 'd913f0f2-4893-4985-9976-fcd9119a57b1', state: 'originalBuckets98', action: 'open_original_bucket', label: 'Balde original fechado de 9,8 kg', result: '9.800 g por balde para consumo' },
] as const;

type SealedRow = {
  product_id: string;
  storage_location_id: string;
  physical_state: string;
  units: number;
};

export function FourSealedStockManager({ onConverted }: { onConverted?: () => void | Promise<void> }) {
  const { locations } = useStorageLocations();
  const activeLocations = useMemo(() => locations.filter(x => x.is_active !== false), [locations]);
  const [locationId, setLocationId] = useState('');
  const [selection, setSelection] = useState('0');
  const [amountText, setAmountText] = useState('1');
  const [physicalNote, setPhysicalNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [balances, setBalances] = useState<SealedRow[]>([]);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(false);
    const { data, error: queryError } = await (supabase as any)
      .from('p2_four_sealed_stock')
      .select('product_id,storage_location_id,physical_state,units');
    if (queryError) {
      setError(true);
      toast.error('Não foi possível consultar as embalagens originais.');
      return;
    }
    setBalances((data ?? []).map((x: SealedRow) => ({ ...x, units: Number(x.units) })));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!activeLocations.some(x => x.id === locationId)) setLocationId(activeLocations[0]?.id ?? '');
  }, [activeLocations, locationId]);

  const chosen = PHYSICAL_STATES[Number(selection)] ?? PHYSICAL_STATES[0];
  const row = balances.find(x => x.product_id === chosen.productId
    && x.storage_location_id === locationId && x.physical_state === chosen.state);
  const available = row?.units ?? 0;
  const amount = Number(amountText);
  const canOpen = !!row && Number.isSafeInteger(amount) && amount > 0
    && amount <= available && locationId !== '' && confirmed && physicalNote.trim().length >= 15 && !busy;

  async function openPhysically() {
    if (!canOpen) return;
    setBusy(true);
    try {
      const { error: rpcError } = await (supabase.rpc as any)('p2_four_attest_and_open', {
        p_family: chosen.family,
        p_action: chosen.action,
        p_count: amount,
        p_location_id: locationId,
        p_event_key: crypto.randomUUID(),
        p_physical_confirmation: true,
        p_evidence_note: physicalNote.trim(),
      });
      if (rpcError) throw rpcError;
      toast.success('Abertura física registrada com rastreabilidade.');
      setConfirmed(false);
      setPhysicalNote('');
      setAmountText('1');
      await refresh();
      notifyInventoryChanged();
      await onConverted?.();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Abertura não autorizada ou saldo insuficiente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Embalagens originais — Italac, Sorbato, Ácido e Ivoti</CardTitle>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Recipiente original, unidade intacta e produto aberto são estados diferentes.
          Recebimentos acontecem em Compras; saídas comerciais acontecem em Separação.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Localização</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger><SelectValue placeholder="Selecionar local" /></SelectTrigger>
              <SelectContent>{activeLocations.map(x =>
                <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Embalagem e estado físico</Label>
            <Select value={selection} onValueChange={value => { setSelection(value); setConfirmed(false); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PHYSICAL_STATES.map((x, i) =>
                <SelectItem key={x.family + x.state} value={String(i)}>
                  {x.product} — {x.label}
                </SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {error ? (
          <p className="text-sm text-destructive">Leitura indisponível; nenhuma movimentação será autorizada.</p>
        ) : (
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-sm font-medium">{chosen.product} — {chosen.label}</p>
            <p className="text-sm">{row ? `Recipientes disponíveis neste local: ${available}` : 'Nenhum saldo físico registrado para este estado e local.'}</p>
            <p className="text-xs text-muted-foreground">Ao abrir: {chosen.result}.</p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="p2-open-count">Quantidade de recipientes efetivamente abertos</Label>
          <Input id="p2-open-count" type="number" step="1" min="1" value={amountText}
            onChange={e => setAmountText(e.target.value)} disabled={busy} />
          <Label htmlFor="p2-physical-note">Registro da conferência física (mínimo de 15 caracteres)</Label>
          <Input id="p2-physical-note" value={physicalNote} maxLength={1200} disabled={busy}
            placeholder="Identificação da embalagem e confirmação da abertura realizada"
            onChange={e => setPhysicalNote(e.target.value)} />
          <div className="flex items-start gap-2 py-1">
            <Checkbox id="p2-confirm-physical" checked={confirmed} disabled={busy}
              onCheckedChange={value => setConfirmed(value === true)} />
            <Label htmlFor="p2-confirm-physical" className="text-xs leading-5">
              Confirmo que realizei e conferi fisicamente esta abertura, na localização e na quantidade informadas.
            </Label>
          </div>
          <Button type="button" disabled={!canOpen} onClick={() => void openPhysically()}>
            <PackageOpen className="mr-2 h-4 w-4" />
            {busy ? 'Registrando...' : 'Registrar abertura física'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
