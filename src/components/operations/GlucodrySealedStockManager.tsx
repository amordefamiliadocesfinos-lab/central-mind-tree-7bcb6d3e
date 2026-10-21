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
import { GLUCODRY_PRODUCT_ID } from '@/lib/orders/commercialOrderItem';

type SealedRow = { storage_location_id: string; sacks: number };
type GramRow = { location_id: string | null; quantity: number };

export function GlucodrySealedStockManager({ onConverted }: { onConverted?: () => void | Promise<void> }) {
  const { locations } = useStorageLocations();
  const [locationId, setLocationId] = useState('');
  const [direction, setDirection] = useState<'open' | 'reclassify'>('reclassify');
  const [sacksText, setSacksText] = useState('1');
  const [confirmed, setConfirmed] = useState(false);
  const [sackBalances, setSackBalances] = useState<SealedRow[]>([]);
  const [grams, setGrams] = useState<GramRow[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeLocations = locations.filter(location => location.is_active !== false);
  useEffect(() => {
    if (!activeLocations.some(location => location.id === locationId)) {
      setLocationId(activeLocations[0]?.id ?? '');
    }
  }, [locations, locationId]);

  const refresh = useCallback(async () => {
    setFetchError(false);
    try {
      const [closed, opened] = await Promise.all([
        (supabase as any).from('glucodry_sealed_stock').select('storage_location_id,sacks'),
        supabase.from('inventory').select('location_id,quantity').eq('product_id', GLUCODRY_PRODUCT_ID).is('variant_id', null),
      ]);
      if (closed.error) throw closed.error;
      if (opened.error) throw opened.error;
      setSackBalances((closed.data ?? []).map((x: any) => ({ storage_location_id: x.storage_location_id, sacks: Number(x.sacks) })));
      setGrams((opened.data ?? []).map(x => ({ location_id: x.location_id, quantity: Number(x.quantity) })));
    } catch (error) {
      setFetchError(true);
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar saldos do Glucodry.');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const sacks = Number(sacksText);
  const selectedLocation = activeLocations.find(item => item.id === locationId);
  const sealedAvailable = useMemo(() => sackBalances.find(item => item.storage_location_id === locationId)?.sacks ?? 0,[sackBalances,locationId]);
  const legacyGrams = useMemo(() => grams.filter(item => item.location_id === locationId).reduce((sum,item) => sum+item.quantity,0),[grams,locationId]);
  const isCountValid = Number.isSafeInteger(sacks) && sacks > 0 && sacks <= 1000;
  const canConvert = !fetchError && !busy && confirmed && Boolean(locationId) && isCountValid &&
    (direction === 'open' ? sealedAvailable >= sacks : legacyGrams >= sacks * 25000);

  const convert = async () => {
    if (!canConvert) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)('glucodry_convert_physical_stock', {
        p_direction: direction,
        p_sacks: sacks,
        p_location_id: locationId,
        p_event_key: `glucodry:${crypto.randomUUID()}`,
        p_confirmed: true,
      });
      if (error) throw error;
      if (!data?.success) throw new Error('A conversão física não foi confirmada.');
      notifyInventoryChanged();
      await refresh();
      await onConverted?.();
      setConfirmed(false);
      toast.success(direction === 'open'
        ? 'Abertura física registrada: estoque de saco fechado convertido para gramas.'
        : 'Sacos efetivamente lacrados reclassificados sem duplicar gramas.');
    } catch(error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar a operação.');
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><PackageOpen className="h-4 w-4"/> Glucodry — saco lacrado 25 kg / fracionamento</CardTitle>
        <p className="text-xs text-muted-foreground">GD2 controla sacos reais separadamente das gramas do GD1. Os saldos históricos em gramas não são convertidos automaticamente.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>Local físico</Label>
            <Select value={locationId} onValueChange={value => { setLocationId(value); setConfirmed(false); }}>
              <SelectTrigger><SelectValue placeholder="Selecionar local"/></SelectTrigger>
              <SelectContent>{activeLocations.map(location => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Fato físico</Label>
            <Select value={direction} onValueChange={value => { setDirection(value as 'open' | 'reclassify');setConfirmed(false); }}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="reclassify">Identificar sacos lacrados no saldo legado</SelectItem>
                <SelectItem value="open">Abrir sacos lacrados para fracionar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Número de sacos conferidos</Label>
            <Input type="number" min="1" step="1" value={sacksText} onChange={e => { setSacksText(e.target.value); setConfirmed(false); }}/>
          </div>
        </div>
        <div className="text-sm">
          <strong>{selectedLocation?.name ?? 'Local'}:</strong> {sealedAvailable} saco(s) fechado(s) de 25 kg;
          {' '}{legacyGrams.toLocaleString('pt-BR')} g no saldo em gramas.
        </div>
        <p className="text-xs text-muted-foreground">
          {direction === 'reclassify'
            ? `Apenas com a conferência de ${isCountValid ? sacks : '?'} saco(s) realmente lacrado(s): retirar ${isCountValid ? (25000*sacks).toLocaleString('pt-BR') : '?'} g do saldo legado e adicionar ${isCountValid ? sacks : '?'} saco(s) fechado(s). Nunca faça isso sobre gramas já abertas ou já consumidas.`
            : `Apenas após abertura física de ${isCountValid ? sacks : '?'} saco(s): retirar do saldo de sacos fechados e adicionar ${isCountValid ? (25000*sacks).toLocaleString('pt-BR') : '?'} g fracionáveis.`}
        </p>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox checked={confirmed} onCheckedChange={value=>setConfirmed(value===true)}/>
          <span>{direction==='open'
            ? 'Confirmei a abertura física dos sacos informados, que estavam lacrados.'
            : 'Conferi fisicamente os sacos ainda lacrados e confirmei que eles pertencem ao saldo legado em gramas.'}</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          <Button disabled={!canConvert} onClick={()=>void convert()}>{busy ? 'Registrando...' : 'Confirmar fato físico'}</Button>
          <Button variant="outline" disabled={busy} onClick={()=>void refresh()}><RefreshCw className="h-4 w-4 mr-1"/> Atualizar saldos</Button>
        </div>
      </CardContent>
    </Card>
  );
}
