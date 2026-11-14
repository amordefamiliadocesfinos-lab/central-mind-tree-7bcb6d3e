import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { isRequestedModuleCode, reviewImpact, validPrNumber, type PrImpact } from "../_shared/nucleo/knowledge-contract.ts";

/**
 * Núcleo A+ CA16 + CA18 — endpoint SOMENTE LEITURA.
 * verify_jwt=true + getUser + grant explícito nucleo_manage + RLS.
 * Usa ANON KEY e JWT do chamador, NUNCA service role.
 * Não autoriza ações por IA, não fornece dados operacionais ou executa mutações.
 */
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{...corsHeaders,"Content-Type":"application/json","Cache-Control":"no-store"},
});
const REPO="amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e";
const MAX_M3=500, MAX_FM=300, MAX_EVIDENCE=300, MAX_PR=8;
type Row=Record<string,unknown>;
type PRRecord={id:string;kind:string;source:string;repository:string|null;external_key:string;observed_state:string;workstream_id:string};
const githubHeaders=()=>{
  const headers:Record<string,string>={
    Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",
    "User-Agent":"PainelCentral-Nucleo-Aplus-readonly",
  };
  // Opcional para repositório privado; sem token, falhar indeterminado.
  const key=Deno.env.get("NUCLEO_GITHUB_READ_TOKEN");
  if(key)headers.Authorization="Bearer "+key;
  return headers;
};
async function fetchPR(pr:PRRecord):Promise<{record:PrImpact|null;complete:boolean}>{
  const number=validPrNumber(pr.external_key);
  if(!number||pr.source!=="github"||pr.kind!=="pull_request"||
     pr.observed_state!=="verificado"||pr.repository!==REPO){
    return {record:null,complete:false};
  }
  const url=`https://api.github.com/repos/${REPO}/pulls/${number}`;
  const options={headers:githubHeaders(),signal:AbortSignal.timeout(7000)};
  try{
    const result=await fetch(url,options);
    if(!result.ok)return {record:null,complete:false};
    const pull=await result.json() as {merged_at?:unknown;number?:unknown};
    if(pull.number!==number||typeof pull.merged_at!=="string")return {record:null,complete:false};
    const filesResponse=await fetch(url+"/files?per_page=100&page=1",options);
    if(!filesResponse.ok)return {record:null,complete:false};
    const files=await filesResponse.json() as Array<{filename?:unknown}>;
    if(!Array.isArray(files)||files.length>=100)return {record:null,complete:false};
    if(files.some(file=>typeof file.filename!=="string"))return {record:null,complete:false};
    return {record:{
      evidence_id:pr.id,number,merged_at:pull.merged_at,
      files:files.map(file=>file.filename as string),
    },complete:true};
  }catch{
    return {record:null,complete:false};
  }
}
Deno.serve(async request=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(request.method!=="POST")return json({error:"Método não permitido"},405);
  const authHeader=request.headers.get("Authorization");
  if(!authHeader?.startsWith("Bearer "))return json({error:"Autenticação obrigatória"},401);
  const token=authHeader.slice(7);
  if(!token||token.length>8192)return json({error:"Credencial inválida"},401);
  let input:unknown;
  try{
    const raw=await request.text();
    if(raw.length>1024)return json({error:"Requisição excede o limite"},413);
    input=JSON.parse(raw);
  }catch{return json({error:"JSON inválido"},400);}
  if(!input||typeof input!=="object"||Array.isArray(input))return json({error:"Corpo inválido"},400);
  const body=input as Record<string,unknown>;
  if(!isRequestedModuleCode(body.module_code)||Object.keys(body).some(k=>!["module_code","include_review"].includes(k))||
    (body.include_review!==undefined&&typeof body.include_review!=="boolean")){
    return json({error:"Informe module_code de três letras; include_review opcional"},400);
  }
  const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY");
  if(!url||!anon)return json({error:"Serviço de autenticação não configurado"},503);
  const db=createClient(url,anon,{
    global:{headers:{Authorization:authHeader}},
    auth:{persistSession:false,autoRefreshToken:false},
  });
  try{
    const identity=await db.auth.getUser(token);
    const uid=identity.data.user?.id;
    if(identity.error||!uid)return json({error:"Sessão inválida"},401);
    const grant=await db.from("app_admin_capabilities").select("auth_user_id")
      .eq("auth_user_id",uid).eq("capability","nucleo_manage")
      .eq("active",true).is("revoked_at",null).limit(2);
    if(grant.error||grant.data?.length!==1||grant.data[0].auth_user_id!==uid){
      return json({error:"Sem concessão ativa nucleo_manage"},403);
    }
    const moduleResult=await db.from("nucleo_development_workstreams")
      .select("id,code,title,description,kind,status,next_action")
      .eq("code",body.module_code).eq("kind","modulo").limit(2);
    if(moduleResult.error||moduleResult.data?.length!==1)return json({error:"Módulo indisponível ou leitura indeterminada"},404);
    const module=moduleResult.data[0];
    if(module.code==="NUC")return json({error:"Utilize módulo operacional externo"},400);
    const [fmResult,m3Result]=await Promise.all([
      db.from("nucleo_module_knowledge_revisions").select("id,module_id,section_code,version_no,title,body,source_reference,authority_state,evidence_level,recorded_at")
        .eq("module_id",module.id).order("recorded_at",{ascending:false}).limit(MAX_FM),
      db.from("nucleo_development_workstreams").select("id,code,title,kind,parent_id,status,next_action")
        .limit(MAX_M3),
    ]);
    if(fmResult.error||m3Result.error||!fmResult.data||!m3Result.data||
      fmResult.data.length>=MAX_FM||m3Result.data.length>=MAX_M3)return json({error:"Consulta incompleta ou negada sob RLS"},503);
    const byId=new Map(m3Result.data.map(item=>[item.id,item]));
    function belongs(id:string):boolean{
      let current=byId.get(id);const seen=new Set<string>();
      while(current&&current.kind!=="modulo"){
        if(!current.parent_id||seen.has(current.id))return false;
        seen.add(current.id);current=byId.get(current.parent_id);
      }
      return current?.id===module.id;
    }
    const fronts=m3Result.data.filter(row=>row.kind!=="modulo"&&belongs(row.id));
    const frontIds=fronts.map(f=>f.id);
    const latest=new Map<string,(typeof fmResult.data)[number]>();
    for(const item of fmResult.data){
      const previous=latest.get(item.section_code);
      if(!previous||previous.version_no<item.version_no)latest.set(item.section_code,item);
    }
    const sections=["FM-01","FM-02","FM-03","FM-04","FM-05","FM-06","FM-07","FM-08","FM-09","FM-10"]
      .map(section_code=>({section_code,state:latest.has(section_code)?"registro_core":"sem_registro",
        revision:latest.get(section_code)??null}));
    let review:Record<string,unknown>={state:"nao_solicitada",suggestions:[]};
    let evidenceCount:number|null=null;
    if(body.include_review===true){
      if(frontIds.length===0){
        evidenceCount=0;review={state:"sem_frente_m3",suggestions:[],message:"Sem frente vinculada para busca de provas M4."};
      }else{
        const records=await db.from("nucleo_development_evidence")
          .select("id,kind,source,repository,external_key,observed_state,workstream_id")
          .in("workstream_id",frontIds).limit(MAX_EVIDENCE);
        if(records.error||!records.data||records.data.length>=MAX_EVIDENCE)return json({error:"Consulta M4 negada ou parcial"},503);
        evidenceCount=records.data.length;
        const prs=records.data.filter(e=>e.kind==="pull_request"&&e.observed_state==="verificado") as PRRecord[];
        if(prs.length>MAX_PR){
          review={state:"indeterminado",suggestions:[],message:"PRs excedem o limite de inspeção; não afirmar ausência de revisão."};
        }else{
          const results=await Promise.all(prs.map(fetchPR));
          const complete=results.every(r=>r.complete);
          const refs=results.flatMap(r=>r.record?[r.record]:[]);
          const assessment=reviewImpact([...latest.values()],refs,complete);
          review={
            ...assessment,
            observed_pr_count:prs.length,inspected_pr_count:refs.length,
            checked_at:new Date().toISOString(),
            meaning:"Coincidência de arquivo-fonte com merge posterior é sugestão, nunca prova de alteração semântica.",
          };
        }
      }
    }
    // Resposta sem métodos de escrita e sem dados pessoais de outras tabelas.
    return json({
      contract:"nucleo_a_plus_ca16_ca18_v1",
      module:{id:module.id,code:module.code,title:module.title,description:module.description},
      sections,fronts:fronts.map(f=>({code:f.code,title:f.title,status:"declarado:"+f.status,next_action:f.next_action})),
      technical_evidence_count:evidenceCount,review,
      restrictions:["consulta sob JWT e RLS","não executa comandos","não certifica método","não comprova homologação ou deploy"],
      read_at:new Date().toISOString(),
    });
  }catch{
    return json({error:"Não foi possível confirmar leitura autorizada; nenhuma conclusão produzida"},503);
  }
});
