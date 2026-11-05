// Read-only, bounded, deterministic Shopee mapping catalog loader.
// Supabase/PostgREST may cap each request to 1000 rows; all pages must be read.
// Never partially recognize an order when a page or component fails.
const PAGE_SIZE = 200;
const MAX_MAPPINGS = 2000;
const MAX_COMPONENTS = 20000;
const COMPONENT_BATCH = 80;

async function allPages(makeQuery, max, errorCode) {
  const rows = [];
  for (let offset=0; offset<=max; offset+=PAGE_SIZE) {
    let response;
    try { response = await makeQuery().range(offset,offset+PAGE_SIZE-1); }
    catch { return {error:errorCode}; }
    if (response?.error || !Array.isArray(response?.data)) return {error:errorCode};
    // Detect backend cap/truncation by continuing on full pages.
    if (rows.length+response.data.length>max) return {error:errorCode};
    rows.push(...response.data);
    if (response.data.length<PAGE_SIZE) return {rows};
  }
  return {error:errorCode};
}

export async function readShopeeScopedMappingCatalog(core, channelAccountId, marketplaceAccount) {
  if (!channelAccountId || !marketplaceAccount) return {error:'intake_mapping_read_failed'};
  const select='id,marketplace,marketplace_account,external_item_key,external_item_id,external_model_id,product_id,variant_id,physical_multiplier,channel_account_id';
  const scoped=await allPages(() => core.from('marketplace_product_mappings').select(select)
    .eq('marketplace','shopee').eq('channel_account_id',channelAccountId)
    .order('id',{ascending:true}),MAX_MAPPINGS,'intake_mapping_read_failed');
  if (scoped.error)return scoped;
  const legacy=await allPages(() => core.from('marketplace_product_mappings').select(select)
    .eq('marketplace','shopee').is('channel_account_id',null)
    .eq('marketplace_account',marketplaceAccount)
    .order('id',{ascending:true}),MAX_MAPPINGS,'intake_mapping_read_failed');
  if (legacy.error)return legacy;
  const mappingById=new Map();
  for(const m of [...scoped.rows,...legacy.rows]){
    if(!m?.id || mappingById.has(String(m.id)))return {error:'intake_mapping_catalog_ambiguous'};
    mappingById.set(String(m.id),m);
    if(mappingById.size>MAX_MAPPINGS)return {error:'intake_mapping_catalog_too_large'};
  }
  const componentsByMapping=new Map();
  let componentTotal=0;
  const ids=[...mappingById.keys()];
  for(let offset=0;offset<ids.length;offset+=COMPONENT_BATCH){
    const chunk=ids.slice(offset,offset+COMPONENT_BATCH);
    const result=await allPages(()=>core.from('marketplace_product_mapping_items')
      .select('id,mapping_id,product_id,variant_id,physical_multiplier,position')
      .in('mapping_id',chunk).order('id',{ascending:true}),
      MAX_COMPONENTS,'intake_mapping_component_read_failed');
    if(result.error)return result;
    componentTotal+=result.rows.length;
    if(componentTotal>MAX_COMPONENTS)return {error:'intake_mapping_component_read_failed'};
    for(const row of result.rows){
      const id=String(row?.mapping_id ?? '');
      if(!mappingById.has(id))return {error:'intake_mapping_component_read_failed'};
      const list=componentsByMapping.get(id)??[];
      list.push(row);
      componentsByMapping.set(id,list);
    }
  }
  return {mappings:[...mappingById.values()].map(m=>({...m,
    components:(componentsByMapping.get(String(m.id))??[])
      .sort((a,b)=>Number(a.position)-Number(b.position)||String(a.id).localeCompare(String(b.id)))}))};
}
