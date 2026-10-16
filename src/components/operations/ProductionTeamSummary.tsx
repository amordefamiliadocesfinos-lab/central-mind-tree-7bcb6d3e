import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Factory, RefreshCw, Users, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const db = supabase as any;
type Entry = {
  id: string; production_fact_id: string; operator_name: string; operator_user_id: string | null;
  total_value: number | string;
  production_fact: {
    id: string; status: string; quantity: number | string; occurred_at: string;
    product: { id: string; name: string; cover_image_url: string | null } | null;
    variant: { variant_name: string } | null;
  } | null;
};
type Fact = { id: string; productId: string; name: string; variant: string; image: string | null; quantity: number; date: string; workers: Map<string, number> };
type ProductGroup = { id: string; name: string; image: string | null; quantity: number; facts: Fact[] };
const currency = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const localDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const formatDate = (date: string) => date.split('-').reverse().join('/');
const endOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
function presetDates(year: number, month: number, half: 1 | 2) {
  const base = `${year}-${String(month).padStart(2, '0')}-`;
  return { from: base + (half === 1 ? '01' : '16'), to: base + String(half === 1 ? 15 : endOfMonth(year, month)).padStart(2, '0') };
}

export function ProductionTeamSummary({ onProduce, onSignOut }: { onProduce: () => void; onSignOut: () => void }) {
  const today = localDate(new Date());
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [half, setHalf] = useState<1 | 2>(Number(today.slice(8, 10)) <= 15 ? 1 : 2);
  const [custom, setCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<string[]>([]);
  const range = custom ? { from: customFrom, to: customTo } : presetDates(year, month, half);
  const changeMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(d.getUTCFullYear()); setMonth(d.getUTCMonth() + 1);
  };
  const load = useCallback(async () => {
    if (!range.from || !range.to || range.from > range.to) {
      setRows([]); setError('Confira as datas escolhidas.'); return;
    }
    setLoading(true); setError('');
    // Busca as entradas somente no período e só considera fatos físicos confirmados.
    // O limite visível nunca é silenciosamente truncado: mostra aviso para períodos grandes.
    const { data, error: queryError } = await db.from('production_fact_process_entries')
      .select(`id,production_fact_id,operator_name,operator_user_id,total_value,
        production_fact:production_facts!production_fact_process_entries_production_fact_id_fkey(
          id,status,quantity,occurred_at,
          product:products!production_facts_product_id_fkey(id,name,cover_image_url),
          variant:product_variants!production_facts_variant_id_fkey(variant_name)
        )`)
      .gte('occurred_at', `${range.from}T00:00:00-03:00`)
      .lt('occurred_at', `${localDate(new Date(Date.parse(range.to + 'T12:00:00-03:00') + 86400000))}T00:00:00-03:00`)
      .order('occurred_at', { ascending: false })
      .limit(1000);
    if (queryError) { setError('Não foi possível consultar a produção.'); setRows([]); }
    else {
      const values = (data ?? []) as Entry[];
      if (values.length === 1000) setError('Há muitos lançamentos neste período. Escolha um intervalo menor para ver tudo.');
      setRows(values.filter(row => row.production_fact?.status === 'confirmed'));
    }
    setLoading(false);
  }, [range.from, range.to]);
  useEffect(() => { void load(); }, [load]);
  const { facts, workers, total } = useMemo(() => {
    const grouped = new Map<string, Fact>();
    const summaries = new Map<string, number>();
    for (const row of rows) {
      const p = row.production_fact;
      if (!p) continue;
      const name = (row.operator_name || 'Operador').trim();
      const key = row.operator_user_id || name;
      const value = Number(row.total_value || 0);
      const fact = grouped.get(p.id) ?? {
        id: p.id, productId: p.product?.id ?? p.id, name: p.product?.name ?? 'Produto acabado', variant: p.variant?.variant_name ?? '',
        image: p.product?.cover_image_url ?? null, quantity: Number(p.quantity || 0),
        date: localDate(new Date(p.occurred_at)), workers: new Map<string, number>(),
      };
      fact.workers.set(name, (fact.workers.get(name) ?? 0) + value);
      grouped.set(p.id, fact);
      summaries.set(key + '::' + name, (summaries.get(key + '::' + name) ?? 0) + value);
    }
    return {
      facts: [...grouped.values()].sort((a,b) => b.date.localeCompare(a.date)),
      workers: [...summaries.entries()].map(([key,value]) => ({ name: key.split('::').slice(1).join('::'), value })).sort((a,b)=>b.value-a.value),
      total: [...summaries.values()].reduce((a,b)=>a+b,0),
    };
  }, [rows]);

  const products = useMemo<ProductGroup[]>(() => {
    const byProduct = new Map<string, ProductGroup>();
    for (const fact of facts) {
      const current = byProduct.get(fact.productId) ?? { id: fact.productId, name: fact.name, image: fact.image, quantity: 0, facts: [] };
      current.quantity += fact.quantity;
      current.facts.push(fact);
      byProduct.set(fact.productId, current);
    }
    return [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [facts]);
  const toggleProduct = (id: string) => {
    setExpandedProducts(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  };

  return <main className="min-h-[100dvh] bg-[#f2f7fb] pb-[max(28px,env(safe-area-inset-bottom))] text-slate-900">
    <div className="mx-auto w-full max-w-xl px-4 pt-[max(18px,env(safe-area-inset-top))]">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div><p className="text-sm font-semibold text-sky-700">AMOR DE FAMÍLIA</p><h1 className="text-3xl font-extrabold leading-tight">Nossa Produção</h1></div>
        <Button variant="outline" className="h-12 rounded-xl px-4 text-base font-semibold" onClick={onSignOut}>Sair</Button>
      </header>
      <Button onClick={onProduce} className="mb-5 h-14 w-full rounded-2xl bg-slate-900 text-lg font-bold text-white">
        <ArrowLeft className="mr-2 h-5 w-5"/>Voltar para produzir
      </Button>
      <section className="mb-5 rounded-3xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xl font-extrabold"><CalendarDays className="h-6 w-6 text-sky-700"/>Escolha o período</div>
        <div className="grid grid-cols-2 gap-2">
          <Button className="h-14 rounded-xl text-base font-bold" variant={!custom && half === 1 ? 'default':'outline'} onClick={()=>{setCustom(false);setHalf(1);}}>Dia 1 ao 15</Button>
          <Button className="h-14 rounded-xl text-base font-bold" variant={!custom && half === 2 ? 'default':'outline'} onClick={()=>{setCustom(false);setHalf(2);}}>Dia 16 ao fim</Button>
        </div>
        <Button className="mt-2 h-12 w-full rounded-xl text-base" variant={custom ? 'default':'outline'} onClick={()=>setCustom(!custom)}>Escolher outras datas</Button>
        {custom ? <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-base font-semibold">De<Input aria-label="Data inicial" type="date" className="mt-1 h-12 text-base" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/></label>
          <label className="text-base font-semibold">Até<Input aria-label="Data final" type="date" className="mt-1 h-12 text-base" value={customTo} onChange={e=>setCustomTo(e.target.value)}/></label>
        </div> : <div className="mt-3 flex items-center justify-between">
          <Button size="icon" variant="outline" className="h-12 w-12 rounded-xl" aria-label="Mês anterior" onClick={()=>changeMonth(-1)}><ChevronLeft/></Button>
          <div className="text-center"><p className="text-lg font-extrabold capitalize">{new Date(Date.UTC(year,month-1,1)).toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'})}</p><p className="text-sm font-semibold text-slate-600">{formatDate(range.from)} a {formatDate(range.to)}</p></div>
          <Button size="icon" variant="outline" className="h-12 w-12 rounded-xl" aria-label="Próximo mês" onClick={()=>changeMonth(1)}><ChevronRight/></Button>
        </div>}
      </section>
      <section className="mb-5 rounded-3xl bg-emerald-700 p-5 text-white shadow-sm">
        <div className="flex items-center gap-2 text-lg font-bold"><Wallet className="h-6 w-6"/>Valor registrado da equipe</div>
        <p className="mt-2 text-4xl font-black tabular-nums">{currency(total)}</p>
        <p className="mt-2 text-sm text-emerald-50">Trabalhos lançados neste período. Não significa pagamento realizado.</p>
      </section>
      <h2 className="mb-3 flex items-center gap-2 text-2xl font-extrabold"><Factory className="h-6 w-6 text-sky-700"/>Produtos prontos</h2>
      {loading && <p className="rounded-2xl bg-white p-6 text-center text-lg font-semibold">Carregando produção...</p>}
      {error && <p role="alert" className="mb-3 rounded-2xl bg-amber-100 p-4 text-base font-semibold text-amber-900">{error}</p>}
      {!loading && facts.length===0 && <p className="rounded-2xl bg-white p-6 text-center text-lg">Nenhuma produção registrada neste período.</p>}
      <div className="space-y-4">{!loading && products.map(product => {
        const expanded = expandedProducts.includes(product.id);
        return <section key={product.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <button type="button" aria-expanded={expanded} aria-controls={`production-product-${product.id}`}
            onClick={() => toggleProduct(product.id)}
            className="flex min-h-32 w-full items-center gap-3 p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-sky-700">
            {product.image
              ? <img src={product.image} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover"/>
              : <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-sky-50"><Factory className="h-11 w-11 text-sky-700"/></div>}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-extrabold leading-snug">{product.name}</h3>
              <p className="mt-2 text-2xl font-black text-sky-900">{product.quantity.toLocaleString('pt-BR')} prontos</p>
              <p className="mt-1 text-base font-bold text-sky-700">{expanded ? 'Ocultar lançamentos' : 'Ver lançamentos'}</p>
            </div>
            <ChevronDown className={`h-7 w-7 shrink-0 text-sky-800 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true"/>
          </button>
          {expanded && <div id={`production-product-${product.id}`} className="space-y-3 border-t border-slate-200 bg-slate-50 p-3">
            {product.facts.map(fact => <article key={fact.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-lg font-extrabold">{formatDate(fact.date)}</p>
                  {fact.variant && <p className="text-base font-semibold text-slate-600">{fact.variant}</p>}</div>
                <strong className="rounded-xl bg-sky-100 px-3 py-2 text-xl text-sky-900">{fact.quantity.toLocaleString('pt-BR')} prontos</strong>
              </div>
              <p className="mb-1 mt-4 text-lg font-extrabold">Quem trabalhou</p>
              {[...fact.workers.entries()].map(([name,value]) =>
                <div key={name} className="flex items-start justify-between gap-2 border-t border-slate-100 py-3 text-lg">
                  <span className="min-w-0 font-bold">{name}</span>
                  <strong className="shrink-0 text-emerald-800">{currency(value)}</strong>
                </div>)}
              <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-100 px-3 py-3 text-lg font-extrabold">
                <span>Total</span><span>{currency([...fact.workers.values()].reduce((a,b)=>a+b,0))}</span>
              </div>
            </article>)}
          </div>}
        </section>;
      })}</div>
      {!loading && workers.length>0 && <section className="mt-6 rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-2xl font-extrabold"><Users className="h-6 w-6 text-sky-700"/>Valor por operador</h2>
        {workers.map(person=><div key={person.name} className="flex items-start justify-between gap-2 border-t border-slate-100 py-4 text-lg"><span className="font-bold">{person.name}</span><strong className="shrink-0 text-emerald-800">{currency(person.value)}</strong></div>)}
      </section>}
      <Button variant="outline" onClick={()=>void load()} className="mt-5 h-14 w-full rounded-xl text-lg font-bold"><RefreshCw className="mr-2 h-5 w-5"/>Atualizar</Button>
    </div>
  </main>;
}
