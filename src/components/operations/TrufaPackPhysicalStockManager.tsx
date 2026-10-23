import { useCallback, useEffect, useMemo, useState } from 'react';
import { PackageOpen, RefreshCw, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { notifyInventoryChanged } from '@/hooks/useInventorySync';
import { useAuth } from '@/contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
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
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'Administrador';
  const [direction,setDirection] = useState<'reclassify'|'open'>('reclassify');
  const [countText,setCountText] = useState('1');
  const [confirmed,setConfirmed] = useState(false);
  const [saving,setSaving] = useState(false);
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

  const count = Number(countText);
  const validCount = Number.isSafeInteger(count) && count>0 && count<=10000;
  const canConvert = isAdmin && !error && !loading && !saving && confirmed && validCount && Boolean(locationId && variantId) &&
    (direction==='reclassify' ? loose>=count*100 : sealed>=count);
  const convert = async () => {
    if (!canConvert) return;
    setSaving(true);
    try {
      const { data,error:rpcError } = await (supabase.rpc as any)('trufa_pack_convert_physical_stock',{
        p_direction:direction,p_variant_id:variantId,p_packs:count,p_location_id:locationId,
        p_event_key:`trufa-pack:${crypto.randomUUID()}`,p_physically_confirmed:true,
      });
      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error('Conversão física não confirmada');
      notifyInventoryChanged();
      await refresh();
      setConfirmed(false);
      toast.success('Fato físico de embalagem registrado.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha na conversão');
    } finally {setSaving(false);}
  };

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
      {isAdmin ? <div className="space-y-3 rounded border p-3">
        <p className="text-sm font-semibold">Registro administrativo de fato físico</p>
        <p className="text-xs text-muted-foreground">Reclassifique apenas pacotes realmente lacrados identificados dentro do saldo EA histórico, ou registre abertura que já ocorreu fisicamente. Não converta unidades por estimativa.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div><Label>Operação confirmada</Label><Select value={direction} onValueChange={v=>{setDirection(v as 'open'|'reclassify');setConfirmed(false);}}>
            <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
              <SelectItem value="reclassify">Conferência: EA → P100 fechado</SelectItem>
              <SelectItem value="open">Abertura física: P100 → EA</SelectItem>
            </SelectContent></Select></div>
          <div><Label>Pacotes de 100 unidades</Label>
            <Input type="number" min="1" max="10000" step="1" value={countText} onChange={e=>{setCountText(e.target.value);setConfirmed(false);}}/>
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={v=>setConfirmed(v===true)}/>
          <span>Eu conferi fisicamente o sabor e local selecionados; este registro representa pacotes reais, sem dupla contagem.</span>
        </label>
        <Button disabled={!canConvert} onClick={()=>void convert()}><ShieldCheck className="mr-2 h-4 w-4"/>{saving?'Registrando...':'Registrar conversão física'}</Button>
      </div> : <p className="text-xs text-muted-foreground">Reclassificação física restrita ao perfil Administrador.</p>}
      <Button variant="outline" disabled={loading} onClick={()=>void refresh()}><RefreshCw className="mr-2 h-4 w-4"/>{loading?'Consultando...':'Atualizar saldos'}</Button>
    </CardContent>
  </Card>;
}
