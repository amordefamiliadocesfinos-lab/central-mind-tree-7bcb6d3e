// Suggestions only: explicit origin, never infer payment or classify from free text.
type Origin = {type:string; purchase_order_id?:string|null; order_id?:string|null; notes?:string|null; sales_channel?:string|null; marketplace_account?:string|null};
type Category = {id:string;name:string;type:string;is_active:boolean};
export function suggestCategory(entry:Origin,categories:Category[]) {
 if(entry.purchase_order_id && entry.order_id) return null;
 let name:string|undefined;
 let reason:string|undefined;
 if(entry.type==='pagar' && entry.purchase_order_id) {name='Fornecedores';reason='Compra vinculada';}
 else if(entry.type==='pagar' && entry.order_id && entry.notes?.includes('FIN-F17:order-logistics')) {name='TRANSPORTE';reason='Despesa logística vinculada';}
 else if(entry.type==='receber' && entry.order_id && !entry.purchase_order_id && !entry.marketplace_account && !['marketplace','ecommerce','shopee'].includes((entry.sales_channel||'').toLowerCase())) {name='Vendas';reason='Pedido de venda vinculado';}
 if(!name) return null;
 const matches=categories.filter(c=>c.is_active && (c.type===entry.type||c.type==='ambos') && c.name.trim().toLowerCase()===name.toLowerCase());
 return matches.length===1?{id:matches[0].id, name:matches[0].name,reason}:null;
}
