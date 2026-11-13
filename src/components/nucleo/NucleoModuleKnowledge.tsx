import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CRM_DRAFTS, CCH_DRAFTS, SHOPEE_DRAFTS, OPERACOES_DRAFTS, FINANCEIRO_DRAFTS, CAPTURA_DRAFTS, ROTINA_DRAFTS } from "@/lib/nucleo/operationalDraftsV12";

type FMSection = "FM-01" | "FM-02" | "FM-03" | "FM-04" | "FM-05" | "FM-06" | "FM-07" | "FM-08" | "FM-09" | "FM-10";
const sections: Record<FMSection, string> = {
  "FM-01": "Identidade",
  "FM-02": "Visão rápida",
  "FM-03": "Fronteiras",
  "FM-04": "Mapa de telas",
  "FM-05": "Catálogo de ações",
  "FM-06": "Jornadas práticas",
  "FM-07": "Dados e evidências",
  "FM-08": "Governança do especialista",
  "FM-09": "Evolução",
  "FM-10": "Aprendizagem",
};
type Revision = {
 id:string; module_id:string; section_code:FMSection; version_no:number; title:string; body:string;
 source_reference:string; authority_state:"rascunho"|"proposta"|"homologado"|"historico";
 evidence_level:"declarado"|"codigo_verificado"|"uso_real_verificado"|"proposta"|"nao_verificado";
 reviewed_by:string; recorded_at:string; recorded_by_auth_uid:string|null;
};
type RevisionTable = {
 Row:Revision;
 Insert:Pick<Revision,"module_id"|"section_code"|"version_no"|"title"|"body"> & Partial<Revision>;
 Update:never;
 Relationships:[];
};
type FMDatabase = Omit<Database,"public"> & {public: Omit<Database["public"],"Tables"> & {
 Tables:Database["public"]["Tables"] & {nucleo_module_knowledge_revisions:RevisionTable}
}};
const client=supabase as unknown as SupabaseClient<FMDatabase>;

export default function NucleoModuleKnowledge({moduleId,moduleCode}:{moduleId:string;moduleCode:string}) {
  const [section,setSection]=useState<FMSection>("FM-01");
  const [revisions,setRevisions]=useState<Revision[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [reload,setReload]=useState(0);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [source,setSource]=useState("");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    let current=true;
    setRevisions([]);setLoading(true);setError(null);
    void client.from("nucleo_module_knowledge_revisions").select("*")
      .eq("module_id",moduleId).order("recorded_at",{ascending:false}).limit(300)
      .then(result=>{
        if(!current)return;
        if(result.error) setError("Ficha Viva indisponível: confirme migration e autorização no Core.");
        else setRevisions(result.data ?? []);
        setLoading(false);
      });
    return()=>{current=false};
  },[moduleId,reload]);

  useEffect(()=>{setTitle("");setBody("");setSource("");},[moduleId,section]);
  const history=useMemo(()=>revisions
    .filter(r=>r.section_code===section).sort((a,b)=>b.version_no-a.version_no),[revisions,section]);
  const latest=history[0];
  const templates = {
    CRM: CRM_DRAFTS, SAU: CCH_DRAFTS, SHO: SHOPEE_DRAFTS,
    OPE: OPERACOES_DRAFTS, FIN: FINANCEIRO_DRAFTS,
    CAP: CAPTURA_DRAFTS, ROT: ROTINA_DRAFTS,
  } as const;
  const referenceDraft = templates[moduleCode as keyof typeof templates]?.[section];
  const prepareReference = () => {
    if (!referenceDraft || loading || saving || error) return;
    // Ação local explícita: pré-preenche apenas o formulário.
    // Não cria revisão no Core nem infere homologação.
    if ((title || body || source) && !window.confirm(
      "Substituir o conteúdo ainda não salvo por um modelo de consulta? Nenhuma revisão será gravada automaticamente."
    )) return;
    setTitle(referenceDraft.title);
    setBody(referenceDraft.body);
    setSource(referenceDraft.source);
  };
  const save=async()=>{
    const cleanTitle=title.trim(), cleanBody=body.trim(), cleanSource=source.trim();
    if(loading||error||saving) return;
    if(cleanTitle.length<3||cleanTitle.length>180||cleanBody.length<10||cleanBody.length>12000||cleanSource.length>1500){
      setError("Verifique título (3–180), conteúdo (10–12.000) e referência (até 1.500 caracteres).");return;
    }
    setSaving(true);setError(null);
    // Concorrência de dois autores resolve por chave única; nunca sobrescreve histórico.
    const version=(latest?.version_no??0)+1;
    const result=await client.from("nucleo_module_knowledge_revisions").insert({
      module_id:moduleId,section_code:section,version_no:version,title:cleanTitle,body:cleanBody,
      source_reference:cleanSource,authority_state:"rascunho",evidence_level:"declarado",
    }).select("*").maybeSingle();
    if(result.error||!result.data) {
      setError("Não foi possível registrar a revisão. Se outra pessoa salvou uma versão, atualize e confira antes de tentar novamente.");
      setSaving(false);return;
    }
    // Readback separado: confirmar que a mesma revisão persiste no Core antes de afirmar sucesso.
    const check=await client.from("nucleo_module_knowledge_revisions").select("*").eq("id",result.data.id).maybeSingle();
    if(check.error||!check.data||check.data.body!==cleanBody||check.data.version_no!==version||
       check.data.authority_state!=="rascunho"){
      setError("Envio efetuado, mas a leitura da revisão não foi confirmada. Recarregue antes de criar outra.");
      setSaving(false);return;
    }
    setTitle("");setBody("");setSource("");setSaving(false);setReload(n=>n+1);
  };
  return (
    <Card className="p-3 md:p-4 space-y-3" aria-label="Ficha Viva do módulo">
      <div>
        <h4 className="text-sm font-semibold">Ficha Viva — seções FM-01 a FM-10</h4>
        <p className="text-xs text-muted-foreground">Histórico por versão. O formulário cria apenas rascunhos declarados, nunca manuais homologados automaticamente.</p>
      </div>
      <label className="block text-xs space-y-1">Seção
        <select className="block w-full rounded-md border bg-background p-2" value={section}
          onChange={e=>setSection(e.target.value as FMSection)}>
          {(Object.entries(sections) as Array<[FMSection,string]>).map(([key,label])=>
            <option key={key} value={key}>{key} — {label}</option>)}
        </select>
      </label>
      {loading&&<p role="status" className="text-xs text-muted-foreground">Consultando revisões autorizadas…</p>}
      {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
      <Button type="button" size="sm" variant="outline" disabled={loading||saving} onClick={()=>{setError(null);setReload(n=>n+1);}}>Atualizar ficha</Button>
      {!loading&&!error&&(
        <>
          {latest?<div className="border rounded-md p-3 text-sm space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <strong>{latest.title}</strong><Badge variant="secondary">v{latest.version_no}</Badge>
              <Badge variant="outline">{latest.authority_state}</Badge>
            </div>
            <p className="whitespace-pre-wrap break-words">{latest.body}</p>
            <p className="text-xs text-muted-foreground">Prova: {latest.evidence_level} · Registrada: {new Date(latest.recorded_at).toLocaleString("pt-BR")}</p>
            <p className="text-xs break-all">Fonte declarada: {latest.source_reference||"Não informada"}</p>
          </div>:<p className="text-sm text-muted-foreground">Esta seção não tem versões no Core. Isso não significa que o conhecimento não exista em outras fontes.</p>}
          {history.length>1&&<details className="border rounded-md p-3 text-xs">
            <summary className="cursor-pointer">Histórico preservado ({history.length-1} revisão(ões) anterior(es))</summary>
            <div className="space-y-3 mt-2">
              {history.slice(1).map(r=><div key={r.id} className="border-t pt-2">
                <p className="font-medium">v{r.version_no} · {r.title} · {r.authority_state}</p>
                <p className="whitespace-pre-wrap break-words mt-1">{r.body}</p>
                <p>Fonte: {r.source_reference||"Não informada"}</p>
              </div>)}
            </div>
          </details>}
          <div className="border-t pt-3 space-y-2">
            <h5 className="font-medium text-sm">Registrar nova revisão — rascunho não homologado</h5>
            {referenceDraft && (
              <div className="rounded-lg border border-sky-200 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20 p-3 space-y-2">
                <p className="text-sm font-semibold">Modelo de referência {moduleCode} — {section}</p>
                <p className="text-sm text-muted-foreground">
                  Proposta fundamentada em fontes de código/documento, para leitura e ajustes pelo responsável.
                  Não é homologação, teste de uso real ou confirmação da vigência do especialista.
                </p>
                <Button type="button" size="sm" variant="outline" disabled={saving}
                  onClick={prepareReference}>Preparar rascunho com fontes</Button>
              </div>
            )}
            <label className="block text-xs space-y-1">Título
              <Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={180} placeholder={sections[section]}/>
            </label>
            <label className="block text-xs space-y-1">Descrição operacional
              <Textarea value={body} onChange={e=>setBody(e.target.value)} rows={5} maxLength={12000} placeholder="Registre somente fatos e limites verificáveis. Não inclua dados pessoais ou credenciais."/>
            </label>
            <label className="block text-xs space-y-1">Fonte / documento original (referência, não cópia)
              <Input value={source} onChange={e=>setSource(e.target.value)} maxLength={1500} placeholder="Caminho, ID de documento ou link original"/>
            </label>
            <p className="text-xs text-muted-foreground">A nova revisão recebe v{(latest?.version_no??0)+1}; a versão anterior permanece imutável. A aprovação normativa requer procedimento humano separado.</p>
            <Button type="button" size="sm" disabled={saving||loading} onClick={()=>void save()}>
              {saving?"Registrando…":"Registrar revisão e conferir"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
