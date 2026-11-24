import type { DevelopmentDependency, DevelopmentWorkstream, TechnicalEvidence, DevelopmentEvent } from "./development.types";

/** Regras determinísticas, apenas sugestões — nunca executam mutações. */
export type SupervisionFinding = {
  id: string;
  workstreamCode: string;
  workstreamTitle: string;
  kind: "divergencia" | "evidencia_ausente" | "prova_declarada" | "revisao_fonte" | "bloqueio" | "proxima_acao" | "dependencia_bloqueante" | "prioridade_aberta" | "checkpoint_nao_localizado" | "conferencia_anterior_m3";
  severity: "atencao" | "informativo";
  title: string;
  explanation: string;
  suggestedAction: string;
  evidenceIds: string[];
};

export type SupervisionSnapshot = {
  findings: SupervisionFinding[];
  evidenceCount: number;
  workstreamCount: number;
  declaredDependencies: number;
  computedAt: string;
  informationalOnly: true;
};

/**
 * Sem porcentagens, pontuação de progresso ou previsões de conclusão.
 * Apenas compara estados declarados na M3 com evidências já lidas sob RLS.
 * Ausência de dados e falhas de consulta devem ser tratadas fora desta função.
 */
export function inspectNucleoSupervision(
  workstreams: DevelopmentWorkstream[],
  evidence: TechnicalEvidence[],
  dependencies: DevelopmentDependency[],
  now: Date = new Date(),
  checkpointWindow?: { events: readonly DevelopmentEvent[]; workstreams: readonly DevelopmentWorkstream[] },
): SupervisionSnapshot {
  const byFront = new Map<string, TechnicalEvidence[]>();
  for (const record of evidence) {
    const list = byFront.get(record.workstream_id) ?? [];
    list.push(record);
    byFront.set(record.workstream_id, list);
  }
  const findings: SupervisionFinding[] = [];
  const add = (
    front: DevelopmentWorkstream,
    kind: SupervisionFinding["kind"],
    title: string,
    explanation: string,
    suggestedAction: string,
    evidenceIds: string[] = [],
    severity: SupervisionFinding["severity"] = "atencao",
  ) => findings.push({
    id: `${front.code}:${kind}`,
    workstreamCode: front.code, workstreamTitle: front.title,
    kind, severity, title, explanation, suggestedAction, evidenceIds,
  });

  const byId = new Map(workstreams.map(item=>[item.id,item]));
  const checkpointIds = new Set(checkpointWindow?.events.map(event=>event.workstream_id) ?? []);
  const checkpointRevisions = new Map(checkpointWindow?.workstreams.map(item=>[item.id,item.updated_at]) ?? []);
  for (const front of workstreams.filter(item => item.kind !== "modulo")) {
    const records = byFront.get(front.id) ?? [];
    const diverging = records.filter(r => r.observed_state === "divergente");
    if (diverging.length) {
      add(front, "divergencia", "Divergência declarada na origem",
        `${diverging.length} evidência(s) arquivada(s) marcada(s) como divergente(s).`,
        "Abrir as fontes e investigar antes de aceitar o marco.", diverging.map(r => r.id));
    }
    const hasVerifiedTechnicalRecord = records.some(r => r.observed_state === "verificado");
    if (front.status === "concluido" && !hasVerifiedTechnicalRecord) {
      add(front, "evidencia_ausente", "Conclusão declarada sem prova técnica vinculada",
        "A frente foi declarada concluída, mas a consulta não retornou evidência técnica verificada.",
        "Conferir o histórico e os critérios originais; não alterar o status automaticamente.");
    } else if (front.evidence_state === "comprovada" && !hasVerifiedTechnicalRecord) {
      // Evidência declarada em M3 pode existir fora de M4. Apontar somente a
      // lacuna de conciliação neste snapshot, sem invalidar a prova nem o método.
      add(front, "prova_declarada", "Prova declarada sem correspondência técnica M4",
        "A ficha M3 marca a evidência como comprovada, mas nenhum registro M4 desta frente está marcado como verificado na consulta autorizada.",
        "Conciliar a origem da prova com o responsável; registrar M4 pelo procedimento autorizado, se pertinente. Não mudar o estado M3 automaticamente.",
        records.map(r => r.id), "informativo");
    }
    if (front.status === "bloqueado" && front.blocker.trim()) {
      add(front, "bloqueio", "Bloqueio declarado",
        front.blocker,
        "Revisar o bloqueio com o responsável e registrar uma decisão humana.");
    }
    if (front.status !== "concluido" && !front.next_action.trim()) {
      add(front, "proxima_acao", "Próxima ação não declarada",
        "A ficha não contém próxima ação.",
        "Definir a próxima ação na M3 por uma pessoa autorizada.", [], "informativo");
    }
    // Somente dependências explícitas com destino conhecido e bloqueado.
    // Não inferir que toda dependência pendente impede avanço nem reabrir concluídas.
    if(front.status!=="concluido"){
      const blockedDependencies = [...new Set(dependencies
        .filter(link=>link.workstream_id===front.id)
        .map(link=>link.depends_on_id))]
        .map(id=>byId.get(id))
        .filter((item): item is DevelopmentWorkstream=>!!item && item.status==="bloqueado" && item.id!==front.id)
        .sort((a,b)=>a.code.localeCompare(b.code,"pt-BR"));
      if(blockedDependencies.length){
        add(front,"dependencia_bloqueante","Dependência vinculada em situação bloqueada",
          blockedDependencies.map(item=>item.code+" · "+item.title+(item.blocker.trim()?" — "+item.blocker:" — motivo não registrado")).join("; "),
          "Consultar as fichas das dependências e alinhar a próxima ação com seus responsáveis. O vínculo não altera automaticamente o estado desta frente.");
      }
    }
    if(front.status!=="concluido"){
      if(front.priority==="alta" || front.priority==="critica"){
        add(front,"prioridade_aberta","Prioridade aberta declarada",
          "Prioridade "+front.priority+" registrada na ficha M3.",
          "Revisar responsável, bloqueios e próxima ação sem alterar a prioridade automaticamente.");
      }
      // A janela de eventos vem da leitura M3 existente, não do snapshot M5.
      // Só cruzar quando a revisão da ficha coincide nas duas leituras.
      if(checkpointWindow && checkpointRevisions.get(front.id)===front.updated_at && !checkpointIds.has(front.id)){
        add(front,"checkpoint_nao_localizado","Checkpoint não localizado na janela M3",
          "Nenhum evento desta ficha foi localizado na janela global de até 200 eventos já consultados. Isso não comprova ausência no histórico completo.",
          "Consultar os checkpoints da ficha e a origem antes de decidir.",[],"informativo");
      }
      // Datas reais, sem prazo inventado: uma conferência anterior à última
      // atualização M3 é apenas sinal de revisão, não prova de desatualização.
      const changedAt=Date.parse(front.updated_at);
      const older=records.filter(record=>record.observed_state==="verificado" && !!record.checked_at &&
        Number.isFinite(changedAt) && Number.isFinite(Date.parse(record.checked_at)) &&
        Date.parse(record.checked_at)<changedAt);
      if(older.length){
        add(front,"conferencia_anterior_m3","Conferência anterior à atualização da ficha",
          older.length+" evidência(s) verificadas antes da última atualização M3. A relação temporal não comprova invalidação ou divergência de publicação.",
          "Verificar se a alteração da ficha afeta a evidência antes de solicitar nova conferência.",older.map(record=>record.id),"informativo");
      }
    }
    const unverified = records.filter(r => r.observed_state === "nao_verificado" || r.observed_state === "observado");
    if (unverified.length) {
      add(front, "revisao_fonte", "Fontes pendentes de conferência",
        `${unverified.length} registro(s) técnico(s) não estão classificados como verificados.`,
        "Conferir a fonte e registrar uma nova evidência pelo procedimento M4.", unverified.map(r => r.id), "informativo");
    }
  }

  // Dependências são apenas as relações explicitamente registradas na M3.
  // Não inventar uma dependência M4→M5 por inferência a partir do mapa.
  const ids = new Set(workstreams.map(w => w.id));
  const validDeclaredDependencies = dependencies.filter(d => ids.has(d.workstream_id) && ids.has(d.depends_on_id)).length;
  return {
    findings,
    evidenceCount: evidence.length,
    workstreamCount: workstreams.length,
    declaredDependencies: validDeclaredDependencies,
    computedAt: now.toISOString(),
    informationalOnly: true,
  };
}
