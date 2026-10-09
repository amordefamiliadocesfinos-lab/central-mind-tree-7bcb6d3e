import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Plus, RefreshCw, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useContacts } from '@/hooks/useContacts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const db = supabase as any;
const statuses = [
  ['prospectado', 'Prospectado'], ['em_contato', 'Em contato'],
  ['em_avaliacao', 'Em avaliação'], ['qualificado', 'Qualificado'],
  ['operacional', 'Operacional'], ['standby', 'Standby'], ['descartado', 'Descartado'],
] as const;
const documentTypes = [
  ['catalog', 'Catálogo'], ['price_list', 'Tabela de preços'],
  ['quote', 'Cotação'], ['technical_sheet', 'Ficha técnica'],
  ['commercial_policy', 'Política comercial'], ['image', 'Imagem'], ['other', 'Outro'],
] as const;
type Profile = {
  supplier_contact_id: string; lifecycle_status: string; source: string | null;
  next_action_at: string | null; next_action_text: string | null;
  general_min_order_amount: number | null; freight_terms: string | null;
  discard_reason: string | null; notes: string | null;
};
type CatalogItem = {
  id: string; supplier_contact_id: string; supplier_code: string | null;
  original_description: string; presentation_label: string | null;
  status: string; product_id: string | null;
};
type SupplierDocument = {
  id: string; file_name: string; document_type: string; storage_bucket: string;
  storage_path: string; created_at: string;
};
function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
function parseOptionalMoney(value: string): number | null {
  if (!value.trim()) return null;
  const numeric = Number(value.replace(',', '.'));
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error('Informe um valor mínimo válido.');
  return numeric;
}

/** Operational supplier extension: contacts remains the one canonical identity. */
export function SupplierCenter() {
  const { contacts, loading: loadingContacts } = useContacts();
  const suppliers = useMemo(
    () => contacts.filter(c => c.is_active && (c.type === 'fornecedor' || c.type === 'ambos'))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [contacts],
  );
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [status, setStatus] = useState('prospectado');
  const [source, setSource] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [freightTerms, setFreightTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [discardReason, setDiscardReason] = useState('');
  const [description, setDescription] = useState('');
  const [supplierCode, setSupplierCode] = useState('');
  const [presentation, setPresentation] = useState('');
  const [documentType, setDocumentType] = useState('catalog');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestToken = useRef(0);
  const selectedSupplier = useRef('');
  const selectSupplier = (id: string) => {
    selectedSupplier.current = id;
    requestToken.current += 1;
    setSupplierId(id);
    setProfile(null);
    setItems([]);
    setDocuments([]);
    setLoading(Boolean(id));
  };
  const filtered = useMemo(() => suppliers.filter(s =>
    (s.name + ' ' + (s.fantasy_name ?? '')).toLowerCase().includes(search.toLowerCase())
  ), [suppliers, search]);
  const selected = suppliers.find(s => s.id === supplierId);

  const load = useCallback(async (id: string) => {
    const token = ++requestToken.current;
    if (!id) { setProfile(null); setItems([]); setDocuments([]); setLoading(false); return; }
    setLoading(true);
    try {
      const [p, i, d] = await Promise.all([
        db.from('supplier_procurement_profiles').select('*').eq('supplier_contact_id', id).maybeSingle(),
        db.from('supplier_catalog_items').select('id,supplier_contact_id,supplier_code,original_description,presentation_label,status,product_id').eq('supplier_contact_id', id).order('created_at', { ascending: false }),
        db.from('supplier_documents').select('id,file_name,document_type,storage_bucket,storage_path,created_at').eq('supplier_contact_id', id).order('created_at', { ascending: false }),
      ]);
      if (p.error) throw p.error;
      if (i.error) throw i.error;
      if (d.error) throw d.error;
      if (token !== requestToken.current || id !== selectedSupplier.current) return;
      const value = (p.data ?? null) as Profile | null;
      setProfile(value);
      setItems(i.data ?? []);
      setDocuments(d.data ?? []);
      setStatus(value?.lifecycle_status ?? 'prospectado');
      setSource(value?.source ?? '');
      setNextAction(value?.next_action_text ?? '');
      setNextDate(value?.next_action_at?.slice(0, 16) ?? '');
      setMinOrder(value?.general_min_order_amount?.toString() ?? '');
      setFreightTerms(value?.freight_terms ?? '');
      setNotes(value?.notes ?? '');
      setDiscardReason(value?.discard_reason ?? '');
    } catch (error) {
      if (token === requestToken.current && id === selectedSupplier.current) {
        toast.error('Não foi possível carregar fornecedor: ' + errorText(error));
      }
    } finally {
      if (token === requestToken.current && id === selectedSupplier.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(supplierId); }, [supplierId, load]);

  const saveProfile = async () => {
    if (!supplierId || busy) return;
    setBusy(true);
    try {
      const value = {
        supplier_contact_id: supplierId, lifecycle_status: status,
        source: source.trim() || null,
        next_action_text: nextAction.trim() || null,
        next_action_at: nextDate ? new Date(nextDate).toISOString() : null,
        general_min_order_amount: parseOptionalMoney(minOrder),
        freight_terms: freightTerms.trim() || null,
        discard_reason: status === 'descartado' ? discardReason.trim() || null : null,
        notes: notes.trim() || null,
      };
      const { error } = await db.from('supplier_procurement_profiles')
        .upsert(value, { onConflict: 'supplier_contact_id' });
      if (error) throw error;
      toast.success('Perfil de suprimentos salvo.');
      await load(supplierId);
    } catch (error) { toast.error(errorText(error)); }
    finally { setBusy(false); }
  };

  const addItem = async () => {
    if (!supplierId || !description.trim() || busy) return;
    setBusy(true);
    try {
      const { error } = await db.from('supplier_catalog_items').insert({
        supplier_contact_id: supplierId, original_description: description.trim(),
        supplier_code: supplierCode.trim() || null,
        presentation_label: presentation.trim() || null,
      });
      if (error) throw error;
      setDescription(''); setSupplierCode(''); setPresentation('');
      toast.success('Oportunidade adicionada ao catálogo, sem criar Produto.');
      await load(supplierId);
    } catch (error) { toast.error(errorText(error)); }
    finally { setBusy(false); }
  };

  const uploadDocument = async () => {
    if (!supplierId || !file || busy) return;
    setBusy(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `suppliers/${supplierId}/${crypto.randomUUID()}-${safeName}`;
    try {
      const { error: uploadError } = await supabase.storage.from('order-documents')
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (uploadError) throw uploadError;
      const { error: dbError } = await db.from('supplier_documents').insert({
        supplier_contact_id: supplierId, document_type: documentType,
        file_name: file.name, storage_bucket: 'order-documents',
        storage_path: path, mime_type: file.type || null, file_size: file.size,
      });
      if (dbError) {
        await supabase.storage.from('order-documents').remove([path]);
        throw dbError;
      }
      setFile(null);
      toast.success('Documento armazenado no bucket privado e vinculado ao fornecedor.');
      await load(supplierId);
    } catch (error) { toast.error(errorText(error)); }
    finally { setBusy(false); }
  };

  const openDocument = async (document: SupplierDocument) => {
    const { data, error } = await supabase.storage.from(document.storage_bucket)
      .createSignedUrl(document.storage_path, 60);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? 'Documento indisponível.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Central de Fornecedores</h2>
          <p className="text-sm text-muted-foreground">Prospecção, catálogo e documentos. Contatos continuam sendo o cadastro oficial.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load(supplierId)} disabled={busy || loading}>
          <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
        </Button>
      </header>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardHeader><CardTitle className="text-base">Fornecedores ({suppliers.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input aria-label="Buscar fornecedores" placeholder="Buscar fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="max-h-80 overflow-auto space-y-1">
              {loadingContacts && <p className="text-sm text-muted-foreground">Carregando contatos...</p>}
              {!loadingContacts && filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhum fornecedor ativo no cadastro de Contatos.</p>}
              {filtered.map(s => (
                <Button key={s.id} variant={supplierId === s.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start h-auto text-left whitespace-normal"
                  onClick={() => selectSupplier(s.id)}>{s.name}</Button>
              ))}
            </div>
          </CardContent>
        </Card>
        {!selected ? (
          <Card><CardContent className="py-8 text-muted-foreground text-sm">Selecione um fornecedor existente. Para cadastrar outro, utilize o cadastro canônico de Contatos.</CardContent></Card>
        ) : (
          <div className="space-y-4 min-w-0">
            <Card>
              <CardHeader><CardTitle className="text-base">{selected.name} — Perfil de suprimentos</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {loading && <p className="text-sm text-muted-foreground">Carregando informações...</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1"><Label>Situação na prospecção</Label>
                    <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{statuses.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                    </Select></div>
                  <div className="space-y-1"><Label>Origem do fornecedor</Label><Input value={source} onChange={e => setSource(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Próxima ação</Label><Input value={nextAction} onChange={e => setNextAction(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Data/hora da próxima ação</Label><Input type="datetime-local" value={nextDate} onChange={e => setNextDate(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Pedido mínimo geral (R$)</Label><Input inputMode="decimal" value={minOrder} onChange={e => setMinOrder(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Frete e condições</Label><Input value={freightTerms} onChange={e => setFreightTerms(e.target.value)} /></div>
                </div>
                {status === 'descartado' && <div className="space-y-1"><Label>Motivo do descarte</Label><Input value={discardReason} onChange={e => setDiscardReason(e.target.value)} /></div>}
                <div className="space-y-1"><Label>Observações</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
                <div className="flex justify-end"><Button onClick={() => void saveProfile()} disabled={busy || loading}>{profile ? 'Salvar alterações' : 'Criar perfil'}</Button></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Catálogo e oportunidades ({items.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Registro pré-canônico: não cria Produto, Compra, estoque ou obrigação financeira.</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Input aria-label="Descrição original" placeholder="Descrição do fornecedor" value={description} onChange={e => setDescription(e.target.value)} />
                  <Input aria-label="Código fornecedor" placeholder="Código (opcional)" value={supplierCode} onChange={e => setSupplierCode(e.target.value)} />
                  <Input aria-label="Apresentação comercial" placeholder="Apresentação (opcional)" value={presentation} onChange={e => setPresentation(e.target.value)} />
                </div>
                <Button variant="outline" onClick={() => void addItem()} disabled={busy || !description.trim()}><Plus className="mr-2 h-4 w-4" /> Adicionar item</Button>
                <div className="space-y-2">{items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum item registrado.</p>}
                  {items.map(i => <div key={i.id} className="border rounded-md p-3 text-sm">
                    <div className="font-medium">{i.original_description}</div>
                    <div className="text-muted-foreground text-xs">{i.supplier_code || 'Sem código'} · {i.presentation_label || 'Apresentação não informada'} · {i.status === 'relacionado' ? 'Relacionado ao produto canônico' : 'Pendente de revisão'}</div>
                  </div>)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Documentos do fornecedor ({documents.length})</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Documentos anteriores a uma Compra. Arquivos privados no bucket existente.</p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div className="min-w-40 space-y-1"><Label>Tipo</Label><Select value={documentType} onValueChange={setDocumentType}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{documentTypes.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                  </Select></div>
                  <Input className="max-w-xs" aria-label="Selecionar documento" type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                  <Button variant="outline" onClick={() => void uploadDocument()} disabled={!file || busy}><Upload className="mr-2 h-4 w-4" /> Enviar</Button>
                </div>
                {documents.map(d => <div key={d.id} className="flex justify-between items-center gap-2 border rounded-md p-3 text-sm">
                  <div className="flex gap-2 items-center min-w-0"><FileText className="h-4 w-4 shrink-0" /><span className="truncate">{d.file_name}</span></div>
                  <Button size="sm" variant="ghost" onClick={() => void openDocument(d)}>Abrir</Button>
                </div>)}
                {documents.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento registrado.</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
