import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FinancialCategory } from '@/hooks/useFinancial';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { suggestCategory } from '@/lib/financial/categorySuggestion';

interface Props { open: boolean; onOpenChange: (open: boolean) => void; categories: FinancialCategory[]; onChanged?: () => void; }
interface ReviewEntry { id: string; description: string; value: number; due_date: string; type: 'pagar' | 'receber'; import_file_name?: string | null; import_source?: string | null; purchase_order_id?: string | null; order_id?: string | null; notes?: string | null; sales_channel?: string | null; marketplace_account?: string | null; }

export function UncategorizedReviewDialog({ open, onOpenChange, categories, onChanged }: Props) {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [total, setTotal] = useState(0);
  const [scope, setScope] = useState('all');
  const [saving, setSaving] = useState<string | null>(null);
  const load = async () => {
    setLoading(true); setFailed(false);
    const { data, error, count } = await supabase.from('financial_entries')
      .select('id,description,value,due_date,type,import_file_name,import_source,purchase_order_id,order_id,notes,sales_channel,marketplace_account', { count: 'exact' })
      .eq('lifecycle_status','active').is('category_id', null)
      .order('due_date', { ascending: false }).order('id').limit(300);
    if (error) { setFailed(true); setEntries([]); setTotal(0); toast.error('Erro ao carregar lançamentos sem categoria'); }
    else { setEntries((data as ReviewEntry[]) || []); setTotal(count ?? data?.length ?? 0); }
    setLoading(false);
  };
  useEffect(() => { if (open) load(); }, [open]);
  const categorize = async (entry: ReviewEntry, categoryId: string) => {
    if (saving || !categories.some(c => c.id === categoryId && c.is_active && (c.type === entry.type || c.type === 'ambos'))) return;
    setSaving(entry.id);
    try {
      const { data, error } = await supabase.from('financial_entries').update({ category_id: categoryId })
        .eq('id', entry.id).eq('lifecycle_status','active').is('category_id', null).select('id,category_id').maybeSingle();
      if (error) { toast.error('Erro ao salvar categoria'); return; }
      if (!data || data.category_id !== categoryId) { toast.error('Registro alterado ou indisponível. Atualize a revisão.'); await load(); return; }
      setEntries(current => current.filter(item => item.id !== entry.id));
      setTotal(current => Math.max(0,current-1));
      onChanged?.();
    } finally { setSaving(null); }
  };
  const visible = entries.filter(e => scope === 'all' || (scope === 'imported' ? Boolean(e.import_source) : Boolean(suggestCategory(e,categories))));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
    <DialogHeader><DialogTitle>Revisar lançamentos sem categoria</DialogTitle><DialogDescription>Sugestões por origem vinculada. Confira cada categoria antes de confirmar. Nenhuma classificação é gravada automaticamente.</DialogDescription></DialogHeader>
    <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{loading ? 'Carregando' : failed ? 'Consulta indisponível' : total + ' pendentes'}</Badge>
      <Select value={scope} onValueChange={setScope}><SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="suggested">Com sugestão</SelectItem><SelectItem value="imported">Importados</SelectItem></SelectContent></Select>
      <Button size="sm" variant="outline" disabled={loading || !!saving} onClick={load}>Atualizar</Button>
    </div>
    {total > entries.length && !loading && <p className="text-xs text-muted-foreground">Exibindo até 300 registros. Atualize após revisar para carregar os próximos.</p>}
    <div className="space-y-2">{!loading && !failed && visible.map(entry => {
      const suggestion = suggestCategory(entry,categories);
      return <div key={entry.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_auto_220px] sm:items-center">
        <div><p className="font-medium">{entry.description}</p><p className="text-xs text-muted-foreground">{entry.due_date} · {entry.type === 'pagar' ? 'A pagar' : 'A receber'}{entry.import_source ? ' · Importado' : ''}</p>{suggestion && <p className="text-xs text-muted-foreground">Sugestão: {suggestion.name} — {suggestion.reason}</p>}</div>
        <span className="font-medium">{formatCurrency(Number(entry.value))}</span>
        <div className="space-y-1">
          {suggestion && <Button variant="outline" size="sm" className="w-full" disabled={!!saving} onClick={() => categorize(entry,suggestion.id)}>Confirmar sugestão</Button>}
          <Select disabled={!!saving} onValueChange={value => categorize(entry,value)}><SelectTrigger><SelectValue placeholder="Escolher categoria" /></SelectTrigger><SelectContent>{categories.filter(category => category.is_active && (category.type === entry.type || category.type === 'ambos')).map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>;
    })}</div>
    {!loading && !failed && visible.length === 0 && <p className="py-8 text-center text-muted-foreground">{total === 0 ? 'Nenhum lançamento ativo sem categoria.' : 'Nenhum registro neste filtro entre os carregados.'}</p>}
    {failed && <p role="alert" className="text-sm text-destructive">Não foi possível consultar os lançamentos. Tente atualizar.</p>}
    <div className="flex justify-end"><Button variant="outline" disabled={!!saving} onClick={() => onOpenChange(false)}>Fechar</Button></div>
  </DialogContent></Dialog>;
}
