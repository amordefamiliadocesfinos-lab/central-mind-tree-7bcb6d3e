import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import type {
  NucleoDevelopmentDatabase, DevelopmentDependency, DevelopmentWorkstream, TechnicalEvidence,
} from "@/lib/nucleo/development.types";
import { inspectNucleoSupervision } from "@/lib/nucleo/supervision";
import { findNucleoFindingSources } from "@/lib/nucleo/supervision-provenance";
import { buildM5DemoSnapshot, DEMO_M5_CASES, type M5DemoKey } from "@/lib/nucleo/supervision-demo";

const client = supabase as unknown as SupabaseClient<NucleoDevelopmentDatabase>;
const MAX_EVIDENCE = 500;

export default function NucleoSupervisionPanel({
  workstreams, dependencies,
}: {
  workstreams: DevelopmentWorkstream[];
  dependencies: DevelopmentDependency[];
}) {
  const [evidence, setEvidence] = useState<TechnicalEvidence[]>([]);
  const [latestFronts, setLatestFronts] = useState<DevelopmentWorkstream[]>([]);
  const [latestDependencies, setLatestDependencies] = useState<DevelopmentDependency[]>([]);
  const [showDemo, setShowDemo] = useState(false);
  const [demoCase, setDemoCase] = useState<M5DemoKey>("divergencia");
  const demo = useMemo(() => showDemo ? buildM5DemoSnapshot(demoCase) : null, [showDemo, demoCase]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);
  const frontsVersion = workstreams.map(w => `${w.id}:${w.updated_at}`).join("|");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setLoaded(false);
    setPermissionConfirmed(false);
    setEvidence([]);
    setLatestFronts([]);
    setLatestDependencies([]);
    void (async () => {
      // Reconfirm a real authenticated identity and a currently active explicit grant.
      // No secret, service role or privileged function; every SELECT obeys RLS.
      const identity = await client.auth.getUser();
      if (cancelled) return;
      const uid = identity.data.user?.id;
      if (identity.error || !uid) {
        setLoadError(true); setLoading(false); return;
      }
      const grant = await client.from("app_admin_capabilities")
        .select("auth_user_id").eq("auth_user_id", uid)
        .eq("capability", "nucleo_manage").eq("active", true)
        .is("revoked_at", null).limit(2);
      if (cancelled) return;
      if (grant.error || grant.data?.length !== 1 || grant.data[0]?.auth_user_id !== uid) {
        setLoadError(true); setLoading(false); return;
      }
      const [frontCheck, result, depCheck] = await Promise.all([
        client.from("nucleo_development_workstreams")
          .select("*").order("code").limit(500),
        client.from("nucleo_development_evidence")
          .select("*").order("recorded_at", { ascending: false }).limit(MAX_EVIDENCE),
        client.from("nucleo_development_dependencies")
          .select("*").limit(500),
      ]);
      if (cancelled) return;
      const fronts = frontCheck.data ?? [];
      const allowed = !frontCheck.error && !result.error && !depCheck.error &&
        fronts.length > 0 && fronts.length < 500 &&
        (result.data?.length ?? MAX_EVIDENCE) < MAX_EVIDENCE &&
        (depCheck.data?.length ?? 500) < 500;
      if (!allowed) {
        setLoadError(true); setEvidence([]); setLatestFronts([]);
        setLatestDependencies([]); setLoading(false); return;
      }
      // A fresh complete M3/M4 snapshot, not stale parent data, is used for findings.
      setLatestFronts(fronts);
      setLatestDependencies(depCheck.data ?? []);
      setEvidence(result.data ?? []);
      setPermissionConfirmed(true);
      setLoaded(true);
      setLoading(false);
    })().catch(() => {
      if (!cancelled) {
        setLoadError(true); setLoaded(false); setPermissionConfirmed(false);
        setEvidence([]); setLatestFronts([]); setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    const { data: authListener } = client.auth.onAuthStateChange(() => {
      // Revoke visible report immediately; new SELECT must revalidate active grant.
      setLoaded(false); setPermissionConfirmed(false); setEvidence([]);
      setReloadKey(key => key + 1);
    });
    const revalidateVisible = () => {
      if (document.visibilityState === "visible") {
        setLoaded(false); setPermissionConfirmed(false); setEvidence([]);
        setReloadKey(key => key + 1);
      }
    };
    document.addEventListener("visibilitychange", revalidateVisible);
    return () => {
      authListener.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", revalidateVisible);
    };
  }, []);

  // Never infer missing evidence from a failed, partial or revoked RLS read.
  const complete = loaded && permissionConfirmed && !loadError &&
    evidence.length < MAX_EVIDENCE && latestFronts.length > 0;
  const snapshot = useMemo(
    () => complete ? inspectNucleoSupervision(latestFronts, evidence, latestDependencies) : null,
    [complete, latestFronts, evidence, latestDependencies],
  );
  return (
    <Card className="p-4 space-y-3" aria-label="Supervisão assistida M5">
      <div className="flex flex-wrap gap-2 items-start justify-between">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Supervisão assistida — M5
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Recomendações determinísticas baseadas nos registros M3/M4 acessíveis à sessão.
            Não é um agente autônomo e não altera frentes, documentos ou permissões.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline"
          disabled={loading} onClick={() => setReloadKey(k => k + 1)}>
          <RefreshCw className="h-3.5 w-3.5 mr-1"/> Reavaliar
        </Button>
      </div>
      {loading && <p className="text-xs text-muted-foreground" role="status">Consultando evidências autorizadas…</p>}
      {loadError && <p className="text-xs text-destructive" role="alert">
        A sessão ou a concessão nucleo_manage não pôde ser validada, ou a leitura ficou incompleta. Nenhum alerta foi inferido.
      </p>}
      {!loading && !loadError && evidence.length >= MAX_EVIDENCE && (
        <p className="text-xs text-destructive" role="alert">
          Limite de {MAX_EVIDENCE} evidências atingido. Relatório suspenso para evitar conclusões sobre dados parciais.
        </p>
      )}
      {!loading && !loadError && latestFronts.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma frente M3 disponível para análise.</p>
      )}
      {snapshot && (
        <>
          <p className="text-xs text-muted-foreground">
            {snapshot.workstreamCount} registros M3 · {snapshot.evidenceCount} evidências consultadas ·{" "}
            {snapshot.declaredDependencies} dependências explícitas · {snapshot.findings.length} alertas.
          </p>
          {snapshot.declaredDependencies === 0 && (
            <p className="text-xs text-muted-foreground">
              Não há dependências explícitas cadastradas. O mapa arquitetural não foi convertido em vínculos por inferência.
            </p>
          )}
          {snapshot.findings.length === 0 && <p className="text-xs text-muted-foreground">
            Nenhum alerta identificado pelas regras iniciais. Isso não comprova que as frentes estejam concluídas.
          </p>}
          <div className="space-y-2">
            {snapshot.findings.map(finding => (
              <div className="rounded-md border p-3 space-y-1" key={finding.id}>
                <p className="text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {finding.workstreamCode} — {finding.title}
                </p>
                <p className="text-xs text-muted-foreground">{finding.explanation}</p>
                <p className="text-xs"><span className="font-medium">Sugestão:</span> {finding.suggestedAction}</p>
                {finding.evidenceIds.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {finding.evidenceIds.length} evidência(s) associada(s), com origem verificável:
                  </p>
                )}
                {findNucleoFindingSources(finding, evidence).map(source => (
                  <div key={source.id} className="text-[11px] text-muted-foreground space-y-0.5">
                    <p>{source.source}/{source.kind} · {source.externalKey} · {source.title}</p>
                    <p>Registro: {source.recordedAt} · conferência: {source.checkedAt ?? "não informada"}</p>
                    {source.referenceUrl && (
                      <a className="underline" href={source.referenceUrl}
                        target="_blank" rel="noopener noreferrer">Abrir fonte original</a>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Avaliação local, sem LLM e sem envio de dados a serviços externos. A verificação do GitHub
            não ocorre em tempo real; registros M4 são snapshots com proveniência própria.
          </p>
        </>
      )}
      <div className="border-t pt-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold">Laboratório visual de alertas — demonstração</h4>
            <p className="text-[11px] text-muted-foreground">
              Cenários totalmente fictícios, executados apenas na memória desta página.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline"
            aria-expanded={showDemo}
            onClick={() => setShowDemo(current => !current)}>
            {showDemo ? "Fechar demonstração" : "Abrir demonstração"}
          </Button>
        </div>
        {showDemo && demo && (
          <section aria-label="Demonstração sintética M5" className="rounded-md border border-dashed p-3 space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400" role="status">
                SIMULAÇÃO — DADOS FICTÍCIOS — NÃO É ALERTA REAL
              </p>
              <p className="text-[11px] text-muted-foreground">
                Não utiliza nem substitui os dados da M3/M4. Não grava no Core e não modifica estados.
              </p>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Selecionar cenário sintético">
              {DEMO_M5_CASES.map(scenario => (
                <Button key={scenario.key} type="button" size="sm"
                  variant={demoCase === scenario.key ? "default" : "outline"}
                  aria-pressed={demoCase === scenario.key}
                  onClick={() => setDemoCase(scenario.key)}>
                  {scenario.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {DEMO_M5_CASES.find(item => item.key === demoCase)?.description}
            </p>
            <p className="text-xs font-medium">{demo.findings.length} alerta(s) sintético(s)</p>
            {demo.findings.map(finding => (
              <div key={finding.id} className="rounded-md border p-3 space-y-1">
                <p className="flex items-center gap-2 text-xs font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  {finding.workstreamCode} — {finding.title}
                </p>
                <p className="text-xs text-muted-foreground">{finding.explanation}</p>
                <p className="text-xs"><span className="font-medium">Sugestão:</span> {finding.suggestedAction}</p>
                {finding.evidenceIds.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    IDs fictícios: {finding.evidenceIds.join(", ")}
                  </p>
                )}
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              A demonstração é local e não representa diagnóstico do Painel Central.
            </p>
          </section>
        )}
      </div>
    </Card>
  );
}
