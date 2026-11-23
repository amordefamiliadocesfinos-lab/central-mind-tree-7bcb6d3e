/** E3/E4 bounded, deterministic PostgREST pagination. Pure and read-only.
 * A result is complete only after a short page or an explicit empty look-ahead.
 * The (limit + 1) sentinel prevents a limit-boundary page looking complete.
 */
export type E3PageResult<T>={data:T[]|null;error:{message:string}|null};
export type E3BoundedResult<T>={rows:T[];truncated:boolean};
export type E3PageIntegrity<T>={
 identity:(row:T)=>string;
 /** True only when the previous row must precede the next in the query order. */
 ordered:(previous:T,next:T)=>boolean;
};
export async function readE3BoundedPages<T>(
 fetchPage:(start:number,end:number)=>PromiseLike<E3PageResult<T>>,
 limit:number,pageSize=400,integrity?:E3PageIntegrity<T>
):Promise<E3BoundedResult<T>>{
 if(!Number.isSafeInteger(limit)||limit<1||
    !Number.isSafeInteger(pageSize)||pageSize<1||pageSize>1000)
  throw new Error("Limites de paginação E3 inválidos.");
 const rows:T[]=[];
 const seen=new Set<string>();
 while(rows.length<=limit){
  const requested=Math.min(pageSize,limit+1-rows.length);
  const result=await fetchPage(rows.length,rows.length+requested-1);
  if(result.error)throw new Error(result.error.message);
  if(!Array.isArray(result.data))throw new Error("Resposta de paginação E3 indisponível.");
  if(result.data.length>requested)
   throw new Error("Resposta E3 excedeu o tamanho solicitado.");
  if(integrity){
   for(const item of result.data){
    const id=integrity.identity(item);
    if(!id||seen.has(id))
     throw new Error("Paginação E3 instável: identificador repetido ou ausente.");
    const prev=rows.at(-1);
    if(prev&&!integrity.ordered(prev,item))
     throw new Error("Paginação E3 instável: ordem das páginas alterada.");
    seen.add(id);
    rows.push(item);
   }
  }else rows.push(...result.data);
  if(rows.length>limit)return {rows:rows.slice(0,limit),truncated:true};
  if(result.data.length<requested)return {rows,truncated:false};
 }
 return {rows:rows.slice(0,limit),truncated:true};
}
