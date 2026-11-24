import { useMemo, useState } from "react";
import type { DevelopmentEvent, DevelopmentWorkstream } from "@/lib/nucleo/development.types";
import type { ModuleProvenance } from "@/lib/nucleo/operationalProvenanceV12";
import { SOURCE_AUTHORITY_LABELS } from "@/lib/nucleo/operationalProvenanceV12";
import { Button } from "@/components/ui/button";

/**
 * P4-B: preparação consultiva de retomada. Cada campo é rastreável à ficha M3,
 * ao evento M3 carregado ou ao catálogo documental versionado. Não cria pacote
 * AC-02, não atribui decisões/autoridades e não executa nenhuma escrita.
 */
interface Props {
  module: DevelopmentWorkstream;
  workstreams: DevelopmentWorkstream[];
  events: DevelopmentEvent[];
  provenance?: ModuleProvenance;
  focusedWorkstreamId?: string|null;
  onOpenWorkstream: (id: string) => void;
  onOpenSources: () => void;
  onOpenDocuments: () => void;
  onOpenMandates: () => void;
}
const rank = { critica: 0, alta: 1, normal: 2, baixa: 3 };
export default function NucleoResumeBrief({
  module, workstreams, events, provenance, focusedWorkstreamId, onOpenWorkstream,
  onOpenSources, onOpenDocuments, onOpenMandates,
}: Props) {
  const [pendingFilter,setPendingFilter]=useState<"todos"|"bloqueadas"|"sem_acao"|"sem_responsavel"|"sem_aceite"|"evidencia">("todos");
  const [pendingLimit,setPendingLimit]=useState(5);
  const context = useMemo(() => {
    const fronts = workstreams.filter(item => item.kind === "frente" && item.parent_id === module.id);
    const subfronts = fronts.flatMap(front =>
      workstreams.filter(item => item.kind === "subfrente" && item.parent_id === front.id));
    const linked = [...fronts, ...subfronts];
    const ids = new Set([module.id, ...linked.map(item => item.id)]);
    const pending = linked.filter(item => item.status !== "concluido").sort((a, b) =>
      Number(b.status === "bloqueado") - Number(a.status === "bloqueado") ||
      rank[a.priority] - rank[b.priority] || a.code.localeCompare(b.code, "pt-BR"));
    const recent = events.filter(event => ids.has(event.workstream_id))
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at) || b.id.localeCompare(a.id))[0];
    const missingAction = pending.filter(item => !item.next_action.trim());
    const missingOwner = pending.filter(item => !item.specialist.trim());
    const missingAcceptance = pending.filter(item => !item.acceptance_criteria.trim());
    const evidenceToReview = pending.filter(item => item.evidence_state !== "comprovada" || !item.evidence_note.trim());
    return { fronts, subfronts, pending, recent, missingAction, missingOwner, missingAcceptance, evidenceToReview, linked };
  }, [module.id, workstreams, events]);

  const focused=context.linked.find(item=>item.id===focusedWorkstreamId);
  const focusedEvent=focused ? events.filter(event=>event.workstream_id===focused.id).sort((a,b)=>b.recorded_at.localeCompare(a.recorded_at)||b.id.localeCompare(a.id))[0] : undefined;
  const visiblePending=context.pending.filter(item=>pendingFilter==="todos" || (pendingFilter==="bloqueadas" && item.status==="bloqueado") || (pendingFilter==="sem_acao" && !item.next_action.trim()) || (pendingFilter==="sem_responsavel" && !item.specialist.trim()) || (pendingFilter==="sem_aceite" && !item.acceptance_criteria.trim()) || (pendingFilter==="evidencia" && (item.evidence_state!=="comprovada" || !item.evidence_note.trim())));
  const declaredCurrent = provenance?.sources.filter(source => source.authority === "vigente_declarada") ?? [];
  const sourceCount = provenance?.sources.length ?? 0;
  const latest = context.recent;
  const latestCode = latest ? workstreams.find(item => item.id === latest.workstream_id)?.code ?? "Não localizado" : null;
  return <section className="rounded-xl border p-3 space-y-3"
    aria-label="P4-B — resumo consultivo de retomada por módulo">
    <div className="space-y-1">
      <h4 className="font-semibold text-sm">P4-B · Resumo de retomada por módulo</h4>
      <p className="text-xs text-muted-foreground">
        Preparação para a próxima sessão com informações declaradas e suas origens.
        Não é um pacote de assunção AC-02, decisão da Camada Mestre ou autorização de execução.
      </p>
    </div>
    <div className="rounded-lg border p-2 text-xs space-y-1">
      <p><strong>Módulo M3:</strong> {module.code} · {module.title}</p>
      <p><strong>Especialista declarado:</strong> {module.specialist.trim() || "Não registrado na ficha M3"}</p>
      <p><strong>Método catalogado:</strong> {provenance?.methodSummary || "Sem síntese documental no catálogo"}</p>
      <p><strong>Limite de autoridade documentado:</strong> {provenance?.ownerBoundary || "Não catalogado; conferir mandatos"}</p>
      <p className="text-muted-foreground">
        Origem: cadastro M3 do Core e referências do catálogo versionado. Papel textual não constitui mandato.
      </p>
    </div>
    {focused && <section className="rounded-lg border p-3 space-y-1 text-xs" aria-label="Ficha de origem da retomada">
      <p className="font-semibold">Ficha de origem da retomada · {focused.code} · {focused.title}</p>
      <p>Estado declarado: {focused.status.replaceAll("_"," ")} · prioridade {focused.priority}</p>
      <p><strong>Próxima ação:</strong> {focused.next_action.trim()||"Não registrada"}</p>
      <p><strong>Responsável:</strong> {focused.specialist.trim()||"Não informado"}</p>
      {focused.blocker.trim() && <p><strong>Bloqueio:</strong> {focused.blocker}</p>}
      <p><strong>Critério de aceite:</strong> {focused.acceptance_criteria.trim()||"Não registrado"}</p>
      <p><strong>Evidência M3:</strong> {focused.evidence_state.replaceAll("_"," ")} · {focused.evidence_note.trim()||"Nota não registrada"}</p>
      <p>Último evento da ficha na janela M3: {focusedEvent?new Date(focusedEvent.recorded_at).toLocaleString("pt-BR")+" · "+focusedEvent.event_type:"Não localizado"}</p>
      <Button type="button" size="sm" variant="outline" onClick={()=>onOpenWorkstream(focused.id)}>Retornar à ficha de origem</Button>
      <p className="text-muted-foreground">Contexto consultivo da ficha existente; não constitui mandato nem pacote AC-02.</p>
    </section>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {[
        { label: "Frentes M3", value: context.fronts.length },
        { label: "Subfrentes M3", value: context.subfronts.length },
        { label: "Pendências M3", value: context.pending.length },
        { label: "Sem próxima ação", value: context.missingAction.length },
        { label: "Sem responsável", value: context.missingOwner.length },
        { label: "Sem critério de aceite", value: context.missingAcceptance.length },
        { label: "Evidência M3 a conferir", value: context.evidenceToReview.length },
      ].map(metric => <div key={metric.label} className="rounded-lg border p-2">
        <p className="text-xs text-muted-foreground">{metric.label}</p>
        <p className="text-lg font-semibold tabular-nums">{metric.value}</p>
      </div>)}
    </div>
    <div className="rounded-lg border p-2 text-xs space-y-1">
      <p className="font-semibold">Última movimentação localizada na janela M3</p>
      {latest ? <>
        <p>{new Date(latest.recorded_at).toLocaleString("pt-BR")} · {latest.event_type} · {latestCode}</p>
        <p className="text-muted-foreground">Identificador do evento: {latest.id}</p>
        <Button size="sm" type="button" variant="outline"
          onClick={() => onOpenWorkstream(latest.workstream_id)}>Abrir ficha associada</Button>
      </> : <p className="text-muted-foreground">
        Nenhum evento localizado na janela global de até 200 eventos carregados; isso não demonstra ausência de histórico.
      </p>}
    </div>
    <div className="rounded-lg border p-2 text-xs space-y-2">
      <p className="font-semibold">Próximos passos declarados e obstáculos</p>
      <nav className="flex flex-wrap gap-2" aria-label="Filtrar pendências de retomada">
        {([["todos","Todas"],["bloqueadas","Bloqueadas"],["sem_acao","Sem próxima ação"],["sem_responsavel","Sem responsável"],["sem_aceite","Sem critério de aceite"],["evidencia","Evidência a conferir"]] as const).map(([key,label])=><Button key={key} type="button" size="sm" variant={pendingFilter===key?"default":"outline"} aria-pressed={pendingFilter===key} onClick={()=>{setPendingFilter(key);setPendingLimit(5);}}>{label}</Button>)}
      </nav>
      <p className="text-muted-foreground" role="status">{visiblePending.length} de {context.pending.length} pendências no filtro.</p>
      {visiblePending.length === 0 ? <p className="text-muted-foreground">
        Nenhuma pendência neste filtro e recorte M3; não comprova encerramento operacional.
      </p> : visiblePending.slice(0, pendingLimit).map(item => <div key={item.id} className="rounded-md border p-2 space-y-1">
        <p className="font-medium">{item.code} · {item.title} · {item.status.replaceAll("_", " ")} · prioridade {item.priority}</p>
        <p><strong>Próxima ação:</strong> {item.next_action.trim() || "Não registrada"}</p>
        <p><strong>Responsável:</strong> {item.specialist.trim() || "Não informado"}</p>
        <p><strong>Critério de aceite:</strong> {item.acceptance_criteria.trim() || "Não registrado"}</p>
        {item.blocker.trim() && <p><strong>Bloqueio:</strong> {item.blocker}</p>}
        <p className="text-muted-foreground">Evidência M3: {item.evidence_state.replaceAll("_", " ")} · {item.evidence_note.trim() || "Nota não registrada"}</p>
        <Button size="sm" type="button" variant="outline"
          onClick={() => onOpenWorkstream(item.id)}>Abrir {item.kind === "subfrente" ? "subfrente" : "frente"} vinculada</Button>
      </div>)}
      {visiblePending.length > pendingLimit && <Button type="button" size="sm" variant="outline" onClick={()=>setPendingLimit(current=>current+5)}>Mostrar mais {Math.min(5,visiblePending.length-pendingLimit)} pendência(s)</Button>}
    </div>
    <div className="rounded-lg border p-2 text-xs space-y-2">
      <p className="font-semibold">Fontes de conhecimento para conferir</p>
      <p>{sourceCount} referência(s) documentais catalogada(s); {declaredCurrent.length} marcada(s) como vigente(s) declarada(s).</p>
      {declaredCurrent.slice(0, 3).map(source => <div key={source.path} className="space-y-1">
        <p>{source.label} · {SOURCE_AUTHORITY_LABELS[source.authority]}</p>
        <a href={source.path} target="_blank" rel="noopener noreferrer"
          className="underline underline-offset-2 break-all">Consultar fonte original catalogada</a>
      </div>)}
      {declaredCurrent.length > 3 && <p className="text-muted-foreground">
        Mais {declaredCurrent.length - 3} referência(s) declarada(s) vigente(s) no catálogo.
      </p>}
      {declaredCurrent.length === 0 && <p className="text-muted-foreground">
        Nenhuma referência marcada vigente declarada no catálogo; documentos podem existir em outras fontes.
      </p>}
      <p className="text-muted-foreground">
        A classificação de vigência é declaratória. Versões e contribuições AC-01 exigem conferência própria.
      </p>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={onOpenSources}>Examinar todas as fontes</Button>
      <Button type="button" size="sm" variant="outline" onClick={onOpenDocuments}>Conferir versões AC-01</Button>
      <Button type="button" size="sm" variant="outline" onClick={onOpenMandates}>Conferir mandatos</Button>
    </div>
    <p className="text-xs text-muted-foreground">
      Próxima ação sugerida pelo resumo: verificar as lacunas M3 e confrontar as fontes e autoridades
      antes de qualquer decisão. Não há homologação, publicação, criação automática de tarefa,
      aprendizado FM-09 ou transferência de responsabilidade.
    </p>
  </section>;
}
