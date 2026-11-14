import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DevelopmentWorkstream } from "@/lib/nucleo/development.types";
import { MODULE_PROVENANCE, SOURCE_AUTHORITY_LABELS } from "@/lib/nucleo/operationalProvenanceV12";
import { CRM_CONTINUITY_CHECKPOINTS_V12, CRM_SPECIALIST_CA17 } from "@/lib/nucleo/crmAuthoritySourcesV12";

type ProposalRow = {
  id:string; module_id:string; record_kind:string; specialist_role:string;
  specialist_auth_uid:string|null; method_name:string; method_version:string;
  authority_source_url:string; authority_decision_ref:string; decision_note:string;
  recorded_at:string;
};
type ProposalInsert = {
  module_id:string; record_kind:"proposta"; specialist_role:string;
  method_name:string; method_version:string; authority_source_url:string;
  decision_note:string;
};
type MandateDatabase = Omit<Database,"public"> & {
  public: Omit<Database["public"],"Tables"> & {
    Tables: Database["public"]["Tables"] & {
      nucleo_specialist_mandate_records: {
        Row: ProposalRow; Insert:ProposalInsert; Update:never; Relationships:[];
      };
    };
  };
};
const client=supabase as unknown as SupabaseClient<MandateDatabase>;
const REPO="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e";

export default function NucleoMandateProposal({modules,onCreated}:{
  modules:DevelopmentWorkstream[];onCreated:()=>void;
}) {
  const [moduleId,setModuleId]=useState("");
  const [role,setRole]=useState("");
  const [method,setMethod]=useState("");
  const [version,setVersion]=useState("");
  const [source,setSource]=useState("");
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const sorted=useMemo(()=>[...modules].sort((a,b)=>a.code.localeCompare(b.code,"pt-BR")),[modules]);
  const selected=sorted.find(m=>m.id===moduleId);
  const provenance=selected?MODULE_PROVENANCE[selected.code]:undefined;
  useEffect(()=>{
    setRole("");setMethod("");setVersion("");setSource("");setNote("");
    setError("");setSuccess("");
  },[moduleId]);

  const save=async()=>{
    if(busy)return;
    setError("");setSuccess("");
    const cleanRole=role.trim(),cleanMethod=method.trim(),cleanVersion=version.trim();
    const cleanSource=source.trim(),cleanNote=note.trim();
    if(!selected||cleanRole.length<3||cleanRole.length>180||
      cleanMethod.length>180||cleanVersion.length>100||
      cleanSource.length>1500||cleanNote.length>2000||
      (cleanSource.length>0&&!cleanSource.startsWith("https://"))){
      setError("Selecione o módulo e confira função (3–180 caracteres), método (até 180), versão (até 100), URL HTTPS e observações (até 2.000).");
      return;
    }
    if(!window.confirm(
      "Registrar uma PROPOSTA não certificada e imutável no Core? Nenhuma autorização ou vigência será concedida."
    ))return;
    setBusy(true);
    try{
      const write=await client.from("nucleo_specialist_mandate_records")
        .insert({
          module_id:selected.id,record_kind:"proposta",specialist_role:cleanRole,
          method_name:cleanMethod,method_version:cleanVersion,
          authority_source_url:cleanSource,decision_note:cleanNote,
        }).select("id,module_id,record_kind,specialist_role,method_name,method_version,authority_source_url,authority_decision_ref,decision_note,recorded_at").maybeSingle();
      if(write.error||!write.data){
        setError("Não foi possível registrar a proposta. Confirme sua sessão, o grant nucleo_manage e a migration.");
        return;
      }
      const id=write.data.id;
      const check=await client.from("nucleo_specialist_mandate_records")
        .select("id,module_id,record_kind,specialist_role,method_name,method_version,authority_source_url,authority_decision_ref,decision_note,recorded_at")
        .eq("id",id).maybeSingle();
      if(check.error||!check.data||check.data.module_id!==selected.id||
        check.data.record_kind!=="proposta"||check.data.specialist_role!==cleanRole||
        check.data.method_name!==cleanMethod||check.data.method_version!==cleanVersion||
        check.data.authority_source_url!==cleanSource){
        setError("A escrita pode ter ocorrido, mas o readback não foi confirmado. Reconsulte antes de tentar outra vez.");
        return;
      }
      setSuccess("Proposta registrada e conferida. Mandato NÃO certificado; requer fonte e decisão formal independente.");
      setRole("");setMethod("");setVersion("");setSource("");setNote("");
      onCreated();
    }catch{
      setError("Operação não confirmada. Reconsulte os registros antes de tentar novamente.");
    }finally{
      setBusy(false);
    }
  };
  return <section className="rounded-lg border p-3 md:p-4 space-y-3" aria-label="Reconciliação de especialista">
    <div>
      <h4 className="text-sm font-semibold">Registrar proposta para reconciliação do especialista</h4>
      <p className="text-sm text-muted-foreground">
        Somente uma proposta auditável: sem titular certificado, decisão formal ou vigência.
        Não preencha identidades que não estejam comprovadas.
      </p>
    </div>
    <label className="block text-sm space-y-1">Módulo
      <select className="block w-full rounded-md border bg-background p-2" value={moduleId}
        onChange={e=>setModuleId(e.target.value)} disabled={busy}>
        <option value="">Selecione um módulo cadastrado</option>
        {sorted.map(m=><option key={m.id} value={m.id}>{m.code} — {m.title}</option>)}
      </select>
    </label>
    {selected&&<div className="border rounded-md p-3 space-y-2">
      <p className="text-sm font-semibold">Conferência de fontes: {selected.code}</p>
      <p className="text-sm text-muted-foreground">{provenance?.ownerBoundary??"Mandato não verificado; localizar fonte de autoridade."}</p>
      {provenance?.sources.map(s=><div key={s.path} className="text-sm">
        <a href={s.path} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{s.label}</a>
        <span className="text-xs text-muted-foreground"> · {SOURCE_AUTHORITY_LABELS[s.authority]}</span>
        <button type="button" className="ml-2 text-xs underline" disabled={busy}
          onClick={()=>setSource(s.path)}>Usar referência</button>
      </div>)}
      {selected.code==="CRM"&&(
        <div className="rounded border p-3 space-y-2" aria-label="Dossiê para decisão de mandato CRM">
          <p className="text-sm font-semibold">CA-17 — elementos para decisão formal da Camada Mestre</p>
          <p className="text-xs text-muted-foreground">
            O repasse CRM 7 → CRM 8 é um checkpoint preparado, não uma certificação.
            O Estado CRM V1.2 também está preparado e não vigente. O Núcleo não decide
            quem é o especialista atual nem publica uma versão por inferência.
          </p>
          <p className="text-xs font-medium">Referência funcional: {CRM_SPECIALIST_CA17.functionalRole}</p>
          <p className="text-xs">Sucessão documental: {CRM_SPECIALIST_CA17.successionRecord}</p>
          <p className="text-xs">Mandato: {CRM_SPECIALIST_CA17.activeMandate}</p>
          <div className="space-y-1 text-xs">
            {CRM_CONTINUITY_CHECKPOINTS_V12.map(entry=>(
              <p key={entry.id}><strong>{entry.date} · {entry.title}:</strong> {entry.state}</p>
            ))}
          </div>
          <p className="text-xs font-medium">Decisão ainda necessária:</p>
          <p className="text-xs text-muted-foreground">
            Confirmar, por fonte formal da Camada Mestre: titular autorizado,
            método e versão aplicáveis, data de vigência, substituição do mandato anterior,
            fonte de decisão e condições de revogação. Se não comprovado, manter
            não certificado. Registrar proposta abaixo não concede mandato.
          </p>
          <Button type="button" size="sm" variant="outline" disabled={busy}
            onClick={()=>{
              setRole(CRM_SPECIALIST_CA17.functionalRole);
              setMethod("");
              setVersion("");
              setSource(REPO+"/blob/main/docs/architecture/NUCLEO_V12_A_PLUS_CRM_CA13_CA17_SUCESSAO_2026-11-14.md");
              setNote("Proposta para reconciliação, SEM mandato: repasse CRM 7 → CRM 8 de 04/11 preparado/não publicado; Estado CRM V1.2 não vigente. Confirmar titular, método, versão e decisão com Camada Mestre antes de certificação.");
              setError("");setSuccess("");
            }}>Preparar proposta CRM sem certificação</Button>
          <p className="text-xs text-muted-foreground">
            O botão preenche somente campos locais do formulário; a gravação, se desejada,
            exige confirmação humana separada e registra exclusivamente uma proposta.
          </p>
        </div>
      )}
      <a href={REPO} target="_blank" rel="noopener noreferrer" className="text-xs underline">Consultar repositório oficial</a>
    </div>}
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm space-y-1">Papel proposto (não é uma identidade)
        <Input value={role} onChange={e=>setRole(e.target.value)} disabled={busy}
          maxLength={180} placeholder="Especialista responsável pela frente" />
      </label>
      <label className="text-sm space-y-1">Método a reconciliar
        <Input value={method} onChange={e=>setMethod(e.target.value)} disabled={busy}
          maxLength={180} placeholder="Nome conforme a fonte" />
      </label>
      <label className="text-sm space-y-1">Versão a conferir
        <Input value={version} onChange={e=>setVersion(e.target.value)} disabled={busy}
          maxLength={100} placeholder="Ex.: v5.4, se documentada" />
      </label>
      <label className="text-sm space-y-1">URL de autoridade (fonte, ainda não decisão)
        <Input value={source} onChange={e=>setSource(e.target.value)} disabled={busy}
          maxLength={1500} placeholder="https://..." />
      </label>
    </div>
    <label className="block text-sm space-y-1">Lacunas e contexto da proposta
      <Textarea value={note} onChange={e=>setNote(e.target.value)} disabled={busy}
        maxLength={2000} rows={3} placeholder="Qual titular, mandato, decisão ou prova ainda falta confirmar?" />
    </label>
    <p className="text-xs text-muted-foreground">
      Identidade autenticada, referência da decisão, datas de vigência e certificação não são atribuídas neste formulário.
      O registro é imutável e preservado mesmo se a proposta for substituída futuramente.
    </p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {success&&<p role="status" className="text-sm text-muted-foreground">{success}</p>}
    <Button size="sm" type="button" onClick={save} disabled={busy||!selected}>
      {busy?"Registrando…":"Registrar proposta e conferir"}
    </Button>
  </section>;
}
