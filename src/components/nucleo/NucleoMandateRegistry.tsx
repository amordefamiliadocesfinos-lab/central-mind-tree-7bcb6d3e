import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { DevelopmentWorkstream } from "@/lib/nucleo/development.types";

type MandateRecord = {
  id: string; module_id: string; record_kind: "proposta"|"certificacao"|"revogacao";
  specialist_role: string; method_name: string; method_version: string;
  authority_source_url: string; authority_decision_ref: string;
  effective_from: string|null; effective_until: string|null;
  recorded_at: string;
};
type MandateDatabase = Omit<Database,"public"> & { public: Omit<Database["public"],"Tables"> & {
  Tables: Database["public"]["Tables"] & {
    nucleo_specialist_mandate_records: {
      Row: MandateRecord; Insert: never; Update: never; Relationships: [];
    };
  };
}};
const client=supabase as unknown as SupabaseClient<MandateDatabase>;
const MAX_RECORDS=500;

/**
 * Catálogo de decisões: nenhum texto M3 confirma mandato automaticamente.
 * Somente o último evento de certificação, com data ativa e sem revogação
 * posterior, habilita a indicação de certificado. É sempre leitura, sob RLS.
 */
export default function NucleoMandateRegistry({modules}:{modules:DevelopmentWorkstream[]}) {
  const [rows,setRows]=useState<MandateRecord[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(false);
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    let current=true;
    setRows([]);setLoading(true);setError(false);
    void client.from("nucleo_specialist_mandate_records")
      .select("id,module_id,record_kind,specialist_role,method_name,method_version,authority_source_url,authority_decision_ref,effective_from,effective_until,recorded_at")
      .order("recorded_at",{ascending:false}).limit(MAX_RECORDS).then(result=>{
        if(!current)return;
        if(result.error||!result.data||result.data.length>=MAX_RECORDS){
          setError(true);setRows([]);
        } else setRows(result.data);
        setLoading(false);
      }).catch(()=>{if(current){setError(true);setRows([]);setLoading(false)}});
    return()=>{current=false};
  },[version]);

  const entries=useMemo(()=>modules.map(module=>{
    const records=rows.filter(record=>record.module_id===module.id);
    const decisions=records.filter(record=>record.record_kind!=="proposta");
    const newest=decisions[0];
    const effective=newest?.record_kind==="certificacao"&&
      newest.effective_from!==null&&
      new Date(newest.effective_from).getTime()<=Date.now()&&
      (newest.effective_until===null||new Date(newest.effective_until).getTime()>Date.now());
    return {module,records,decision:effective?newest:null,
      state:effective?"certificado":newest?.record_kind==="revogacao"?"revogado":"não certificado"};
  }),[rows,modules]);

  return (
    <section className="rounded-lg border p-3 md:p-4 space-y-3" aria-label="Mandatos de especialistas no Core">
      <div className="flex flex-wrap justify-between gap-2 items-start">
        <div>
          <h4 className="text-sm font-semibold">Mandatos — decisões formais registradas</h4>
          <p className="text-sm text-muted-foreground mt-1">
            Certificação exige decisão separada, fonte, identidade e vigência. Proposta ou nome textual não certifica.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading}
          onClick={()=>setVersion(v=>v+1)}>Reconsultar</Button>
      </div>
      {loading&&<p className="text-sm text-muted-foreground" role="status">Consultando mandatos autorizados…</p>}
      {error&&<p className="text-sm text-destructive" role="alert">
        Não foi possível comprovar o conjunto integral de mandatos sob as permissões atuais. Estado indeterminado.
      </p>}
      {!loading&&!error&&(
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map(({module,records,decision,state})=>(
            <article key={module.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm font-semibold">{module.code} — {module.title}</p>
                <Badge variant="outline">{state}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{records.length} registro(s) de mandato na consulta</p>
              {decision?(
                <div className="space-y-1 text-sm">
                  <p>Função: {decision.specialist_role}</p>
                  <p>Método: {decision.method_name} · {decision.method_version}</p>
                  <p className="text-xs text-muted-foreground">Decisão: {decision.authority_decision_ref}</p>
                  <a className="underline underline-offset-2" href={decision.authority_source_url}
                    target="_blank" rel="noopener noreferrer">Conferir documento de autoridade</a>
                </div>
              ):(
                <p className="text-sm text-muted-foreground">
                  {state==="revogado" ? "Última decisão formal: revogação. Sem certificação ativa." :
                    "Nenhuma certificação vigente registrada neste contrato. Mandato do especialista continua pendente."}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Consulta somente leitura sob RLS. Nenhum mandato é aprovado, revogado ou atribuído automaticamente.
        Dados de decisão precisam corresponder às fontes e à autoridade competente.
      </p>
    </section>
  );
}
