import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Link2, Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { buildShopeeImportItems, buildShopeePreview, parseShopeeShippingXlsx, type ShopeeMappingComponent, type ShopeePreviewItem, type ShopeeProductMapping, type ShopeeShippingOrder } from '@/lib/shopeeShippingXlsx';

type ProductOption = { id: string; name: string; sku: string };
type ProductVariantOption = { id: string; product_id: string; sku: string; variant_name: string; is_active: boolean };
type DraftRow = { productId: string; variantId: string; multiplier: string };
type DraftMapping = { rows: DraftRow[] };
type ImportFailure = { orderNumber: string; reason: string };
type ImportSummary = { processed: number; created: number; alreadyImported: number; movementCount: number; failures: ImportFailure[] };
type ChannelAccount = { id: string; name: string };

interface Props { open: boolean; onOpenChange: (open: boolean) => void; products: ProductOption[]; onImported?: () => void; }

const validMultiplier = (value: string) => { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; };
const emptyRow = (): DraftRow => ({ productId: '', variantId: '', multiplier: '1' });

export function ShopeeOrdersImportDialog({ open, onOpenChange, products, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [variants, setVariants] = useState<ProductVariantOption[]>([]);
  const [accountId, setAccountId] = useState('');
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [orders, setOrders] = useState<ShopeeShippingOrder[]>([]);
  const [mappings, setMappings] = useState<ShopeeProductMapping[]>([]);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, DraftMapping>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState('');
  const selectedAccount = accounts.find(account => account.id === accountId) || null;

  const preview = useMemo(() => buildShopeePreview(orders, mappings, existingIds), [orders, mappings, existingIds]);
  const items = preview.flatMap(order => order.items.map(item => ({ order, item })));
  const recognized = items.filter(({ item }) => item.mappingStatus === 'recognized').length;
  const pending = items.length - recognized;
  const duplicates = preview.filter(order => order.duplicateStatus === 'already_imported').length;
  const newOrders = preview.filter(order => order.duplicateStatus === 'new');
  const ready = Boolean(selectedAccount && preview.length && pending === 0);

  const variantsOf = (productId: string) => variants.filter(variant => variant.product_id === productId);

  useEffect(() => {
    if (!open) return;
    const loadAccounts = async () => {
      setAccountsLoading(true);
      setError('');
      try {
        const { data: platforms, error: platformsError } = await supabase
          .from('digital_platforms')
          .select('id')
          .eq('group_type', 'marketplace')
          .eq('is_active', true)
          .is('parent_id', null)
          .ilike('name', 'shopee%')
          .limit(2);
        if (platformsError) throw platformsError;
        if ((platforms || []).length !== 1) throw new Error('Plataforma Shopee canônica não disponível para seleção.');

        const { data, error: accountsError } = await (supabase as any)
          .from('channel_accounts')
          .select('id,name')
          .eq('platform_id', platforms![0].id)
          .eq('is_active', true)
          .order('name');
        if (accountsError) throw accountsError;
        setAccounts((data || []) as ChannelAccount[]);
        const { data: variantRows, error: variantsError } = await (supabase as any)
          .from('product_variants').select('id,product_id,sku,variant_name,is_active').eq('is_active', true).order('variant_name');
        if (variantsError) throw variantsError;
        setVariants((variantRows || []) as ProductVariantOption[]);
      } catch (reason: any) {
        setAccounts([]);
        setError(reason?.message || 'Não foi possível carregar as contas Shopee canônicas.');
      } finally {
        setAccountsLoading(false);
      }
    };
    loadAccounts();
  }, [open]);

  const loadPreviewContext = async (parsed: ShopeeShippingOrder[], selected: ChannelAccount) => {
    const keys = [...new Set(parsed.flatMap(order => order.items.map(item => item.externalItemKey)))];
    const ids = parsed.map(order => order.externalOrderId);
    const columns = 'id,external_item_key,product_id,variant_id,physical_multiplier';
    const [canonicalMaps, legacyMaps, existing] = await Promise.all([
      (supabase as any).from('marketplace_product_mappings').select(columns).eq('marketplace', 'shopee').eq('channel_account_id', selected.id).in('external_item_key', keys),
      (supabase as any).from('marketplace_product_mappings').select(columns).eq('marketplace', 'shopee').is('channel_account_id', null).eq('marketplace_account', selected.name).in('external_item_key', keys),
      supabase.from('orders').select('order_number,channel,marketplace_account').in('order_number', ids).is('deleted_at', null),
    ]);
    if (canonicalMaps.error) throw canonicalMaps.error;
    if (legacyMaps.error) throw legacyMaps.error;
    if (existing.error) throw existing.error;
    const byExternalKey = new Map<string, ShopeeProductMapping & { id?: string }>();
    (legacyMaps.data || []).forEach((mapping: any) => byExternalKey.set(mapping.external_item_key, mapping));
    (canonicalMaps.data || []).forEach((mapping: any) => byExternalKey.set(mapping.external_item_key, mapping));

    const mappingIds = [...byExternalKey.values()].map(mapping => mapping.id).filter(Boolean) as string[];
    if (mappingIds.length) {
      const { data: componentRows, error: componentsError } = await (supabase as any)
        .from('marketplace_product_mapping_items')
        .select('mapping_id,product_id,variant_id,physical_multiplier,position')
        .in('mapping_id', mappingIds)
        .order('position');
      if (componentsError) throw componentsError;
      const byMapping = new Map<string, ShopeeMappingComponent[]>();
      (componentRows || []).forEach((row: any) => {
        const list = byMapping.get(row.mapping_id) || [];
        list.push({ product_id: row.product_id, variant_id: row.variant_id, physical_multiplier: Number(row.physical_multiplier), position: row.position });
        byMapping.set(row.mapping_id, list);
      });
      byExternalKey.forEach((mapping, key) => {
        if (mapping.id && byMapping.has(mapping.id)) byExternalKey.set(key, { ...mapping, components: byMapping.get(mapping.id)! });
      });
    }
    setMappings([...byExternalKey.values()]);
    const normalizedAccount = selected.name.trim().toLocaleLowerCase();
    setExistingIds(new Set((existing.data || []).filter((order: any) => order.channel === 'shopee' && String(order.marketplace_account || '').trim().toLocaleLowerCase() === normalizedAccount).map((order: any) => order.order_number)));
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!selectedAccount) { setError('Selecione uma conta Shopee cadastrada na fonte canônica antes de ler o arquivo.'); return; }
    setLoading(true); setError(''); setSummary(null); setEditingKey(null);
    try { const parsed = await parseShopeeShippingXlsx(file, selectedAccount.name); await loadPreviewContext(parsed, selectedAccount); setOrders(parsed); setFileName(file.name); setDrafts({}); }
    catch (reason: any) { setOrders([]); setFileName(''); setError(reason?.message || 'Não foi possível ler o arquivo Shopee.'); }
    finally { setLoading(false); }
  };

  const rowsFromItem = (item: ShopeePreviewItem): DraftRow[] => (item.components.length
    ? item.components.map(component => ({ productId: component.productId, variantId: component.variantId || '', multiplier: String(component.physicalMultiplier) }))
    : [emptyRow()]);

  const draftFor = (item: ShopeePreviewItem): DraftMapping => drafts[item.externalItemKey] || { rows: rowsFromItem(item) };
  const setDraftRows = (key: string, fallback: DraftMapping, updater: (rows: DraftRow[]) => DraftRow[]) =>
    setDrafts(current => ({ ...current, [key]: { rows: updater((current[key] || fallback).rows) } }));
  const clearDraft = (key: string) => setDrafts(current => { const next = { ...current }; delete next[key]; return next; });

  /** Valida a composição comercial completa antes de aplicar ou salvar. */
  const validateRows = (rows: DraftRow[]): { components: ShopeeMappingComponent[] } | { error: string } => {
    const valid = rows.filter(row => row.productId);
    if (!valid.length) return { error: 'Informe ao menos um produto na composição comercial.' };
    const components: ShopeeMappingComponent[] = [];
    for (const row of valid) {
      const multiplier = validMultiplier(row.multiplier);
      if (!multiplier) return { error: 'Cada linha da composição precisa de uma quantidade maior que zero.' };
      const available = variantsOf(row.productId);
      if (available.length > 0 && !row.variantId) return { error: 'Produto com variações físicas exige a escolha de uma variante.' };
      if (row.variantId && !available.some(variant => variant.id === row.variantId)) return { error: 'A variante escolhida não pertence ao produto selecionado.' };
      components.push({ product_id: row.productId, variant_id: row.variantId || null, physical_multiplier: multiplier, position: components.length });
    }
    return { components };
  };

  const applyMapping = (key: string, persist: boolean) => {
    const source = items.find(({ item }) => item.externalItemKey === key)?.item;
    if (!source) return;
    const draft = drafts[key] || { rows: rowsFromItem(source) };
    const validation = validateRows(draft.rows);
    if ('error' in validation) { setError(validation.error); return; }
    const { components } = validation;
    const first = components[0];
    const nextMapping: ShopeeProductMapping = { external_item_key: key, product_id: first.product_id, variant_id: first.variant_id ?? null, physical_multiplier: first.physical_multiplier, components };
    const applyLocally = (mapping: ShopeeProductMapping) => { setMappings(current => [...current.filter(entry => entry.external_item_key !== key), mapping]); clearDraft(key); setEditingKey(null); setError(''); };
    if (!persist) { applyLocally(nextMapping); return; }
    setSavingKey(key); setError('');
    (async () => {
      try {
        if (!selectedAccount) throw new Error('Conta Shopee canônica não selecionada.');
        const { data, error: saveError } = await (supabase as any).from('marketplace_product_mappings').upsert({
          marketplace: 'shopee', marketplace_account: selectedAccount.name, channel_account_id: selectedAccount.id,
          external_item_key: key, external_product_title: source.productTitle || null, external_variation: source.variation || null,
          product_id: first.product_id, variant_id: first.variant_id ?? null, physical_multiplier: first.physical_multiplier,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'marketplace,marketplace_account,external_item_key' }).select('id,external_item_key,product_id,variant_id,physical_multiplier').single();
        if (saveError) throw saveError;
        const mappingId = (data as any).id as string;
        const { error: deleteError } = await (supabase as any).from('marketplace_product_mapping_items').delete().eq('mapping_id', mappingId);
        if (deleteError) throw deleteError;
        const { error: insertError } = await (supabase as any).from('marketplace_product_mapping_items').insert(components.map((component, index) => ({
          mapping_id: mappingId, product_id: component.product_id, variant_id: component.variant_id, physical_multiplier: component.physical_multiplier, position: index,
        })));
        if (insertError) throw insertError;
        applyLocally({ ...(data as any), components });
      } catch (reason: any) { setError(reason?.message || 'Não foi possível salvar o mapeamento.'); }
      finally { setSavingKey(null); }
    })();
  };

  const confirmImport = async () => {
    if (!ready) return;
    setConfirming(true); setError(''); setSummary(null);
    const result: ImportSummary = { processed: newOrders.length, created: 0, alreadyImported: duplicates, movementCount: 0, failures: [] };
    for (const order of newOrders) {
      try {
        if (!selectedAccount) throw new Error('Conta Shopee canônica não selecionada.');
        const { data, error: importError } = await (supabase.rpc as any)('import_shopee_order_with_stock', { p_order: { external_order_id: order.externalOrderId, channel_account_id: selectedAccount.id, marketplace_account: selectedAccount.name, external_status: order.externalStatus, tracking_number: order.trackingNumber, order_date: order.createdAt, paid_at: order.paidAt, shipping_at: order.shippingAt, customer_name: order.customerName, buyer_username: order.buyerUsername, customer_contact: order.customerContact, document: order.document, address: order.address, address_number: order.addressNumber, address_complement: order.addressComplement, neighborhood: order.neighborhood, city: order.city, state: order.state, zip_code: order.zipCode, commercial_total: order.commercialTotal, seller_discount: order.sellerDiscount, shipping_fee: order.shippingFee }, p_items: buildShopeeImportItems(order) });
        if (importError) throw importError;
        if (data?.already_imported) result.alreadyImported += 1; else { result.created += 1; result.movementCount += Number(data?.movement_count || 0); }
      } catch (reason: any) { result.failures.push({ orderNumber: order.externalOrderId, reason: reason?.message || 'Erro inesperado ao importar.' }); }
    }
    setSummary(result); setShowConfirm(false); setConfirming(false); if (selectedAccount) await loadPreviewContext(orders, selectedAccount); onImported?.();
  };

  const close = (next: boolean) => { if (!next) { setOrders([]); setFileName(''); setError(''); setSummary(null); setEditingKey(null); } onOpenChange(next); };

  const renderEditor = (item: ShopeePreviewItem) => {
    const key = item.externalItemKey;
    const draft = draftFor(item);
    return <div className="space-y-2 md:col-span-3">
      {draft.rows.map((row, index) => {
        const rowVariants = variantsOf(row.productId);
        const multiplier = validMultiplier(row.multiplier);
        return <div key={index} className="grid gap-2 md:grid-cols-[minmax(160px,1.4fr)_minmax(150px,1fr)_110px_auto]">
          <Select value={row.productId} onValueChange={value => setDraftRows(key, draft, rows => rows.map((entry, i) => i === index ? { ...entry, productId: value, variantId: '' } : entry))}>
            <SelectTrigger><SelectValue placeholder="Produto Mestre" /></SelectTrigger>
            <SelectContent>{products.map(option => <SelectItem key={option.id} value={option.id}>{option.name}{option.sku ? ` · ${option.sku}` : ''}</SelectItem>)}</SelectContent>
          </Select>
          {rowVariants.length > 0
            ? <Select value={row.variantId} onValueChange={value => setDraftRows(key, draft, rows => rows.map((entry, i) => i === index ? { ...entry, variantId: value } : entry))}>
                <SelectTrigger><SelectValue placeholder="Variante física" /></SelectTrigger>
                <SelectContent>{rowVariants.map(variant => <SelectItem key={variant.id} value={variant.id}>{variant.variant_name} · {variant.sku}</SelectItem>)}</SelectContent>
              </Select>
            : <div className="flex items-center text-xs text-muted-foreground">{row.productId ? 'Produto simples (sem variante)' : 'Escolha o produto'}</div>}
          <div>
            <Input type="number" min="0.0001" step="any" value={row.multiplier} onChange={event => setDraftRows(key, draft, rows => rows.map((entry, i) => i === index ? { ...entry, multiplier: event.target.value } : entry))} />
            <div className="mt-1 text-xs text-muted-foreground">{multiplier ? `${item.quantity} × ${multiplier} = ${item.quantity * multiplier} físicas` : 'Qtd por 1 unidade Shopee'}</div>
          </div>
          <Button type="button" size="icon" variant="ghost" disabled={draft.rows.length === 1} onClick={() => setDraftRows(key, draft, rows => rows.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
        </div>;
      })}
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => setDraftRows(key, draft, rows => [...rows, emptyRow()])}><Plus className="mr-1 h-4 w-4" />Adicionar produto</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { setEditingKey(null); clearDraft(key); }}>Cancelar</Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => applyMapping(key, false)}>Só nesta importação</Button>
        <Button type="button" size="sm" onClick={() => applyMapping(key, true)} disabled={savingKey === key}>{savingKey === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Link2 className="mr-1 h-4 w-4" />Salvar padrão</>}</Button>
      </div>
    </div>;
  };

  return <><Dialog open={open} onOpenChange={close}><DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Importar pedidos Shopee</DialogTitle><DialogDescription>Revise os itens antes de confirmar. A baixa física será feita pelo contrato oficial Pedido → Estoque.</DialogDescription></DialogHeader>
    <div className="grid gap-3 md:grid-cols-[1fr_auto]"><div><Label>Conta Shopee</Label><Select value={accountId} onValueChange={value => { setAccountId(value); setOrders([]); setFileName(''); setMappings([]); setExistingIds(new Set()); setSummary(null); setError(''); }} disabled={Boolean(orders.length) || accountsLoading}><SelectTrigger><SelectValue placeholder={accountsLoading ? 'Carregando contas...' : 'Selecione uma conta Shopee'} /></SelectTrigger><SelectContent>{accounts.map(option => <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>)}</SelectContent></Select>{!accountsLoading && accounts.length === 0 && <p className="mt-1 text-xs text-destructive">Conta Shopee não cadastrada na fonte canônica.</p>}</div><div className="flex items-end"><Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={loading || confirming || !selectedAccount}><Upload className="mr-2 h-4 w-4" />{loading ? 'Lendo...' : 'Selecionar XLSX'}</Button><Input ref={inputRef} className="hidden" type="file" accept=".xlsx" onChange={event => handleFile(event.target.files?.[0])} /></div></div>
    {fileName && <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileSpreadsheet className="h-4 w-4" />{fileName}</div>}
    {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mr-2 inline h-4 w-4" />{error}</div>}
    {preview.length > 0 && <><div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5"><Badge variant="secondary" className="justify-center py-2">{preview.length} pedidos</Badge><Badge variant="secondary" className="justify-center py-2">{items.length} itens</Badge><Badge className="justify-center py-2 bg-emerald-600">{recognized} reconhecidos</Badge><Badge variant="outline" className="justify-center py-2">{pending} para associar</Badge><Badge variant="outline" className="justify-center py-2">{duplicates} já importados</Badge></div>
      <div className="space-y-3">{preview.map(order => <div key={order.externalOrderId} className="rounded-lg border p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2"><strong>Pedido {order.externalOrderId}</strong><Badge variant={order.duplicateStatus === 'already_imported' ? 'secondary' : 'outline'}>{order.duplicateStatus === 'already_imported' ? 'Já importado' : 'Novo'}</Badge><span className="text-xs text-muted-foreground">{order.customerName || 'Comprador não identificado'} · Shopee · {order.account}{order.trackingNumber ? ` · Rastreio ${order.trackingNumber}` : ''}</span>{order.commercialTotal > 0 && <span className="text-sm font-medium">R$ {order.commercialTotal.toFixed(2)}</span>}</div>
        {order.items.map(item => {
          const isEditing = editingKey === item.externalItemKey || item.mappingStatus !== 'recognized';
          return <div key={`${order.externalOrderId}-${item.rowNumber}`} className="grid gap-2 border-t py-3 md:grid-cols-[minmax(180px,1.5fr)_110px_minmax(320px,2fr)]">
            <div><div className="font-medium text-sm">{item.productTitle}</div><div className="text-xs text-muted-foreground">{item.variation || 'Sem variação'} · chave {item.externalItemKey}</div></div>
            <div className="text-sm">Qtd Shopee: <b>{item.quantity}</b></div>
            {isEditing ? renderEditor(item) : <div className="space-y-1">
              <div className="text-sm"><CheckCircle2 className="mr-1 inline h-4 w-4 text-emerald-600" />Composição comercial ({item.components.length} {item.components.length === 1 ? 'produto' : 'produtos'})</div>
              <ul className="text-xs text-muted-foreground">{item.components.map((component, index) => {
                const product = products.find(option => option.id === component.productId);
                const variant = variants.find(option => option.id === component.variantId);
                return <li key={index}>{product?.name || 'Produto mapeado'}{variant ? ` · ${variant.variant_name}` : ''} — {item.quantity} × {component.physicalMultiplier} = <b>{component.physicalQuantity}</b> físicas</li>;
              })}</ul>
              <Button type="button" size="sm" variant="outline" onClick={() => { setEditingKey(item.externalItemKey); setDrafts(current => ({ ...current, [item.externalItemKey]: { rows: rowsFromItem(item) } })); }}><Pencil className="mr-1 h-4 w-4" />Editar composição</Button>
            </div>}
          </div>;
        })}
      </div>)}</div>
      <div className="rounded-md border bg-muted/40 p-3 text-sm"><strong>{ready ? 'Pronto para confirmar a importação' : 'Prévia ainda não está pronta'}</strong><div className="text-muted-foreground">{ready ? 'A confirmação criará pedidos enviados e aplicará a saída física idempotente pelo contrato Pedido → Estoque.' : 'Associe todos os itens pendentes e confira a conta Shopee.'}</div></div>
      {summary && <div className="rounded-md border p-3 text-sm"><strong>Importação concluída</strong><div>{summary.processed} pedidos processados · {summary.created} criados · {summary.alreadyImported} já importados · {summary.movementCount} movimentações de estoque</div>{summary.failures.length > 0 && <ul className="mt-2 list-disc pl-5 text-destructive">{summary.failures.map(failure => <li key={failure.orderNumber}>{failure.orderNumber}: {failure.reason}</li>)}</ul>}</div>}
      <div className="flex justify-end gap-2 border-t pt-3"><Button variant="outline" onClick={() => close(false)} disabled={confirming}>Cancelar</Button><Button onClick={() => setShowConfirm(true)} disabled={!ready || confirming}>{confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar importação</Button></div></>}
  </DialogContent></Dialog>
  <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar importação de {newOrders.length} pedidos Shopee?</AlertDialogTitle><AlertDialogDescription>{items.length} itens serão registrados em Operações. Os pedidos enviados provocarão saída física pelo contrato oficial, com proteção contra duplicidade.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={confirming}>Voltar</AlertDialogCancel><AlertDialogAction onClick={event => { event.preventDefault(); confirmImport(); }} disabled={confirming}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
