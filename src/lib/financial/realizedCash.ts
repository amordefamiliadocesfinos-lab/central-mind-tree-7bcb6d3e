// FIN-F11: read-side projection only. Never writes or changes obligation status.
export interface CashMovementRow {
  id: string; entry_id: string; movement_date: string; value: number | string;
  account_id: string | null; account: {id:string;name:string} | null;
  entry: {id:string;type:'pagar'|'receber';description:string;category_id?:string;category?:{name:string};contact?:{name:string};sales_channel?:string;marketplace_account?:string;value:number;value_paid:number;due_date:string} | null;
}
export function projectRealizedCash(rows: CashMovementRow[], start?:string,end?:string) {
  const ids = new Set<string>();
  let incoming=0n,outgoing=0n;
  const movements = rows.filter(m=>(!start||m.movement_date>=start)&&(!end||m.movement_date<=end)).map(m=>{
    if(ids.has(m.id)) throw new Error('Movimento duplicado na leitura.');
    ids.add(m.id);
    if(!m.entry||!['pagar','receber'].includes(m.entry.type)) throw new Error('Movimento sem obrigação visível.');
    const value=String(m.value);
    if(!/^\d+(\.\d+)?$/.test(value)) throw new Error('Valor de movimento inválido.');
    // Legacy subcent amounts: sum exactly at source precision, round only display aggregate.
    return {...m,entry:m.entry,raw:value};
  });
  const scale=Math.max(2,...movements.map(m=>(m.raw.split('.')[1]||'').length));
  const factor=10n**BigInt(scale);
  for(const m of movements){
    const [whole,frac='']=m.raw.split('.');
    const units=BigInt(whole)*factor+BigInt(frac.padEnd(scale,'0'));
    if(m.entry.type==='receber') incoming+=units; else outgoing+=units;
  }
  const amount=(n:bigint)=>Number(n)/Number(factor);
  return {movements,incoming:amount(incoming),outgoing:amount(outgoing),net:amount(incoming-outgoing)};
}
