import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { Product } from '@/hooks/useOrders';
import { usePurchases, type CreatePurchasePresentationInput } from '@/hooks/usePurchases';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getPhysicalIdentityUnit } from '@/lib/productVariants';

type Presentation = CreatePurchasePresentationInput & { id: string; is_active: boolean };
const EMPTY = { name: '', purchase_unit_label: '', stock_unit_label: '', conversion_factor: '', is_approximate: false, notes: '' };

export function PurchasePresentationManager({ products }: { products: Product[] }) {
  const { createPresentation, updatePresentation, getPresentations } = usePurchases();
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState<string | null>(null);
  const [variants, setVariants] = useState<{ id: string; variant_name: string; unit: string | null }[]>([]);
  const [items, setItems] = useState<Presentation[]>([]);
  const [draft, setDraft] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const product = useMemo(() => products.find(item => item.id === productId), [products, productId]);
  const requiresVariant = product?.variation_mode === 'variacoes_fisicas';
  const identityResolved = Boolean(product) && (!requiresVariant || Boolean(variantId));
  const selectedVariant = variants.find(item => item.id === variantId);
  const canonicalUnit = getPhysicalIdentityUnit(product, selectedVariant);

  const refresh = async () => {
    if (!identityResolved) return setItems([]);
    setItems(await getPresentations(productId, variantId, true) as Presentation[]);
  };
  useEffect(() => { void refresh(); }, [productId, variantId, identityResolved]);

  const chooseProduct = async (id: string) => {
    setProductId(id); setVariantId(null); setItems([]); setDraft(EMPTY); setEditing(null);
    const selected = products.find(item => item.id === id);
    if (selected?.variation_mode !== 'variacoes_fisicas') return setVariants([]);
    const { data, error } = await (supabase as any).from('product_variants').select('id,variant_name,unit').eq('product_id', id).eq('is_active', true).order('variant_name');
    if (error) return toast.error('Não foi possível carregar as variantes.');
    setVariants(data ?? []);
  };
  const resetDraft = () => { setDraft(EMPTY); setEditing(null); };
  const valid = Boolean(draft.name.trim() && draft.purchase_unit_label.trim() && Number(draft.conversion_factor) > 0);
  const save = async () => {
    if (!identityResolved || !valid) return;
    setBusy(true);
    const input = { product_id: productId, variant_id: variantId, name: draft.name, purchase_unit_label: draft.purchase_unit_label, stock_unit_label: canonicalUnit, conversion_factor: Number(draft.conversion_factor), is_approximate: draft.is_approximate, notes: draft.notes || null };
    try {
      if (editing) await updatePresentation(editing, input);
      else await createPresentation(input);
      await refresh(); resetDraft(); toast.success(editing ? 'Apresentação atualizada.' : 'Apresentação cadastrada.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a apresentação.'); }
    finally { setBusy(false); }
  };
  const edit = (item: Presentation) => { setEditing(item.id); setDraft({ name: item.name, purchase_unit_label: item.purchase_unit_label, stock_unit_label: canonicalUnit, conversion_factor: String(item.conversion_factor), is_approximate: item.is_approximate ?? false, notes: item.notes ?? '' }); };
  const toggle = async (item: Presentation) => {
    setBusy(true);
    try { await updatePresentation(item.id, { is_active: !item.is_active }); await refresh(); }
    catch { toast.error('Não foi possível alterar o status da apresentação.'); }
    finally { setBusy(false); }
  };

  return <Card>
    <CardHeader className="pb-3"><CardTitle className="text-base">Apresentações de compra</CardTitle><p className="text-sm text-muted-foreground">Referências reutilizáveis da identidade física. Não alteram o estoque nem compras já registradas.</p></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2"><Label>Produto</Label><Select value={productId} onValueChange={value => void chooseProduct(value)}><SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger><SelectContent>{products.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        {requiresVariant && <div className="space-y-2"><Label>Variante física</Label><Select value={variantId ?? ''} onValueChange={value => { setVariantId(value); resetDraft(); }}><SelectTrigger><SelectValue placeholder="Selecione a variante" /></SelectTrigger><SelectContent>{variants.map(item => <SelectItem key={item.id} value={item.id}>{item.variant_name}</SelectItem>)}</SelectContent></Select></div>}
      </div>
      {identityResolved && <>
        <div className="space-y-2">
          {items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma apresentação cadastrada para esta identidade.</p> : items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><div><p className="font-medium text-sm">{item.name} {item.is_approximate ? '≈' : ''}</p><p className="text-xs text-muted-foreground">1 {item.purchase_unit_label} = {item.conversion_factor} {item.stock_unit_label}</p></div><div className="flex items-center gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => edit(item)}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button><Switch checked={item.is_active} disabled={busy} onCheckedChange={() => void toggle(item)} aria-label={`Ativar ${item.name}`} /></div></div>)}
        </div>
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <p className="text-sm font-medium">{editing ? 'Editar apresentação' : 'Nova apresentação'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Nome</Label><Input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="Ex.: Caixa 8 kg" /></div>
            <div className="space-y-2"><Label>Unidade de compra</Label><Input value={draft.purchase_unit_label} onChange={event => setDraft(current => ({ ...current, purchase_unit_label: event.target.value }))} placeholder="Ex.: caixa" /></div>
            <div className="space-y-2"><Label>Unidade física de controle</Label><Input value={canonicalUnit} readOnly className="bg-muted" /><p className="text-xs text-muted-foreground">Definida pelo Produto/Variante e usada por Estoque, BOM, Produção e MRP.</p></div>
            <div className="space-y-2"><Label>Conversão de referência</Label><Input type="number" min="0" step="any" value={draft.conversion_factor} onChange={event => setDraft(current => ({ ...current, conversion_factor: event.target.value }))} /></div>
            <div className="flex items-center justify-between rounded-md border p-3"><Label>Conversão aproximada</Label><Switch checked={draft.is_approximate} onCheckedChange={checked => setDraft(current => ({ ...current, is_approximate: checked }))} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Observação</Label><Textarea value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Ex.: Rendimento médio. Pode variar por lote." /></div>
          </div>
          <div className="flex gap-2"><Button type="button" disabled={!valid || busy} onClick={() => void save()}><Plus className="mr-1 h-4 w-4" />{editing ? 'Salvar alterações' : 'Cadastrar apresentação'}</Button>{editing && <Button type="button" variant="outline" disabled={busy} onClick={resetDraft}>Cancelar</Button>}</div>
        </div>
      </>}
    </CardContent>
  </Card>;
}
