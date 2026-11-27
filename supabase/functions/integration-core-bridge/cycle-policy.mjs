// D11 admission contract. Pure resolver; not wired to any live writer.
// Only a future protected Core reader may supply policy, channel and connection.
// Never construct these records from request bodies, channel metadata or OAuth grants.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS=Object.freeze(['discover','intake','ship','label','refresh']);
const FISCAL=new Set(['cpf_no_invoice_step','pj_shopee_issuer']);
const EVIDENCE=/^[a-zA-Z0-9][a-zA-Z0-9_.:/#-]{0,299}$/;
const id=v=>typeof v==='string'&&UUID.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>0;
const denied=code=>({ok:false,code});
function instant(v){
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v))return NaN;
  const t=Date.parse(v);
  return Number.isFinite(t)&&new Date(t).toISOString().slice(0,19)===v.slice(0,19)?t:NaN;
}
function cap(v,max){return Number.isSafeInteger(v)&&v>=1&&v<=max;}
export function resolveCyclePolicy({accountId,action,policy,channel,connection,now=Date.now()}={}){
  if(!id(accountId)||!ACTIONS.includes(action)||!Number.isFinite(now))return denied('policy_input_invalid');
  if(!policy||policy.enabled!==true)return denied('policy_absent_or_disabled');
  if(policy.channel_account_id!==accountId||channel?.id!==accountId||channel.is_active!==true
    ||channel.marketplace!=='shopee'||connection?.channel_account_id!==accountId
    ||connection.environment!=='live'||policy.environment!=='live'
    ||!integer(policy.shop_id)||connection.shop_id!==policy.shop_id
    ||policy.partner_id!==2047685||connection.partner_id!==policy.partner_id)
    return denied('policy_identity_mismatch');
  if(connection.shop_status!=='NORMAL'||!(instant(connection.authorization_expires_at)>now))
    return denied('policy_connection_unavailable');
  if(!integer(policy.revision)||!id(policy.authorized_by)
    ||typeof policy.evidence_ref!=='string'||!EVIDENCE.test(policy.evidence_ref)
    ||!(instant(policy.authorized_at)<=now)||!(instant(policy.expires_at)>now)
    ||!(instant(policy.expires_at)>instant(policy.authorized_at)))
    return denied('policy_authority_invalid_or_expired');
  if(policy.paused!==false)return denied('policy_paused');
  const c=policy.capabilities;
  if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).length!==ACTIONS.length
    ||!ACTIONS.every(k=>Object.hasOwn(c,k)&&typeof c[k]==='boolean'))
    return denied('policy_capabilities_invalid');
  if((c.intake&&!c.discover)||(c.ship&&!c.intake)||(c.label&&!c.intake)
    ||(c.refresh&&!c.discover))return denied('policy_dependencies_invalid');
  if(!c[action])return denied('policy_action_disabled');
  if(!cap(policy.page_size,5)||!cap(policy.max_actions_per_cycle,3)
    ||!cap(policy.work_budget_ms,48000)||!Number.isSafeInteger(policy.history_cutoff)
    ||policy.history_cutoff<1||policy.history_cutoff>Math.floor(now/1000))
    return denied('policy_limits_invalid');
  if(c.ship&&(!FISCAL.has(policy.fiscal_mode)||policy.shipping_mode!=='simple_dropoff'
    ||typeof policy.shipping_evidence_ref!=='string'||!EVIDENCE.test(policy.shipping_evidence_ref)))
    return denied('policy_shipping_unhomologated');
  if(c.label&&policy.document_type!=='NORMAL_AIR_WAYBILL')return denied('policy_document_unsupported');
  // An approved policy is admission, not a lease, order proof or claim.
  // The runtime must acquire its existing Core lease and recheck authorization
  // at irreversible boundaries. No token or credential data is returned.
  return {ok:true,code:'policy_admitted',profile:Object.freeze({
    account:accountId,shop:policy.shop_id,partner:policy.partner_id,revision:policy.revision,
    action,expires_at:policy.expires_at,history_cutoff:policy.history_cutoff,
    page_size:policy.page_size,max_actions_per_cycle:policy.max_actions_per_cycle,
    work_budget_ms:policy.work_budget_ms,fiscal_mode:policy.fiscal_mode??null,
    shipping_mode:policy.shipping_mode??null,document_type:policy.document_type??null,
  })};
}
