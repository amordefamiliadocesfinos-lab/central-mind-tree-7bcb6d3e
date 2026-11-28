import {useState,useEffect} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {supabase} from '@/integrations/supabase/client';
import {formatCurrency} from '@/lib/utils';
import {format} from 'date-fns';

type Shop={id:string;name:string};
type Receipt={id:string;description:string;value:number;value_paid:number;payment_date:string|null;marketplace_account:string|null;channel_account_id:string|null};
export function ShopeeReceiptAssistDialog({open,onOpenChange}:{open:boolean;onOpenChange:(v:boolean)=>void}){
 const [shops,setShops]=useState<Shop[]>([]);
 const [shop,setShop]=useState('');
 const [date,setDate]=useState(format(new Date(),'yyyy-MM-dd'));
 const [amount,setAmount]=useState('');
 const [matches,setMatches]=useState<Receipt[]>([]);
 const [unassigned,setUnassigned]=useState<number|null>(null);
 const [linked,setLinked]=useState<number|null>(null);
 const [loading,setLoading]=useState(false);
 const [checked,setChecked]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!open)return;
  let cancelled=false;
  setLoading(true);
  supabase.from('channel_accounts').select('id,name,platform:digital_platforms!inner(name)').eq('is_active',true).ilike('platform.name','%shopee%').order('name').then(({data,error})=>{
   if(cancelled)return;
   if(error)setError('Não foi possível carregar as contas comerciais.');
   else setShops((data||[]) as Shop[]);
   setLoading(false);
  });
  return()=>{cancelled=true;};
 },[open]);
 const reset=()=>{setChecked(false);setMatches([]);setUnassigned(null);setLinked(null);setError('');};
 const inspect=async(e:React.FormEvent)=>{
  e.preventDefault();reset();
  const selected=shops.find(s=>s.id===shop);
  const value=Number(amount);
  if(!selected||!date||!Number.isFinite(value)||value<=0)return;
  setLoading(true);
  try{
   const [receipts,unknown,orders]=await Promise.all([
    supabase.from('financial_entries').select('id,description,value,value_paid,payment_date,marketplace_account,channel_account_id').eq('lifecycle_status','active').eq('type','receber').eq('sales_channel','shopee').eq('payment_date',date).order('id').limit(500),
    supabase.from('financial_entries').select('id,order:orders!financial_entries_order_id_fkey!inner(channel)',{count:'exact',head:true}).eq('lifecycle_status','active').eq('type','receber').in('order.channel',['marketplace','ecommerce']).is('channel_account_id',null).not('order_id','is',null),
    supabase.from('financial_entries').select('id',{count:'exact',head:true}).eq('lifecycle_status','active').eq('type','receber').eq('channel_account_id',selected.id).not('order_id','is',null)
   ]);
   if(receipts.error||unknown.error||orders.error||unknown.count===null||orders.count===null||(receipts.data||[]).length>=500)throw new Error('Consulta incompleta. Não é possível confirmar a ausência de duplicidade.');
   // Include all same-value receipts on the date, even if store attribution is unclear.
   setMatches(((receipts.data||[]) as Receipt[]).filter(r=>Number(r.value_paid)===value||Number(r.value)===value));
   setUnassigned(unknown.count);setLinked(orders.count);setChecked(true);
  }catch(err){setError(err instanceof Error?err.message:'Falha na consulta.');}
  finally{setLoading(false);}
 };
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
 <DialogHeader><DialogTitle>Recebimento Shopee — assistência</DialogTitle><DialogDescription>Confira um crédito real antes de registrá-lo. Esta consulta não cria receita, baixa ou conciliação.</DialogDescription></DialogHeader>
 <form onSubmit={inspect} className="space-y-3">
 <div><Label>Conta Shopee</Label><Select disabled={loading} value={shop} onValueChange={v=>{reset();setShop(v);}}><SelectTrigger><SelectValue placeholder="Selecione a loja"/></SelectTrigger><SelectContent>{shops.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
 <div className="grid grid-cols-2 gap-2"><div><Label>Data do crédito</Label><Input disabled={loading} type="date" required value={date} onChange={e=>{reset();setDate(e.target.value);}}/></div><div><Label>Valor recebido</Label><Input disabled={loading} type="number" min="0.01" step="0.01" required value={amount} onChange={e=>{reset();setAmount(e.target.value);}}/></div></div>
 <Button type="submit" disabled={loading||!shop||!date||!(Number(amount)>0)}>{loading?'Consultando...':'Conferir recebimento'}</Button>
 </form>
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 {checked&&<div className="space-y-2 border rounded-lg p-3">
 <strong>{matches.length?'Possíveis recebimentos já registrados':'Nenhuma coincidência exata por data de quitação e valor'}</strong>
 {matches.map(r=><div key={r.id} className="border-t pt-2 text-sm"><p>{r.description} · {formatCurrency(Number(r.value_paid))}</p><p className="text-muted-foreground">{r.marketplace_account||'Loja não identificada'}</p></div>)}
 <p className="text-sm">Obrigações vinculadas à loja: {linked}. Obrigações de marketplace/e-commerce sem ID de loja: {unassigned}. Inclui quitadas e abertas.</p>
 <p className="text-sm text-muted-foreground">A ausência de coincidência não comprova que a receita é nova. Confira o extrato e os pedidos correspondentes. Registro e conciliação permanecem separados; nenhuma nova receita será criada nesta assistência.</p>
 </div>}
 <Button variant="outline" onClick={()=>onOpenChange(false)}>Fechar</Button>
 </DialogContent></Dialog>;
}
