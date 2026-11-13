import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BookOpenCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { DevelopmentWorkstream } from "@/lib/nucleo/development.types";

type FMRow = {module_id:string;section_code:string};
type FMDatabase = Omit<Database,"public"> & { public: Omit<Database["public"],"Tables"> & {
  Tables: Database["public"]["Tables"] & {
    nucleo_module_knowledge_revisions: {
      Row:FMRow; Insert:never; Update:never; Relationships:[];
    };
  };
}};
const client = supabase as unknown as SupabaseClient<FMDatabase>;
const SECTIONS = ["FM-01","FM-02","FM-03","FM-04","FM-05","FM-06","FM-07","FM-08","FM-09","FM-10"] as const;
const MAX_ROWS = 500;

/**
 * Apenas cobertura de registros FM no Core. Não mede homologação nem a
 * existência de documentação externa. Pai M5 só monta após readback RLS válido.
 */
export default function NucleoKnowledgeCoverage({modules}:{modules:DevelopmentWorkstream[]}) {
  const [rows,setRows] = useState<FMRow[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(false);
  const [reload,setReload] = useState(0);
  useEffect(()=>{
    let current=true;
    setLoading(true);setError(false);setRows([]);
    void client.from("nucleo_module_knowledge_revisions")
      .select("module_id,section_code").limit(MAX_ROWS).then(result=>{
        if(!current)return;
        if(result.error||!result.data||result.data.length>=MAX_ROWS){
          // Falha segura: não atribuir zero cobertura a leitura negada/parcial.
          setError(true);setRows([]);
        } else setRows(result.data);
        setLoading(false);
      }).catch(()=>{
        if(current){setError(true);setRows([]);setLoading(false)}
      });
    return()=>{current=false;setRows([])};
  },[reload]);

  const coverage=useMemo(()=>modules.map(module=>{
    const present=new Set(rows.filter(r=>r.module_id===module.id).map(r=>r.section_code));
    return {module,present,missing:SECTIONS.filter(code=>!present.has(code))};
  }),[modules,rows]);

  return (
    <section className="rounded-lg border p-3 md:p-4 space-y-3" aria-label="Cobertura das Fichas Vivas no Core">
      <div className="flex flex-wrap justify-between items-start gap-2">
        <div className="space-y-1">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <BookOpenCheck className="h-4 w-4" aria-hidden="true"/> Cobertura registrada das Fichas Vivas
          </h4>
          <p className="text-sm text-muted-foreground">
            Apenas revisões FM existentes no Núcleo, não a quantidade de documentos originais nem o aceite operacional.
          </p>
        </div>
        <Button size="sm" variant="outline" type="button" disabled={loading}
          onClick={()=>setReload(n=>n+1)}><RefreshCw className="h-4 w-4 mr-1" aria-hidden="true"/> Atualizar</Button>
      </div>
      {loading && <p className="text-sm text-muted-foreground" role="status">Consultando revisões permitidas pela sessão…</p>}
      {error && <p className="text-sm text-destructive" role="alert">
        Não foi possível confirmar a cobertura por RLS ou a leitura está incompleta. Nenhuma ausência foi inferida.
      </p>}
      {!loading&&!error&&(
        <div className="grid gap-3 sm:grid-cols-2">
          {coverage.map(({module,present,missing})=>(
            <div key={module.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex flex-wrap justify-between gap-2 items-center">
                <p className="text-sm font-semibold">{module.code} — {module.title}</p>
                <Badge variant="outline">{present.size} / {SECTIONS.length} seções com revisão</Badge>
              </div>
              {missing.length ? (
                <p className="text-sm text-muted-foreground">
                  Sem revisão no Core: {missing.join(", ")}.
                  Isso não significa ausência de conhecimento nas fontes GitHub/Drive.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Todas as seções possuem ao menos uma revisão. A vigência, a autoridade e a homologação ainda devem ser verificadas.
                </p>
              )}
            </div>
          ))}
          {coverage.length===0&&<p className="text-sm text-muted-foreground">
            Nenhum módulo externo ao Núcleo cadastrado nesta leitura.
          </p>}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Consulta sob RLS, sem gravação automática, sem acesso ao conteúdo das revisões e sem concluir frentes.
      </p>
    </section>
  );
}
