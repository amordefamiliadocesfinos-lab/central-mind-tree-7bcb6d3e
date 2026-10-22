import { useCallback, useEffect, useMemo, useState } from 'react';
import { PackageOpen, RefreshCw, ShieldCheck } from 'lucide-react';
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

const AMENDOIM_ID = 'c177f332-a1c7-4276-9cef-7b81af920174';
const GRAMS_PER_E24 = 24000;

type ClosedRow = { storage_location_id: string; sacks: number };
type GramRow = { location: string; quantity: number };

export function AmendoimPhysicalStockManager({ onConverted }: {
  onConverted?: () => void | Promise<void>;
}) {
  const { locations } = useStorageLocations();
  const [locationId, setLocationId] = useState('');
  const [direction, setDirection] = useState<'reclassify' | 'open'>('reclassify');
  const [sacksText, setSacksText] = useState('1');
  const [confirmed, setConfirmed] = useState(false);
  const [sealedRows, setSealedRows] = useState<ClosedRow[]>([]);
  const [gramRows, setGramRows] = useState<GramRow[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeLocations = useMemo(() => locations.filter(loc => loc.is_active !== false), [locations]);
  useEffect(() => {
    if (!activeLocations.some(loc => loc.id === locationId)) {
      setLocationId(activeLocations.find(loc => loc.name === 'Fábrica')?.id ?? activeLocations[0]?.id ?? '');
    }
  }, [activeLocations, locationId]);

  const refresh = useCallback(async () => {
    setFetchError(false);
    try {
      const [closed, opened] = await Promise.all([
        (supabase as any).from('amendoim_sealed_stock').select('storage_location_id,sacks'),
        supabase.from('inventory').select('location,quantity')
          .eq('product_id', AMENDOIM_ID).is('variant_id', null),
      ]);
      if (closed.error) throw closed.error;
      if (opened.error) throw opened.error;
      setSealedRows((closed.data ?? []).map((row: any) => ({
        storage_location_id: row.storage_location_id, sacks: Number(row.sacks),
      })));
      setGramRows((opened.data ?? []).map(row => ({
        location: row.location, quantity: Number(row.quantity),
      })));
    } catch (error) {
      setFetchError(true);
      toast.error(error instanceof Error ? error.message : 'Não foi possível consultar E24/EG.');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const selected = activeLocations.find(loc => loc.id === locationId);
  const sealedSacks = sealedRows.find(row => row.storage_location_id === locationId)?.sacks ?? 0;
  const gramBalance = gramRows.filter(row => row.location === selected?.name)
    .reduce((sum, row) => sum + row.quantity, 0);
  const sacks = Number(sacksText);
  const validCount = Number.isSafeInteger(sacks) && sacks >= 1 && sacks <= 100;
  const gramsToConvert = validCount ? sacks * GRAMS_PER_E24 : 0;
  const canConvert = !!selected && !fetchError && !busy && confirmed && validCount
    && (direction === 'reclassify' ? gramBalance >= gramsToConvert : sealedSacks >= sacks);

  const confirmPhysicalFact = async () => {
    if (!canConvert || !selected) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)('amendoim_convert_physical_stock', {
        p_direction: direction,
        p_sacks: sacks,
        p_location_id: selected.id,
        p_event_key: `amendoim:${crypto.randomUUID()}`,
        p_confirmed: true,
      });
      if (error) throw error;
      if (!data?.success) throw new Error('O fato físico não foi registrado.');
      notifyInventoryChanged();
      await refresh();
      await onConverted?.();
      setConfirmed(false);
      toast.success(direction === 'open'
        ? 'Abertura física registrada: E24 convertido em 24.000 g por saco no EG.'
        : 'Inventário físico registrado: sacos lacrados identificados no saldo histórico.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao registrar estado físico.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex gap-2 items-center">
          <PackageOpen className="h-4 w-4" /> Amendoim Torrado — E24 fechado / EG em gramas
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Controle de inventário físico, sem rotina adicional para o funcionário da produção.
          O histórico em gramas NÃO comprova quantos sacos originais de 24 kg estão lacrados.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Local físico</Label>
            <Select value={locationId} onValueChange={val => { setLocationId(val); setConfirmed(false); }}>
              <SelectTrigger><SelectValue placeholder="Selecionar local"/></SelectTrigger>
              <SelectContent>{activeLocations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Fato físico constatado</Label>
            <Select value={direction} onValueChange={val => {
              setDirection(val as 'reclassify' | 'open'); setConfirmed(false);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reclassify">Conferir sacos lacrados no legado</SelectItem>
                <SelectItem value="open">Registrar abertura física de E24</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Número de sacos físicos</Label>
            <Input type="number" min="1" max="100" step="1" value={sacksText}
              onChange={e => { setSacksText(e.target.value); setConfirmed(false); }}/>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 text-sm">
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <strong>E24 fechado:</strong> {sealedSacks} saco(s) original(is) de 24 kg
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <strong>Saldo EG/legado:</strong> {gramBalance.toLocaleString('pt-BR')} g
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {direction === 'reclassify'
            ? `Somente após contar ${validCount ? sacks : '?'} saco(s) REALMENTE lacrado(s) dentro do saldo legado: retirar ${validCount ? gramsToConvert.toLocaleString('pt-BR') : '?'} g desse saldo e registrar o mesmo material como E24. Não considerar sacos já abertos.`
            : `Somente se ${validCount ? sacks : '?'} saco(s) E24 já foram fisicamente abertos: retirar esses sacos do E24 e adicionar ${validCount ? gramsToConvert.toLocaleString('pt-BR') : '?'} g ao EG.`}
        </p>
        <label className="flex items-start gap-2 text-sm cursor-pointer">
          <Checkbox checked={confirmed} onCheckedChange={val => setConfirmed(val === true)}/>
          <span>
            {direction === 'reclassify'
              ? 'Realizei a conferência física; os sacos informados ainda estão lacrados e estão incluídos no saldo legado em gramas.'
              : 'A abertura física dos sacos informados realmente aconteceu no local selecionado.'}
          </span>
        </label>
        <div className="flex gap-2 flex-wrap">
          <Button disabled={!canConvert} onClick={() => void confirmPhysicalFact()}>
            <ShieldCheck className="h-4 w-4 mr-1"/>
            {busy ? 'Registrando...' : 'Registrar fato físico confirmado'}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4 mr-1"/> Atualizar saldos
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          AM-2 não transforma automaticamente os 77.344 g anteriores em sacos.
          Recebimentos novos e venda do saco original E24 serão tratados na AM-3.
        </p>
      </CardContent>
    </Card>
  );
}
