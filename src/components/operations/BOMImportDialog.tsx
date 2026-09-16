import { useRef, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { analyzeBomImport, type BomImportAnalysis, type BomImportExisting, type BomImportProduct, type BomImportVariant } from '@/lib/bomImport';
import { parseBomImportXlsx } from '@/lib/bomImportXlsx';

const labels = { NOVO: 'Novo', ATUALIZAR: 'Atualizar', SEM_ALTERACAO: 'Sem alteração', ERRO: 'Erro' };

export function BOMImportDialog({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [analysis, setAnalysis] = useState<BomImportAnalysis | null>(null);
  const [fileName, setFileName] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const close = (next: boolean) => {
    if (!next) { setAnalysis(null); setFileName(''); setMessage(''); setShowConfirm(false); }
    setOpen(next);
  };
  const handleFile = async (file?: File) => {
    if (!file) return;
    setLoading(true); setAnalysis(null); setMessage('');
    try {
      const [rows, productsResult, variantsResult, componentsResult] = await Promise.all([
        parseBomImportXlsx(file),
        (supabase.from('products') as any).select('id, sku, name, unit, variation_mode, is_active'),
        supabase.from('product_variants').select('id, product_id, sku, variant_name, unit, is_active'),
        supabase.from('product_components').select('id, product_id, product_variant_id, component_id, variant_id, qty_per_unit, notes'),
      ]);
      if (productsResult.error || variantsResult.error || componentsResult.error) throw productsResult.error || variantsResult.error || componentsResult.error;
      setAnalysis(analyzeBomImport(rows, (productsResult.data || []) as BomImportProduct[], (variantsResult.data || []) as BomImportVariant[], (componentsResult.data || []) as BomImportExisting[]));
      setFileName(file.name);
    } catch (error: any) { setMessage(error?.message || 'Não foi possível ler o XLSX de BOM.'); }
    finally { setLoading(false); }
  };
  const confirm = async () => {
    if (!analysis || analysis.errors || !analysis.changes) return;
    setConfirming(true); setMessage('');
    try {
      for (const line of analysis.lines.filter(item => item.state === 'NOVO' || item.state === 'ATUALIZAR')) {
        if (!line.payload) continue;
        const result = line.state === 'NOVO'
          ? await supabase.from('product_components').insert(line.payload)
          : await supabase.from('product_components').update({ qty_per_unit: line.payload.qty_per_unit, notes: line.payload.notes }).eq('id', line.existingId!);
        if (result.error) throw result.error;
      }
      toast.success(`${analysis.changes} linha(s) de BOM confirmada(s).`);
      close(false); onImported?.();
    } catch (error: any) { setMessage(error?.message || 'Não foi possível confirmar a importação de BOM.'); }
    finally { setConfirming(false); }
  };
  return <><Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}><Upload className="mr-2 h-4 w-4" />Importar BOM</Button>
    <Dialog open={open} onOpenChange={close}><DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle>Importar composição (BOM)</DialogTitle><DialogDescription>Colunas obrigatórias: produto_sku, produto_variante_sku, componente_sku, componente_variante_sku, quantidade e observacao. A coluna opcional unidade é validada contra a identidade física; não há conversão automática. A prévia é obrigatória e não movimenta estoque.</DialogDescription></DialogHeader>
      <div className="flex items-center gap-3"><Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={loading || confirming}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}{loading ? 'Lendo...' : 'Selecionar XLSX'}</Button><Input ref={inputRef} className="hidden" type="file" accept=".xlsx" onChange={event => handleFile(event.target.files?.[0])} />{fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}</div>
      {message && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="mr-2 inline h-4 w-4" />{message}</div>}
      {analysis && <><div className="grid gap-2 sm:grid-cols-4"><Badge className="justify-center py-2">{analysis.changes} nova(s)/atualização(ões)</Badge><Badge variant="secondary" className="justify-center py-2">{analysis.unchanged} sem alteração</Badge><Badge variant={analysis.errors ? 'destructive' : 'outline'} className="justify-center py-2">{analysis.errors} erro(s)</Badge><Badge variant="outline" className="justify-center py-2">{analysis.lines.length} linha(s)</Badge></div><div className="max-h-[46vh] space-y-2 overflow-y-auto">{analysis.lines.map(line => <div key={line.rowNumber} className="rounded-md border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><Badge variant={line.state === 'ERRO' ? 'destructive' : line.state === 'NOVO' ? 'default' : 'secondary'}>{labels[line.state]}</Badge><span className="font-medium">Linha {line.rowNumber} · {line.finalLabel} → {line.componentLabel}</span></div><p className="mt-1 text-muted-foreground">{line.details}{line.quantity ? ` · quantidade: ${line.quantity}` : ''}</p></div>)}</div><div className="flex justify-end gap-2 border-t pt-3"><Button variant="outline" onClick={() => close(false)} disabled={confirming}>Cancelar</Button><Button onClick={() => setShowConfirm(true)} disabled={Boolean(analysis.errors || !analysis.changes || confirming)}>Confirmar importação</Button></div></>}
    </DialogContent></Dialog>
    <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar importação de BOM?</AlertDialogTitle><AlertDialogDescription>{analysis?.changes || 0} composição(ões) serão criadas ou atualizadas somente em product_components. Estoque, Produção, Pedidos, CRM e Financeiro não serão alterados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={confirming}>Voltar</AlertDialogCancel><AlertDialogAction onClick={event => { event.preventDefault(); void confirm(); }} disabled={confirming}>{confirming ? 'Confirmando...' : 'Confirmar'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
