import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Package, PackageOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import { useStorageLocations } from '@/hooks/useStorageLocations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRODUCT_ID = 'c4580ad6-e53a-4a36-9696-a65f2a95da00';
const FLAVORS = {
  Tradicional: { unitId: 'fa0814a0-9cd0-4d8a-b01d-2febdd1d7dcc', boxSku: 'BIS-CX8-TRAD' },
  Chocolate: { unitId: '34188174-5906-4f92-a16d-4e5207f37dd5', boxSku: 'BIS-CX8-CHOC' },
} as const;
type Flavor = keyof typeof FLAVORS;
type Direction = 'seal' | 'open';
type Balance = { variant_id: string | null; location: string; quantity: number };

export function BiscuitBoxStockManager({ onConverted }: { onConverted?: () => void | Promise<void> }) {
  const { locations } = useStorageLocations();
  const [flavor, setFlavor] = useState<Flavor>('Tradicional');
  const [direction, setDirection] = useState<Direction>('seal');
  const [location, setLocation] = useState('');
  const [boxes, setBoxes] = useState('1');
  const [packages, setPackages] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [boxVariants, setBoxVariants] = useState<Record<string, string>>({});
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (locations.length && !locations.some(item => item.name === location)) {
      setLocation(locations[0].name);
    }
  }, [locations, location]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [variants, stocks] = await Promise.all([
        supabase.from('product_variants').select('id,sku').eq('product_id', PRODUCT_ID),
        supabase.from('inventory').select('variant_id,location,quantity').eq('product_id', PRODUCT_ID),
      ]);
      if (variants.error) throw variants.error;
      if (stocks.error) throw stocks.error;
      setBoxVariants(Object.fromEntries((variants.data ?? [])
        .filter(item => item.sku === 'BIS-CX8-TRAD' || item.sku === 'BIS-CX8-CHOC')
        .map(item => [item.sku, item.id])));
      setBalances((stocks.data ?? []).map(item => ({
        variant_id: item.variant_id, location: item.location, quantity: Number(item.quantity),
      })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível consultar as caixas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const selection = FLAVORS[flavor];
  const boxVariantId = boxVariants[selection.boxSku];
  const stock = useMemo(() => {
    const balance = (variantId: string | undefined) => balances
      .filter(item => item.variant_id === variantId && item.location === location)
      .reduce((sum, item) => sum + item.quantity, 0);
    return { units: balance(selection.unitId), boxes: balance(boxVariantId) };
  }, [balances, location, selection.unitId, boxVariantId]);

  const boxCount = Number(boxes);
  const packetCount = packages.trim() === '' ? NaN : Number(packages);
  const validCount = Number.isSafeInteger(boxCount) && boxCount > 0 && boxCount <= 1000;
  const validPackets = direction === 'seal' || (
    Number.isSafeInteger(packetCount) && packetCount > 0 && packetCount <= boxCount * 100
  );
  const neededUnits = boxCount * 880;
  const enoughStock = direction === 'seal' ? stock.units >= neededUnits : stock.boxes >= boxCount;
  const canConvert = Boolean(boxVariantId && location && confirmed && validCount && validPackets && enoughStock && !submitting);

  const convert = async () => {
    if (!canConvert) return;
    setSubmitting(true);
    try {
      const { data, error } = await (supabase.rpc as any)('convert_biscuit_closed_box_stock', {
        p_unit_variant_id: selection.unitId,
        p_direction: direction,
        p_boxes: boxCount,
        p_packages: direction === 'open' ? packetCount : null,
        p_location: location,
        p_event_key: `biscuit_box:${crypto.randomUUID()}`,
        p_confirmed: confirmed,
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Conversão de estoque não confirmada.');
      notifyInventoryChanged();
      await refresh();
      await onConverted?.();
      setConfirmed(false);
      setPackages('');
      toast.success(direction === 'seal'
        ? 'Caixa lacrada registrada sem duplicar o estoque em unidades.'
        : 'Abertura registrada com a contagem real de pacotes.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível converter as caixas.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Package className="h-4 w-4" /> Biscoito para Alfajor — caixas fechadas de 8 kg
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          BA3: cada caixa lacrada é uma unidade física (cx). Os saldos históricos em biscoitos
          continuam preservados até você identificar e reclassificar caixas reais.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!boxVariants['BIS-CX8-TRAD'] || !boxVariants['BIS-CX8-CHOC'] ? (
          <p role="alert" className="text-sm text-amber-700">
            As variantes físicas de caixa ainda não estão disponíveis no banco. Verifique a migration antes de utilizar.
          </p>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <Label>Tipo</Label>
            <Select value={flavor} onValueChange={value => { setFlavor(value as Flavor); setConfirmed(false); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Tradicional">Tradicional</SelectItem>
                <SelectItem value="Chocolate">Chocolate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Local físico</Label>
            <Select value={location} onValueChange={value => { setLocation(value); setConfirmed(false); }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{locations.filter(item => item.is_active !== false).map(item =>
                <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
              )}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Movimento</Label>
            <Select value={direction} onValueChange={value => { setDirection(value as Direction); setConfirmed(false); setPackages(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="seal">Registrar caixa lacrada</SelectItem>
                <SelectItem value="open">Abrir caixa e contar pacotes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-sm">
          Saldo em {location || 'local não selecionado'}: <strong>{stock.boxes} caixa(s) fechada(s)</strong>
          {' · '}<strong>{stock.units} biscoitos</strong> no controle legado.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>Número de caixas {direction === 'open' ? 'abertas' : 'lacradas conferidas'}</Label>
            <Input type="number" min={1} step={1} value={boxes} onChange={event => { setBoxes(event.target.value); setConfirmed(false); }} />
          </div>
          {direction === 'open' && (
            <div>
              <Label>Pacotes realmente contados após abrir</Label>
              <Input type="number" min={1} step={1} value={packages}
                onChange={event => { setPackages(event.target.value); setConfirmed(false); }}
                placeholder="Conte os pacotes, não presuma 40" />
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {direction === 'seal'
            ? `Para ${validCount ? boxCount : '?'} caixa(s) lacrada(s), o lançamento legado desloca ${validCount ? neededUnits : '?'} un estimadas para estoque em cx. Não é contagem dos biscoitos dentro da caixa.`
            : `Abertura física: ${validCount ? boxCount : '?'} cx serão convertidas conforme a contagem real de pacotes, considerando 22 biscoitos garantidos por pacote; extras não são presumidos.`}
        </p>
        {!enoughStock && validCount && (
          <p className="text-sm text-amber-700">
            Saldo insuficiente na origem. Não é permitido criar caixas ou unidades sem respaldo no estoque físico registrado.
          </p>
        )}
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} />
          <span>
            {direction === 'seal'
              ? 'Conferi fisicamente que as caixas indicadas estão fechadas e fazem parte do saldo legado em unidades.'
              : 'Abri as caixas indicadas e contei fisicamente todos os pacotes informados.'}
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void convert()} disabled={!canConvert || loading}>
            <PackageOpen className="mr-2 h-4 w-4" />
            {submitting ? 'Registrando...' : direction === 'seal' ? 'Confirmar caixas lacradas' : 'Confirmar abertura física'}
          </Button>
          <Button variant="outline" disabled={submitting || loading} onClick={() => void refresh()}>Atualizar saldos</Button>
        </div>
      </CardContent>
    </Card>
  );
}
