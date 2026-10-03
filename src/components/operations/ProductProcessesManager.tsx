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
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: authData }, processRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('processes').select('id,name,is_active').eq('is_active', true).order('name'),
      ]);
      setProcesses((processRes.data || []) as Process[]);
      if (!authData.user?.id) return;
      const { data } = await supabase.from('app_users').select('role')
        .eq('auth_user_id', authData.user.id).eq('is_active', true).maybeSingle();
      const role = String(data?.role || '').toUpperCase();
      setCanManage(role === 'ADMINISTRADOR' || role === 'LIDER PRODUÇÃO');
    })();
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
        if (error) { toast.error('Erro ao carregar processos do produto'); return; }
        setSelected(((data || []) as ProductProcess[]).map((row) => row.process_id));
      });
    return () => { active = false; };
  }, [productId]);

  const toggle = (id: string, checked: boolean) => {
    if (!canManage) return;
    setSelected((current) => checked ? [...current, id] : current.filter((item) => item !== id));
  };

  const save = async () => {
    if (!productId || !canManage) return;
    setSaving(true);
    const { data, error } = await (supabase as any).rpc('set_product_processes', {
      p_product_id: productId,
      p_variant_id: null,
      p_process_ids: selected,
    });
    setSaving(false);
    if (error || !data?.success) {
      console.error(error || data);
      toast.error(data?.reason === 'forbidden' ? 'Sem permissão para alterar esta configuração' : 'Não foi possível salvar os processos do produto');
      return;
    }
    toast.success('Processos do produto atualizados');
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg"><SlidersHorizontal className="h-5 w-5" /> Processos por produto</CardTitle>
        <p className="text-sm text-muted-foreground">Defina uma vez. No lançamento, aparecem somente os processos deste produto.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Produto fabricado</Label>
          <Select value={productId} onValueChange={setProductId}>
            <SelectTrigger className="mt-1 h-12"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
            <SelectContent>{manufactured.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {productId && <div className="space-y-2">
          {loading ? <p className="py-4 text-center text-sm text-muted-foreground">Carregando...</p> : processes.map((process) => {
            const checked = selected.includes(process.id);
            return <label key={process.id} className="flex min-h-12 items-center gap-3 rounded-xl border p-3">
              <Checkbox checked={checked} disabled={!canManage} onCheckedChange={(value) => toggle(process.id, value === true)} />
              <span className="font-medium">{process.name}</span>
            </label>;
          })}
        </div>}

        {productId && canManage && <Button className="h-12 w-full" onClick={save} disabled={saving || loading}>
          <Save className="mr-2 h-4 w-4" />{saving ? 'Salvando...' : 'Salvar processos deste produto'}
        </Button>}
        {productId && !canManage && <p className="text-xs text-muted-foreground">Somente Administrador ou Líder de Produção pode alterar os vínculos. Operadores apenas usam a configuração no lançamento.</p>}
      </CardContent>
    </Card>
  );
}
