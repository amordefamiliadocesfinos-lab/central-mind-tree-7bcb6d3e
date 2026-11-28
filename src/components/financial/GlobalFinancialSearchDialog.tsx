import {useState,useRef,useEffect} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {supabase} from '@/integrations/supabase/client';
import {formatCurrency} from '@/lib/utils';
import {matchesFinancialSearch,type SearchEntry} from '@/lib/financial/globalSearch';
import {Search} from 'lucide-react';

export function GlobalFinancialSearchDialog({open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void}) {
 const [query,setQuery]=useState('');
 const [type,setType]=useState('all');
 const [results,setResults]=useState<SearchEntry[]>([]);
 const [searched,setSearched]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [page,setPage]=useState(0);
 const request=useRef<AbortController|null>(null);
 useEffect(()=>()=>request.current?.abort(),[]);
 const reset=()=>{request.current?.abort();request.current=null;setResults([]);setSearched(false);setLoading(false);setError('');setPage(0);};
 const search=async(e:React.FormEvent)=>{
  e.preventDefault();
  if(query.trim().length<2)return;
  reset();
  const controller=new AbortController();request.current=controller;setLoading(true);
  try {
   const found:SearchEntry[]=[];
   const seen=new Set<string>();
   const size=500;
   let expected:number|null=null;
   // Explicit search only. No dashboard filters, no write, no privileged client.
   for(let offset=0;;offset+=size){
    const {data,error,count}=await supabase.from('financial_entries')
     .select('id,type,description,value,value_paid,due_date,document_number,marketplace_account,contact:contacts!financial_entries_contact_id_fkey(name),order:orders!financial_entries_order_id_fkey(order_number,customer_name),purchase:purchase_orders!financial_entries_purchase_order_id_fkey(internal_purchase_number,supplier:contacts!purchase_orders_supplier_contact_id_fkey(name))',{count:'exact'})
     .eq('lifecycle_status','active').order('id').range(offset,offset+size-1).abortSignal(controller.signal);
    if(controller.signal.aborted)return;
    if(error||!data||count===null)throw new Error('Não foi possível consultar todos os lançamentos.');
    if(expected===null)expected=count;
    if(count!==expected)throw new Error('Os lançamentos mudaram durante a consulta. Pesquise novamente.');
    for(const row of data as unknown as SearchEntry[]){
     if(seen.has(row.id))throw new Error('A consulta mudou durante a leitura. Pesquise novamente.');
     seen.add(row.id);
     if(matchesFinancialSearch(row,query,type))found.push(row);
    }
    if(seen.size===expected)break;
    if(!data.length||data.length<size||seen.size>expected)throw new Error('Consulta incompleta. Pesquise novamente.');
   }
   if(!controller.signal.aborted){setResults(found.sort((a,b)=>b.due_date.localeCompare(a.due_date)||a.id.localeCompare(b.id)));setSearched(true);}
  }catch(err){if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Falha na pesquisa.');}
  finally{if(!controller.signal.aborted)setLoading(false);}
 };
 const size=25;
 return <Dialog open={open} onOpenChange={next=>{if(!next)reset();onOpenChange(next);}}><DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
  <DialogHeader><DialogTitle>Pesquisa global de lançamentos</DialogTitle><DialogDescription>Consulta todos os períodos disponíveis. Não altera os filtros nem os indicadores do Financeiro.</DialogDescription></DialogHeader>
  <form onSubmit={search} className="flex flex-wrap gap-2">
   <Input className="flex-1 min-w-[180px]" aria-label="Pesquisar lançamento" placeholder="Pedido, fornecedor, descrição, documento ou valor" value={query} onChange={e=>{reset();setQuery(e.target.value);}} maxLength={160}/>
   <Select value={type} onValueChange={v=>{reset();setType(v);}}><SelectTrigger className="w-[130px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="pagar">A pagar</SelectItem><SelectItem value="receber">A receber</SelectItem></SelectContent></Select>
   <Button type="submit" disabled={loading||query.trim().length<2}><Search className="h-4 w-4 mr-2"/>Pesquisar</Button>
  </form>
  {loading&&<p role="status" className="text-sm">Consultando todos os períodos...</p>}
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {searched&&<p className="text-sm text-muted-foreground">{results.length} resultado(s) · lançamentos ativos · todos os períodos</p>}
  {searched&&!results.length&&<p className="py-4 text-center text-muted-foreground">Nenhum lançamento encontrado.</p>}
  <div className="space-y-2">{results.slice(page*size,(page+1)*size).map(row=><div key={row.id} className="rounded-lg border p-3 space-y-1">
   <div className="flex flex-wrap justify-between gap-2"><strong>{row.description}</strong><strong>{formatCurrency(Number(row.value))}</strong></div>
   <p className="text-xs text-muted-foreground">{row.type==='pagar'?'A pagar':'A receber'} · Vencimento: {row.due_date.split('-').reverse().join('/')} · Pago/recebido: {formatCurrency(Number(row.value_paid))}</p>
   <p className="text-xs">{[row.contact?.name,row.order?.order_number,row.order?.customer_name,row.purchase?.internal_purchase_number,row.purchase?.supplier?.name,row.document_number,row.marketplace_account].filter(Boolean).join(' · ')}</p>
  </div>)}</div>
  {results.length>size&&<div className="flex justify-between items-center"><Button variant="outline" disabled={!page} onClick={()=>setPage(p=>p-1)}>Anterior</Button><span className="text-xs">{page+1} / {Math.ceil(results.length/size)}</span><Button variant="outline" disabled={(page+1)*size>=results.length} onClick={()=>setPage(p=>p+1)}>Próxima</Button></div>}
 </DialogContent></Dialog>;
}
