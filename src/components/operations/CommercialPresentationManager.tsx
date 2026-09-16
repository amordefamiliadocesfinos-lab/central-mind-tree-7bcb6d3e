import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/hooks/useOrders';
import { useCommercialPresentations } from '@/hooks/useCommercialPresentations';
import { formatCommercialPresentation, type CommercialPresentation } from '@/lib/products/commercialPresentation';
import { getPhysicalIdentityUnit } from '@/lib/productVariants';

const EMPTY = { name: '', commercial_unit_label: '', conversion_factor: '', notes: '' };

export function CommercialPresentationManager({ product }: { product: Product }) {
  const { list, create, update } = useCommercialPresentations();
  const [variants, setVariants] = useState<{ id: string; variant_name: string; unit: string | null }[]>([]);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [items, setItems] = useState<CommercialPresentation[]>([]);
  const [draft, setDraft] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const requiresVariant = product.variation_mode === 'variacoes_fisicas';
  const identityResolved = !requiresVariant || Boolean(variantId);
  const variant = variants.find((item) => item.id === variantId);
  const physicalUnit = getPhysicalIdentityUnit(product, variant);

  const reset = () => { setDraft(EMPTY); setEditing(null); };
  const refresh = async () => {
    if (!identityResolved) return setItems([]);
    try { setItems(await list(product.id, variantId)); }
    catch { toast.error('Não foi possível carregar as apresentações comerciais.'); }
  };
  useEffect(() => {
    if (!requiresVariant) { setVariantId(null); setVariants([]); return; }
    void (async () => {
      const { data, error } = await (supabase as any).from('product_variants').select('id,variant_name,unit').eq('product_id', product.id).eq('is_active', true).order('variant_name');
      if (error) return toast.error('Não foi possível carregar as variantes físicas.');
      setVariants(data ?? []);
    })();
  }, [product.id, requiresVariant]);
  useEffect(() => { void refresh(); }, [product.id, variantId, identityResolved]);

  const valid = Boolean(draft.name.trim() && draft.commercial_unit_label.trim() && Number(draft.conversion_factor) > 0);
  const save = async () => {
    if (!identityResolved || !valid) return;
    setBusy(true);
    try {
      const payload = { product_id: product.id, variant_id: variantId, name: draft.name, commercial_unit_label: draft.commercial_unit_label, conversion_factor: Number(draft.conversion_factor), notes: draft.notes || null };
      if (editing) await update(editing, payload);
      else await create(payload);
      await refresh();
      reset();
      toast.success(editing ? 'Apresentação comercial atualizada.' : 'Apresentação comercial cadastrada.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a apresentação comercial.'); }
    finally { setBusy(false); }
  };
  const edit = (item: CommercialPresentation) => {
    setEditing(item.id);
    setDraft({ name: item.name, commercial_unit_label: item.commercial_unit_label, conversion_factor: String(item.conversion_factor), notes: item.notes ?? '' });
  };
  const toggle = async (item: CommercialPresentation) => {
    setBusy(true);
    try { await update(item.id, { is_active: !item.is_active }); await refresh(); }
    catch { toast.error('Não foi possível alterar o estado da apresentação comercial.'); }
    finally { setBusy(false); }
  };

  return <Card className="border-t">
    <CardHeader className="pb-3"><CardTitle className="text-base">Apresentações comerciais</CardTitle><p className="text-sm text-muted-foreground">Formas de vender a mesma identidade física. Não alteram estoque, pedidos ou produção nesta etapa.</p></CardHeader>
    <CardContent className="space-y-4">
      {requiresVariant && <div className="space-y-2"><Label>Variante física *</Label><Select value={variantId ?? ''} onValueChange={(value) => { setVariantId(value); reset(); }}><SelectTrigger><SelectValue placeholder="Selecione a variante" /></SelectTrigger><SelectContent>{variants.map((item) => <SelectItem key={item.id} value={item.id}>{item.variant_name}</SelectItem>)}</SelectContent></Select></div>}
      {!identityResolved ? <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">Selecione a variante física para gerenciar as apresentações deste Produto Mestre.</p> : <>
        <div className="rounded-md bg-muted/50 p-3 text-sm"><span className="text-muted-foreground">Unidade física de controle:</span> <strong>{physicalUnit}</strong><p className="mt-1 text-xs text-muted-foreground">Derivada do Produto/Variante; não é editável nesta tela.</p></div>
        <div className="space-y-2">{items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma apresentação comercial cadastrada. A venda direta futura será 1 {physicalUnit} = 1 {physicalUnit}.</p> : items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><p className="font-medium text-sm">{item.name}</p><p className="text-xs text-muted-foreground">{formatCommercialPresentation(item, product, variant)}</p>{item.notes && <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}</div><div className="flex items-center gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => edit(item)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button><Switch checked={item.is_active} disabled={busy} onCheckedChange={() => void toggle(item)} aria-label={`Ativar ${item.name}`} /></div></div>)}</div>
        <div className="space-y-3 rounded-md border border-dashed p-3"><p className="text-sm font-medium">{editing ? 'Editar apresentação comercial' : 'Nova apresentação comercial'}</p><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Nome da apresentação</Label><Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Caixa com 30" /></div><div className="space-y-2"><Label>Unidade comercial</Label><Input value={draft.commercial_unit_label} onChange={(event) => setDraft((current) => ({ ...current, commercial_unit_label: event.target.value }))} placeholder="Ex.: caixa" /></div><div className="space-y-2"><Label>Conversão</Label><Input type="number" min="0" step="any" value={draft.conversion_factor} onChange={(event) => setDraft((current) => ({ ...current, conversion_factor: event.target.value }))} /><p className="text-xs text-muted-foreground">1 {draft.commercial_unit_label || 'unidade comercial'} = {draft.conversion_factor || 'X'} {physicalUnit}</p></div><div className="space-y-2 sm:col-span-2"><Label>Observação</Label><Textarea value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></div></div><div className="flex gap-2"><Button type="button" disabled={!valid || busy} onClick={() => void save()}><Plus className="mr-1 h-4 w-4" />{editing ? 'Salvar alterações' : 'Cadastrar apresentação'}</Button>{editing && <Button type="button" variant="outline" disabled={busy} onClick={reset}>Cancelar</Button>}</div></div>
      </>}
    </CardContent>
  </Card>;
}
