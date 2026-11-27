import {useEffect,useState} from 'react';
import {format} from 'date-fns';
import {supabase} from '@/integrations/supabase/client';
import {projectRealizedCash,type CashMovementRow} from '@/lib/financial/realizedCash';
import type {FinancialFilters} from './useFinancial';

export function useRealizedCash(filters:FinancialFilters, refreshToken:unknown) {
 const start=filters.startDate?format(filters.startDate,'yyyy-MM-dd'):undefined;
 const end=filters.endDate?format(filters.endDate,'yyyy-MM-dd'):undefined;
 const {type,categoryId,accountId,salesChannel,marketplaceAccount,search}=filters;
 const key=JSON.stringify([start,end,type,categoryId,accountId,salesChannel,marketplaceAccount,search]);
 type Report=ReturnType<typeof projectRealizedCash>;
 const [state,setState]=useState<{key:string;report:Report|null;error:string;refresh:unknown}>({key:'',report:null,error:'',refresh:null});
 useEffect(()=>{
  const controller=new AbortController();
  setState({key,report:null,error:'',refresh:refreshToken});
  async function load(){
   const rows:CashMovementRow[]=[];
   let expected:number|null=null;
   for(let offset=0;;offset+=500){
    let q=(supabase.from as any)('financial_movements').select('id,entry_id,movement_date,value:value::text,account_id,account:financial_accounts(id,name),entry:financial_entries!inner(id,type,description,category_id,category:financial_categories(name),contact:contacts(name),sales_channel,marketplace_account,value,value_paid,due_date)',{count:'exact'}).order('id').range(offset,offset+499).abortSignal(controller.signal);
    if(start)q=q.gte('movement_date',start);
    if(end)q=q.lte('movement_date',end);
    if(type)q=q.eq('entry.type',type);
    if(categoryId)q=q.eq('entry.category_id',categoryId);
    if(accountId)q=q.eq('account_id',accountId);
    if(salesChannel)q=q.eq('entry.sales_channel',salesChannel);
    if(marketplaceAccount)q=q.eq('entry.marketplace_account',marketplaceAccount);
    if(search)q=q.ilike('entry.description',`%${search}%`);
    const {data,error,count}=await q;
    if(error)throw error;
    if(!Array.isArray(data)||count==null||(expected!==null&&expected!==count))throw Error('Leitura de caixa mudou durante a consulta.');
    expected=count;rows.push(...data);
    if(rows.length===expected)break;
    if(data.length!==500||rows.length>expected)throw Error('Leitura de caixa incompleta.');
   }
   const report=projectRealizedCash(rows,start,end);
   if(!controller.signal.aborted)setState({key,report,error:'',refresh:refreshToken});
  }
  load().catch(e=>{if(!controller.signal.aborted)setState({key,report:null,error:e?.message||'Falha ao consultar caixa.',refresh:refreshToken});});
  return ()=>controller.abort();
 },[key,refreshToken]);
 const current=state.key===key&&state.refresh===refreshToken;
 return {report:current?state.report:null,error:current?state.error:'',loading:!current||(!state.report&&!state.error)};
}
