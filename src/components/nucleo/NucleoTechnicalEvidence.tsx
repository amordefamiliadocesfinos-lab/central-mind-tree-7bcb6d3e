import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { NucleoDevelopmentDatabase, TechnicalEvidence } from "@/lib/nucleo/development.types";

const client = supabase as unknown as SupabaseClient<NucleoDevelopmentDatabase>;
const labels = {
  pull_request: "Pull request",
  commit: "Commit",
  workflow_run: "Teste / CI",
  migration: "Migration",
};
const statuses = {
  observado: "Observado",
  verificado: "Verificado na origem",
  divergente: "Divergência",
  nao_verificado: "Não verificado",
};
export default function NucleoTechnicalEvidence({ workstreamId }: { workstreamId: string }) {
  const [records, setRecords] = useState<TechnicalEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecords([]);
    setLoading(true);
    setError(false);
    void (async () => {
      const result = await client.from("nucleo_development_evidence")
        .select("*").eq("workstream_id",workstreamId)
        .order("recorded_at", { ascending: false }).limit(100);
      if (cancelled) return;
      setError(!!result.error);
      setRecords(result.error ? [] : result.data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workstreamId]);

  return (
    <section className="border-t pt-3 space-y-2" aria-label="Evidências técnicas M4">
      <h4 className="font-semibold text-xs">Evidências técnicas — M4</h4>
      <p className="text-[11px] text-muted-foreground">
        Registros conferidos em um momento específico. Não são monitoramento em tempo real
        nem determinam automaticamente a conclusão da frente.
      </p>
      {loading && <p className="text-xs text-muted-foreground">Consultando…</p>}
      {error && <p role="status" className="text-xs text-muted-foreground">Evidências temporariamente indisponíveis.</p>}
      {!loading && !error && records.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma evidência vinculada.</p>}
      {records.map(record => {
        // Somente URLs normalizadas do repositório oficial podem ser abertas.
        const officialPrefix = "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/";
        const isOfficial = record.source === "github" && record.reference_url?.startsWith(officialPrefix);
        return (
          <div key={record.id} className="rounded-lg border p-2 space-y-1 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{labels[record.kind]} · {record.external_key}</span>
              <span className="text-muted-foreground">{statuses[record.observed_state]}</span>
            </div>
            <p className="break-words">{record.title}</p>
            {record.checked_at && (
              <p className="text-muted-foreground">Conferida em {new Date(record.checked_at).toLocaleString("pt-BR")}</p>
            )}
            {record.evidence_note && <p className="text-muted-foreground break-words">{record.evidence_note}</p>}
            {isOfficial && (
              <a href={record.reference_url!} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2">
                Abrir evidência original <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        );
      })}
    </section>
  );
}
