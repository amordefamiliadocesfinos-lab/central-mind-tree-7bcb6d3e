import type { DevelopmentWorkstream, TechnicalEvidence } from "./development.types";
import { inspectNucleoSupervision, type SupervisionSnapshot } from "./supervision";

export const DEMO_M5_CASES = [
  { key: "divergencia", label: "Divergência", description: "Uma evidência fictícia apresenta divergência declarada." },
  { key: "bloqueio", label: "Bloqueio", description: "A frente fictícia contém um impedimento registrado." },
  { key: "proxima_acao", label: "Próxima ação", description: "A frente fictícia não possui próxima ação." },
  { key: "revisao_fonte", label: "Fonte pendente", description: "Uma evidência fictícia ainda depende de conferência." },
  { key: "combinado", label: "Simulação combinada", description: "Quatro alertas simultâneos, apenas com dados fictícios." },
] as const;
export type M5DemoKey = (typeof DEMO_M5_CASES)[number]["key"];

/**
 * Fixture construída inteiramente em memória, sem acesso a servidor.
 * IDs deliberadamente impossíveis de confundir com UUIDs reais.
 */
export function buildM5DemoSnapshot(key: M5DemoKey): SupervisionSnapshot {
  if (!DEMO_M5_CASES.some(s => s.key === key)) throw new Error("Cenário desconhecido");
  const front: DevelopmentWorkstream = {
    id: "DEMO-M5-FRENTE", code: "DEMO-M5", parent_id: null,
    title: "Frente fictícia de treinamento", description: "Simulação local",
    kind: "frente", status: "em_validacao", priority: "normal",
    specialist: "DEMONSTRAÇÃO", next_action: "Revisar o cenário",
    acceptance_criteria: "", blocker: "", evidence_state: "sem_evidencia",
    evidence_note: "Dados sintéticos", created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z", created_by_auth_uid: null,
    updated_by_auth_uid: null,
  };
  const evidence = (id: string, observed_state: TechnicalEvidence["observed_state"]): TechnicalEvidence => ({
    id, workstream_id: front.id, source: "github", kind: "workflow_run",
    repository: null, external_key: "DEMO-FAKE", reference_url: null,
    title: "Prova sintética " + id, observed_state,
    source_observed_at: null, checked_at: null, evidence_note: "DADOS FICTÍCIOS",
    snapshot: {}, recorded_at: "2026-01-01T00:00:00Z", recorded_by_auth_uid: null,
  });
  const proofs: TechnicalEvidence[] = [];
  if (key === "divergencia" || key === "combinado") proofs.push(evidence("DEMO-DIVERGENCIA", "divergente"));
  if (key === "revisao_fonte" || key === "combinado") proofs.push(evidence("DEMO-PENDENTE", "observado"));
  if (key === "bloqueio" || key === "combinado") {
    front.status = "bloqueado";
    front.blocker = "Aprovação fictícia pendente";
  }
  if (key === "proxima_acao" || key === "combinado") front.next_action = "";
  // Todos os dados são novos por clique e nunca têm ligação com o Core.
  return inspectNucleoSupervision([front], proofs, [], new Date("2026-11-12T12:00:00Z"));
}
