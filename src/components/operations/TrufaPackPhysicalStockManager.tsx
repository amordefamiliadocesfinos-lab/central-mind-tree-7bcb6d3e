import { useCallback, useEffect, useMemo, useState } from 'react';
import { PackageOpen, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStorageLocations } from '@/hooks/useStorageLocations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TRUFA_PACK_MASTER_ID } from '@/lib/orders/trufaSealedP100';

type Variant = { id: string; variant_name: string };
type Pack = { variant_id: string; storage_location_id: string; packs: number };
type Unit = { variant_id: string | null; location: string; quantity: number };

/** ET1 safe inventory viewer. Physical reclassification remains unavailable
 * until a controlled role/permission contract is approved and verified. */
export function TrufaPackPhysicalStockManager() {
  const { locations } = useStorageLocations();
  const [locationId, setLocationId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [variantRes, packRes, unitRes] = await Promise.all([
        (supabase as any).from('product_variants').select('id,variant_name')
          .eq('product_id', TRUFA_PACK_MASTER_ID).eq('is_active', true).order('variant_name'),
        (supabase as any).from('trufa_pack_sealed_stock').select('variant_id,storage_location_id,packs'),
        supabase.from('inventory').select('variant_id,location,quantity').eq('product_id', TRUFA_PACK_MASTER_ID),
      ]);
      if (variantRes.error) throw variantRes.error;
      if (packRes.error) throw packRes.error;
      if (unitRes.error) throw unitRes.error;
      setVariants((variantRes.data ?? []) as Variant[]);
      setPacks((packRes.data ?? []).map((row: Pack) => ({...row,packs:Number(row.packs)})));
      setUnits((unitRes.data ?? []).map((row: Unit) => ({...row,quantity:Number(row.quantity)})));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar o estoque P100.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const activeLocations = useMemo(() => locations.filter(location => location.is_active !== false), [locations]);
  useEffect(() => {
    if (!activeLocations.some(loc => loc.id===locationId))
      setLocationId(activeLocations.find(loc=>loc.name==='Fábrica')?.id ?? activeLocations[0]?.id ?? '');
  }, [activeLocations,locationId]);
  useEffect(() => {
    if (!variants.some(variant=>variant.id===variantId)) setVariantId(variants[0]?.id ?? '');
  }, [variants,variantId]);

  const selectedLocation = activeLocations.find(loc=>loc.id===locationId);
  const sealed = packs.filter(row => row.variant_id===variantId && row.storage_location_id===locationId)
    .reduce((sum,row)=>sum+row.packs,0);
  const loose = units.filter(row=>row.variant_id===variantId && row.location===selectedLocation?.name)
    .reduce((sum,row)=>sum+row.quantity,0);

  return <Card>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 text-base"><PackageOpen className="h-4 w-4"/> Embalagem para Trufa — P100 / EA</CardTitle>
      <p className="text-xs text-muted-foreground">Pacotes lacrados e unidades abertas são identidades de estoque distintas. O saldo histórico EA não comprova pacotes fechados.</p>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={locationId} onValueChange={setLocationId}>
          <SelectTrigger><SelectValue placeholder="Local físico"/></SelectTrigger>
          <SelectContent>{activeLocations.map(loc=><SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={variantId} onValueChange={setVariantId}>
          <SelectTrigger><SelectValue placeholder="Sabor da embalagem"/></SelectTrigger>
          <SelectContent>{variants.map(v=><SelectItem key={v.id} value={v.id}>{v.variant_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {error ? <p className="text-sm text-destructive">Controle P100 indisponível: {error}. Nenhuma conversão permitida.</p> :
      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        <div className="rounded border p-3"><strong>P100 lacrado:</strong> {sealed} pacote(s)</div>
        <div className="rounded border p-3"><strong>EA avulso:</strong> {loose.toLocaleString('pt-BR')} unidade(s)</div>
      </div>}
      <p className="text-xs text-muted-foreground">Conferência e reclassificação física exigem habilitação de permissão administrativa. Nenhuma conversão é executada nesta tela.</p>
      <Button variant="outline" disabled={loading} onClick={()=>void refresh()}><RefreshCw className="mr-2 h-4 w-4"/>{loading?'Consultando...':'Atualizar saldos'}</Button>
    </CardContent>
  </Card>;
}
