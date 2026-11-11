import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { NucleoDevelopmentDatabase, TechnicalEvidence } from "@/lib/nucleo/development.types";

const client = supabase as unknown as SupabaseClient<NucleoDevelopmentDatabase>;
const officialRepo = "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/";
const kinds: TechnicalEvidence["kind"][] = ["pull_request", "workflow_run", "migration", "commit"];
const labels: Record<TechnicalEvidence["kind"], string> = {
  pull_request: "Pull requests", workflow_run: "Testes / CI", migration: "Migrations", commit: "Commits",
};
const statuses: Record<TechnicalEvidence["observed_state"], string> = {
  observado: "Observado", verificado: "Verificado na origem",
  divergente: "Divergência", nao_verificado: "Não verificado",
};
function officialLink(record: TechnicalEvidence): string | null {
  if (record.source !== "github" || !record.reference_url) return null;
  try {
    const candidate = new URL(record.reference_url);
    const base = new URL(officialRepo);
    return candidate.protocol === "https:" && candidate.origin === base.origin &&
      candidate.pathname.startsWith(base.pathname) ? candidate.href : null;
  } catch { return null; }
}
export default function NucleoTechnicalEvidence({ workstreamId }: { workstreamId: string }) {
  const [records, setRecords] = useState<TechnicalEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<TechnicalEvidence["kind"][]>([]);
  const [expandedRecords, setExpandedRecords] = useState<string[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setRecords([]);
    setLoading(true);
    setError(false);
    setExpandedGroups([]);
    setExpandedRecords([]);
    void (async () => {
      const result = await client.from("nucleo_development_evidence")
        .select("*").eq("workstream_id", workstreamId)
        .order("recorded_at", { ascending: false }).limit(100);
      if (cancelled) return;
      setError(!!result.error);
      setRecords(result.error ? [] : result.data ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workstreamId, reloadKey]);

  const groups = useMemo(() => kinds.map(kind => ({
    kind, items: records.filter(record => record.kind === kind),
  })).filter(group => group.items.length > 0), [records]);
  const toggleGroup = (kind: TechnicalEvidence["kind"]) =>
    setExpandedGroups(prev => prev.includes(kind) ? prev.filter(k => k !== kind) : [...prev, kind]);
  const toggleRecord = (id: string) =>
    setExpandedRecords(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  const lastChecked = useMemo(() => records.map(r => r.checked_at)
    .filter((value): value is string => !!value).sort().at(-1), [records]);

  return (
    <section className="border-t pt-3 space-y-2" aria-label="Evidências técnicas M4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-sm">Evidências técnicas — M4</h4>
        <Button type="button" variant="outline" size="sm" disabled={loading}
          onClick={() => setReloadKey(key => key + 1)}
          title="Reconsultar registros armazenados no Core; não consulta GitHub em tempo real">
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Recarregar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {records.length} evidência(s) arquivada(s) por tipo. Registros de uma conferência anterior,
        não são sincronização ao vivo nem aprovam a frente automaticamente.
      </p>
      {lastChecked && <p className="text-xs text-muted-foreground">
        Última conferência registrada: {new Date(lastChecked).toLocaleString("pt-BR")}
      </p>}
      {loading && <p role="status" className="text-xs text-muted-foreground">Consultando evidências…</p>}
      {error && <p role="status" className="text-xs text-muted-foreground">Evidências temporariamente indisponíveis.</p>}
      {!loading && !error && records.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma evidência vinculada.</p>
      )}
      {!loading && !error && groups.map(group => {
        const open = expandedGroups.includes(group.kind);
        return (
          <div key={group.kind} className="rounded-lg border overflow-hidden">
            <button type="button" aria-expanded={open}
              onClick={() => toggleGroup(group.kind)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-accent/40">
              <span className="text-xs font-semibold">{labels[group.kind]} ({group.items.length})</span>
              {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            </button>
            {open && <div className="border-t divide-y">
              {group.items.map(record => {
                const detailsOpen = expandedRecords.includes(record.id);
                const link = officialLink(record);
                return (
                  <div key={record.id} className="p-3 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-xs break-words">{record.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {record.external_key} · {statuses[record.observed_state]}
                        </p>
                      </div>
                      <button type="button" onClick={() => toggleRecord(record.id)}
                        aria-expanded={detailsOpen} className="text-xs underline underline-offset-2">
                        {detailsOpen ? "Ocultar" : "Detalhes"}
                      </button>
                    </div>
                    {link && <a href={link} target="_blank" rel="noopener noreferrer"
                      className="text-xs inline-flex gap-1 items-center underline underline-offset-2">
                      Abrir fonte <ExternalLink className="h-3 w-3" />
                    </a>}
                    {detailsOpen && <div className="space-y-1 text-xs text-muted-foreground border-t pt-2">
                      {record.checked_at && <p>Conferida: {new Date(record.checked_at).toLocaleString("pt-BR")}</p>}
                      <p>Registrada: {new Date(record.recorded_at).toLocaleString("pt-BR")}</p>
                      {record.evidence_note && <p className="break-words">{record.evidence_note}</p>}
                    </div>}
                  </div>
                );
              })}
            </div>}
          </div>
        );
      })}
    </section>
  );
}
