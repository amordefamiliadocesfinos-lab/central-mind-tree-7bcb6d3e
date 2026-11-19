import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  NUC_MODULE_ID,PILOT_ROLE,PILOT_SOURCE,PILOT_TITLE,
  parsePilotRequest,matchesPilotRecord,
  type PilotRecord,type PilotRequest,
} from "../_shared/nucleo/ac01-agent-pilot-contract.ts";

/**
 * F3 piloto NUC: somente a proposta de referência do mapa V1.1.
 * Nunca concede acesso, aprova documento, cria mandato ou publica método.
 * Usa ANON KEY + JWT individual do chamador, RLS/trigger AC-01 existentes.
 */
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
  status,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"},
});
const visible=(row:PilotRecord)=>({
  id:row.id,request_id:row.request_id,module_id:row.module_id,
  contribution_kind:row.contribution_kind,version_no:row.version_no,
  authority_state:row.authority_state,source_kind:row.source_kind,
  source_locator:row.source_locator,recorded_by_auth_uid:row.recorded_by_auth_uid,
});
Deno.serve(async request=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(request.method!=="POST")return json({error:"Método não permitido"},405);
  const authHeader=request.headers.get("Authorization");
  if(!authHeader?.startsWith("Bearer "))return json({error:"Autenticação obrigatória"},401);
  const token=authHeader.slice(7);
  if(!token||token.length>8192)return json({error:"Credencial inválida"},401);
  let requestBody: PilotRequest | null;
  try {
    const raw=await request.text();
    if(raw.length>500)return json({error:"Requisição excede limite"},413);
    requestBody=parsePilotRequest(JSON.parse(raw));
  } catch {return json({error:"JSON inválido"},400);}
  if(!requestBody)return json({error:"Contrato do piloto NUC inválido"},400);
  const intent=requestBody;
  const url=Deno.env.get("SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY");
  if(!url||!anon)return json({error:"Autenticação indisponível"},503);
  const db=createClient(url,anon,{
    global:{headers:{Authorization:authHeader}},
    auth:{persistSession:false,autoRefreshToken:false},
  });
  try {
    const identity=await db.auth.getUser(token);
    const uid=identity.data.user?.id;
    if(identity.error||!uid)return json({error:"Sessão inválida"},401);
    const grant=await db.from("app_admin_capabilities").select("auth_user_id")
      .eq("auth_user_id",uid).eq("capability","nucleo_manage")
      .eq("active",true).is("revoked_at",null).limit(2);
    if(grant.error||grant.data?.length!==1||grant.data[0].auth_user_id!==uid)
      return json({error:"Sem concessão ativa"},403);
    const module=await db.from("nucleo_development_workstreams")
      .select("id,kind").eq("id",NUC_MODULE_ID).eq("kind","modulo").limit(2);
    if(module.error||module.data?.length!==1)return json({error:"Módulo NUC não verificável"},503);
    const table=db.from("nucleo_specialist_contributions");
    // Reconcilia requisição idempotente antes de qualquer INSERT.
    const sameRequest=await table.select("*").eq("request_id",intent.request_id).limit(2);
    if(sameRequest.error||!sameRequest.data)return json({error:"Leitura AC-01 indeterminada; não reenviar"},503);
    if(sameRequest.data.length){
      if(sameRequest.data.length!==1||!matchesPilotRecord(sameRequest.data[0] as PilotRecord,intent,uid))
        return json({error:"request_id já utilizado em outro conteúdo"},409);
      return json({status:"confirmado_existente",record:visible(sameRequest.data[0] as PilotRecord)},200);
    }
    // Não criar segundo mapa sob outro request_id. Trata-se de um piloto único.
    const already=await table.select("*").eq("module_id",NUC_MODULE_ID)
      .eq("specialist_role",PILOT_ROLE).eq("contribution_kind","mapa")
      .eq("source_kind","github").eq("source_locator",PILOT_SOURCE).limit(2);
    if(already.error||!already.data)return json({error:"Pré-consulta indisponível; não reenviar"},503);
    if(already.data.length)return json({error:"Referência já cadastrada; reconciliar no Core"},409);
    const inserted=await table.insert({
      module_id:NUC_MODULE_ID,workstream_id:null,
      specialist_role:PILOT_ROLE,contribution_kind:"mapa",title:PILOT_TITLE,
      source_kind:"github",source_locator:PILOT_SOURCE,
      source_checksum_sha256:null,note:"",parent_revision_id:null,
      request_id:intent.request_id,recorded_by_auth_uid:uid,
    }).select("*").maybeSingle();
    // Mesmo se INSERT der timeout, conferir pelo MESMO request_id, nunca reenviar.
    const readback=await table.select("*").eq("request_id",intent.request_id).limit(2);
    if(readback.error||!readback.data||readback.data.length!==1)
      return json({error:"Estado da gravação indeterminado; reconciliar request_id, não repetir"},503);
    const record=readback.data[0] as PilotRecord;
    if(!matchesPilotRecord(record,intent,uid))
      return json({error:"Readback divergente: intervenção manual necessária"},409);
    return json({
      status:inserted.error?"confirmado_apos_reconciliacao":"confirmado_por_readback",
      record:visible(record),homologado:false,
    },inserted.error?200:201);
  }catch {
    return json({error:"Estado indeterminado; consultar o Core antes de repetir"},503);
  }
});
