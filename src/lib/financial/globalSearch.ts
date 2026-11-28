export function normalizeFinancialSearch(value:string) {
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
export function parseSearchAmount(value:string):number|null {
 const raw=value.trim().replace(/^R\$\s*/i,'');
 if(!/^(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d+(?:[,.]\d{1,2})?)$/.test(raw)) return null;
 const amount=Number(raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw);
 return Number.isFinite(amount)?amount:null;
}
export type SearchEntry={id:string;type:string;description:string;value:number;value_paid:number;due_date:string;document_number?:string|null;contact?:{name:string}|null;order?:{order_number:string;customer_name:string}|null;purchase?:{internal_purchase_number:string;supplier?:{name:string}|null}|null;marketplace_account?:string|null};
export function matchesFinancialSearch(entry:SearchEntry,query:string,type:string) {
 if(type!=='all' && type!==entry.type)return false;
 const q=normalizeFinancialSearch(query);
 if(!q)return false;
 const amount=parseSearchAmount(query);
 return [entry.description,entry.document_number,entry.contact?.name,entry.order?.order_number,entry.order?.customer_name,entry.purchase?.internal_purchase_number,entry.purchase?.supplier?.name,entry.marketplace_account,entry.id].some(v=>v&&normalizeFinancialSearch(v).includes(q)) || (amount!==null && (Number(entry.value)===amount||Number(entry.value_paid)===amount));
}
