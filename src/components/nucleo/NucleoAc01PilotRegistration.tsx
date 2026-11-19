import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import {
  NUC_MODULE_ID,PILOT_ROLE,PILOT_SOURCE,PILOT_TITLE,
  matchesPilotRecord,type PilotRecord,type PilotRequest,
} from "../../../supabase/functions/_shared/nucleo/ac01-agent-pilot-contract";

/**
 * Piloto F3: botão explícito na governança NUC. Não é um segundo writer:
 * usa o JWT da sessão Supabase Auth no supabase.functions.invoke,
 * que aciona o único gateway AC-01, sob RLS e trigger existentes.
 */
type ACDB=Omit<Database,"public">&{public:Omit<Database["public"],"Tables">&{
  Tables:Database["public"]["Tables"]&{nucleo_specialist_contributions:{
    Row:PilotRecord;Insert:Partial<PilotRecord>;Update:never;Relationships:[];
  }};
}};
const db=supabase as unknown as SupabaseClient<ACDB>;
const FUNCTION_NAME = "nucleo-ac01-agent-proposal";
const STORAGE_PREFIX = "nucleo-ac01-pilot-v11:";
const GITHUB_SOURCE =
  "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/main/" + PILOT_SOURCE;
type Status = "checking"|"ready"|"missing_grant"|"signed_out"|"uncertain"|"done"|"unavailable";
type StoredAttempt = PilotRequest;
const matchesSource=(r:PilotRecord)=>r.module_id===NUC_MODULE_ID &&
  r.specialist_role===PILOT_ROLE && r.contribution_kind==="mapa" &&
  r.source_kind==="github" && r.source_locator===PILOT_SOURCE;
const isAttempt=(value:unknown):value is StoredAttempt=>{
  if(!value||typeof value!=="object")return false;
  const item=value as Partial<StoredAttempt>;
  return item.module_id===NUC_MODULE_ID &&
    typeof item.request_id==="string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.request_id);
};
export default function NucleoAc01PilotRegistration(){
  const [status,setStatus]=useState<Status>("checking");
  const [message,setMessage]=useState("Conferindo sessão e origem AC-01…");
  const [record,setRecord]=useState<PilotRecord|null>(null);
  const [busy,setBusy]=useState(false);
  const [requestId,setRequestId]=useState<string|null>(null);
  const userId=useRef<string|null>(null);
  const storageKey=useRef<string|null>(null);
  const busyRef=useRef(false);

  const reconcile=useCallback(async()=>{
    if(busyRef.current)return;
    setStatus("checking");setMessage("Conferindo sessão, autorização e registro no Core…");
    try{
      const auth=await supabase.auth.getUser();
      if(auth.error||!auth.data.user){
        userId.current=null;storageKey.current=null;
        setStatus("signed_out");setMessage("Entre na sua conta do Painel Central para registrar a proposta.");return;
      }
      const uid=auth.data.user.id;
      userId.current=uid;
      const grant=await db.from("app_admin_capabilities").select("auth_user_id")
        .eq("auth_user_id",uid).eq("capability","nucleo_manage")
        .eq("active",true).is("revoked_at",null).limit(2);
      if(grant.error||grant.data?.length!==1){
        setStatus("missing_grant");setMessage("A concessão nucleo_manage desta sessão não foi comprovada. Nenhuma escrita será enviada.");return;
      }
      const key=STORAGE_PREFIX+uid;
      storageKey.current=key;
      let attempt:StoredAttempt|null=null;
      try {
        const raw=window.localStorage.getItem(key);
        if(raw){
          const saved:unknown=JSON.parse(raw);
          if(!isAttempt(saved)){
            setStatus("uncertain");setMessage("Existe uma tentativa local com dados inválidos. Não repetir sem reconciliação.");return;
          }
          attempt=saved;
        }
      }catch{
        setStatus("unavailable");setMessage("A proteção local da tentativa não está disponível. Registro suspenso.");return;
      }
      setRequestId(attempt?.request_id??null);
      const result=await db.from("nucleo_specialist_contributions")
        .select("*").eq("module_id",NUC_MODULE_ID)
        .eq("contribution_kind","mapa").eq("source_kind","github")
        .eq("source_locator",PILOT_SOURCE).limit(3);
      if(result.error||!result.data||result.data.length>=3){
        setStatus("unavailable");setMessage("Leitura AC-01 incompleta ou negada: não registrar novamente.");return;
      }
      const candidate=(result.data as PilotRecord[]).filter(matchesSource);
      if(candidate.length){
        const own=attempt && candidate.find(item=>
          matchesPilotRecord(item,{module_id:NUC_MODULE_ID,request_id:attempt!.request_id},uid));
        if(own && storageKey.current){
          try{window.localStorage.removeItem(storageKey.current)}catch{ /* registro confirmado; limpeza local indisponível */ }
          setRequestId(null);
        }
        setRecord(candidate[0]);setStatus("done");
        setMessage(candidate.length===1
          ? "A referência já existe no Core; não gerar outra contribuição."
          : "Foram localizadas referências equivalentes; não criar mais registros.");
        return;
      }
      if(attempt){
        const byId=await db.from("nucleo_specialist_contributions")
          .select("*").eq("module_id",NUC_MODULE_ID)
          .eq("request_id",attempt.request_id).limit(2);
        if(byId.error||!byId.data||byId.data.length!==1){
          setStatus("uncertain");setMessage("Tentativa anterior sem confirmação conclusiva. Preserve o request_id; não reenviar automaticamente.");return;
        }
        const match=matchesPilotRecord(byId.data[0] as PilotRecord,attempt,uid);
        if(!match){
          setStatus("uncertain");setMessage("Request ID localizado com dados divergentes. Registro suspenso.");return;
        }
        setRecord(byId.data[0] as PilotRecord);setStatus("done");
        setMessage("Registro anterior confirmado por readback com autoria correta.");
        try{window.localStorage.removeItem(key)}catch{/* sem reenvio */}
        setRequestId(null);
        return;
      }
      setRecord(null);setStatus("ready");
      setMessage("Sessão autorizada e referência ausente neste recorte. Pode registrar uma única proposta.");
    }catch{
      setStatus("unavailable");setMessage("Não foi possível conferir as condições de segurança do registro.");
    }
  },[]);

  useEffect(()=>{void reconcile();},[reconcile]);
  const submit=async()=>{
    if(busyRef.current||status!=="ready"||!userId.current||!storageKey.current)return;
    if(!window.confirm("Registrar UMA proposta AC-01 do Mapa Núcleo V1.1? Não homologa nem publica o mapa."))return;
    busyRef.current=true;setBusy(true);setStatus("checking");
    let persisted=false;
    try{
      // Revalidar sessão e permissões imediatamente antes da operação.
      const auth=await supabase.auth.getUser();
      if(auth.error||auth.data.user?.id!==userId.current){
        setStatus("signed_out");setMessage("Sessão alterada ou expirada. Nenhuma gravação foi enviada.");return;
      }
      const uid=userId.current;
      const grant=await db.from("app_admin_capabilities").select("auth_user_id")
        .eq("auth_user_id",uid).eq("capability","nucleo_manage")
        .eq("active",true).is("revoked_at",null).limit(2);
      if(grant.error||grant.data?.length!==1){
        setStatus("missing_grant");setMessage("Concessão não confirmada. Nenhuma escrita foi enviada.");return;
      }
      const existing=await db.from("nucleo_specialist_contributions")
        .select("id").eq("module_id",NUC_MODULE_ID)
        .eq("specialist_role",PILOT_ROLE).eq("contribution_kind","mapa")
        .eq("source_kind","github").eq("source_locator",PILOT_SOURCE).limit(2);
      if(existing.error||!existing.data||existing.data.length){
        setStatus("unavailable");setMessage("Pré-consulta inconclusiva ou referência já existente. Reconsultar, sem gravar.");return;
      }
      // Fixa request_id no navegador antes do envio. Falha de persistência => nenhuma escrita.
      const request_id=crypto.randomUUID();
      const attempt:StoredAttempt={module_id:NUC_MODULE_ID,request_id};
      window.localStorage.setItem(storageKey.current,JSON.stringify(attempt));
      persisted=true;setRequestId(request_id);
      // supabase-js utiliza a sessão Auth do próprio Painel para Authorization.
      const response=await supabase.functions.invoke(FUNCTION_NAME,{body:attempt});
      if(response.error||!response.data?.record){
        setStatus("uncertain");setMessage("Resposta não conclusiva da função; não repetir. Use Reconciliar com o Core.");return;
      }
      const check=await db.from("nucleo_specialist_contributions")
        .select("*").eq("module_id",NUC_MODULE_ID)
        .eq("request_id",request_id).limit(2);
      if(check.error||!check.data||check.data.length!==1||
        !matchesPilotRecord(check.data[0] as PilotRecord,attempt,uid)){
        setStatus("uncertain");setMessage("A função respondeu, mas o Core não confirmou todos os campos. Não repetir.");return;
      }
      setRecord(check.data[0] as PilotRecord);setStatus("done");
      setMessage("Proposta AC-01 registrada e confirmada por leitura independente no Core.");
      try{window.localStorage.removeItem(storageKey.current)}catch{/* confirmado, UI continua concluída */}
      setRequestId(null);
    }catch{
      setStatus(persisted?"uncertain":"unavailable");
      setMessage(persisted
        ?"Envio com resultado indeterminado. Preserve o request_id e reconcilie antes de agir."
        :"Não foi possível proteger a tentativa local. Nenhuma gravação enviada.");
    }finally{busyRef.current=false;setBusy(false);}
  };
  return <section className="rounded-xl border p-3 space-y-3" aria-label="Piloto de registro do Mapa V1.1 no AC-01">
    <div className="space-y-1">
      <p className="text-sm font-semibold">Governança documental — registro do Mapa V1.1</p>
      <p className="text-xs text-muted-foreground">Somente proposta por referência. O registro não homologa, não altera o método vigente e não cria especialista ou módulo.</p>
      <a href={GITHUB_SOURCE} target="_blank" rel="noopener noreferrer" className="text-xs underline underline-offset-2">Consultar mapa original no GitHub</a>
    </div>
    <p role={status==="uncertain"||status==="unavailable"?"alert":"status"} className="text-sm">{message}</p>
    {record&&<div className="rounded-md border p-2 text-xs space-y-1">
      <p>ID: <span className="font-mono break-all">{record.id}</span></p>
      <p>Estado: {record.authority_state} · v{record.version_no}</p>
      <p>Origem: GitHub · autoria registrada no Core (UID final {record.recorded_by_auth_uid.slice(-8)})</p>
    </div>}
    {requestId&&status!=="done"&&<p className="text-xs text-muted-foreground break-all">Identificador de reconciliação: {requestId}</p>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={status!=="ready"||busy} onClick={()=>void submit()}>
        {busy?"Registrando e conferindo…":"Registrar proposta do Mapa V1.1"}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void reconcile()}>
        Reconciliar com o Core
      </Button>
    </div>
  </section>;
}
