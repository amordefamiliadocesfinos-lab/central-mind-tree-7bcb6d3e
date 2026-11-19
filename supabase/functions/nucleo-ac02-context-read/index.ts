import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
 NUC_MODULE_ID,PILOT_CONTRIBUTION_ID,FRONT_CODES,
 validRequest,validateFronts,validContribution,
 type NucContribution,type NucFront,
} from "../_shared/nucleo/ac02-nuc-read-contract.ts";

/**
 * AC-02 F3 consultivo do Núcleo: um escopo fixo, somente SELECT, JWT individual,
 * grant nucleo_manage ativo e RLS do usuário. Sem service_role ou conteúdo privado.
 * Não modifica a guarda NUC do endpoint nucleo-knowledge-read.
 */
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"},
});
Deno.serve(async request=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(request.method!=="POST")return json({error:"Método não permitido"},405);
 const header=request.headers.get("Authorization");
 if(!header?.startsWith("Bearer "))return json({error:"Autenticação obrigatória"},401);
 const token=header.slice(7);
 if(token.length<1||token.length>8192)return json({error:"Credencial inválida"},401);
 let payload:unknown;
 try{
   const raw=await request.text();
   if(raw.length>160)return json({error:"Corpo excessivo"},413);
   payload=JSON.parse(raw);
 }catch{return json({error:"JSON inválido"},400);}
 if(!validRequest(payload))return json({error:"Consulta NUC fora do escopo"},400);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY");
 if(!url||!anon)return json({error:"Serviço indisponível"},503);
 const db=createClient(url,anon,{global:{headers:{Authorization:header}},
  auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const identity=await db.auth.getUser(token);
  const uid=identity.data.user?.id;
  if(identity.error||!uid)return json({error:"Sessão inválida"},401);
  const grant=await db.from("app_admin_capabilities").select("auth_user_id")
   .eq("auth_user_id",uid).eq("capability","nucleo_manage")
   .eq("active",true).is("revoked_at",null).limit(2);
  if(grant.error||grant.data?.length!==1||grant.data[0].auth_user_id!==uid)
    return json({error:"Permissão de consulta não demonstrada"},403);
  const moduleResult=await db.from("nucleo_development_workstreams")
   .select("id,code,kind").eq("id",NUC_MODULE_ID).eq("code","NUC").eq("kind","modulo").limit(2);
  if(moduleResult.error||moduleResult.data?.length!==1)
    return json({error:"Módulo não verificável"},503);
  const [frontResult,contributionResult]=await Promise.all([
   db.from("nucleo_development_workstreams")
     .select("id,code,kind,parent_id,title,status,next_action,evidence_state")
     .in("code",[...FRONT_CODES]).eq("parent_id",NUC_MODULE_ID).limit(7),
   db.from("nucleo_specialist_contributions")
     .select("id,module_id,specialist_role,contribution_kind,title,source_kind,source_locator,version_no,authority_state")
     .eq("id",PILOT_CONTRIBUTION_ID).eq("module_id",NUC_MODULE_ID).limit(2),
  ]);
  if(frontResult.error||contributionResult.error||!frontResult.data||!contributionResult.data||
     !validateFronts(frontResult.data as NucFront[])||contributionResult.data.length!==1||
     !validContribution(contributionResult.data[0] as NucContribution))
   return json({error:"Contexto incompleto ou protegido; sem pacote certificado"},503);
  const fronts=([...frontResult.data] as NucFront[]).sort((a,b)=>a.code.localeCompare(b.code));
  const counts=await Promise.all(fronts.map(row=>db.from("nucleo_development_evidence")
    .select("id",{count:"exact",head:true}).eq("workstream_id",row.id)));
  if(counts.some(r=>r.error||r.count===null||r.count===undefined))
   return json({error:"Provas M4 parciais ou sem permissão"},503);
  // Expor somente o recorte permitido e contagens, nunca evidência bruta ou
  // notas, snapshots, tokens, fonte privada, identidade de terceiros.
  return json({
   contract:"nucleo_ac02_context_nuc_v1",
   status:"consultivo_nao_homologado",
   module:{id:NUC_MODULE_ID,code:"NUC"},
   specialist:{role:"Especialista Núcleo 2.0",specialty:"Governança e Continuidade do Núcleo",
     specialty_state:"descricao_proposta",mandate:"nao_certificado",successor:"nao_certificado"},
   contribution:contributionResult.data[0],
   fronts:fronts.map((row,i)=>({
     code:row.code,title:row.title,status:row.status,evidence_state:row.evidence_state,
     next_action:row.next_action,evidence_count:counts[i].count,
   })),
   limitations:[
     "O registro AC-01 é proposta, não método homologado ou vigente.",
     "O endpoint não fornece sessões, mandatos, credenciais ou autorização sucessória.",
     "NUC-M0 a NUC-M5 são frentes existentes, não especialidades cadastradas.",
     "A leitura não prova recebimento/aceite por sucessor distinto.",
   ],
   checked_at:new Date().toISOString(),
  });
 }catch{return json({error:"Leitura indeterminada"},503);}
});
