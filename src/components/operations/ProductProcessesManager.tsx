import { useEffect, useMemo, useState } from 'react';
import { Save, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/hooks/useOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Process = { id: string; name: string; is_active: boolean };
type ProductProcess = { process_id: string; sort_order: number };

interface Props { products: Product[] }

export function ProductProcessesManager({ products }: Props) {
  const manufactured = useMemo(
    () => products.filter((p) => p.is_active && p.is_manufactured).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [products],
  );
  const [productId, setProductId] = useState('');
  const [processes, setProcesses] = useState<Process[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('processes').select('id,name,is_active').eq('is_active', true).order('name')
      .then(({ data }) => setProcesses((data || []) as Process[]));
  }, []);

  useEffect(() => {
    if (!productId) { setSelected([]); return; }
    let active = true;
    setLoading(true);
    supabase.from('product_processes')
      .select('process_id,sort_order')
      .eq('product_id', productId)
      .is('variant_id', null)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (!active) return;
        setLoading(false);
        if (error) {
          toast.error('Erro ao carregar processos do produto');
          return;
        }
        setSelected(((data || []) as ProductProcess[]).map((row) => row.process_id));
      });
    return () => { active = false; };
  }, [productId]);

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => checked ? [...current, id] : current.filter((item) => item !== id));
  };

  const save = async () => {
    if (!productId) return;
    setSaving(true);
    const { data, error } = await (supabase as any).rpc('set_product_processes', {
      p_product_id: productId,
      p_variant_id: null,
      p_process_ids: selected,
    });
    setSaving(false);
    if (error || !data?.success) {
      console.error(error || data);
      toast.error('Não foi possível salvar os processos do produto');
      return;
    }
    toast.success('Processos do produto atualizados');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <SlidersHorizontal className="h-5 w-5" /> Processos por produto
        </CardTitle>
        <p className="text-sm text-muted-foreground">Defina uma vez. No lançamento, o operador verá somente estes processos.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Produto fabricado</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="mt-1 h-12"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
            <SelectContent>{manufactured.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {productId && (
          <div className="space-y-2">
            {loading ? <p className="py-4 text-center text-sm text-muted-foreground">Carregando...</p> : processes.map((process) => {
              const checked = selected.includes(process.id);
              return (
                <label key={process.id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 hover:bg-muted/40">
                  <Checkbox checked={checked} onCheckedChange={(value) => toggle(process.id, value === true)} />
                  <span className="font-medium">{process.name}</span>
                </label>
              );
            })}
          </div>
        )}

        {productId && (
          <Button className="h-12 w-full" onClick={save} disabled={saving || loading}>
            <Save className="mr-2 h-4 w-4" />{saving ? 'Salvando...' : 'Salvar processos deste produto'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
