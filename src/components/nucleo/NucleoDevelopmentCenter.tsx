import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import NucleoTechnicalEvidence from "@/components/nucleo/NucleoTechnicalEvidence";
import NucleoSupervisionPanel from "@/components/nucleo/NucleoSupervisionPanel";
import NucleoOperationalAtlas from "@/components/nucleo/NucleoOperationalAtlas";
import NucleoExecutiveDevelopment from "@/components/nucleo/NucleoExecutiveDevelopment";
import NucleoPanoramaDinV30, { moduleIdForWorkstream } from "@/components/nucleo/NucleoPanoramaDinV30";
import NucleoFocusPreviewV30 from "@/components/nucleo/NucleoFocusPreviewV30";
import type { KnowledgeModule } from "@/lib/nucleo/operationalKnowledgeV12";
import { summarizeDevelopmentCheckpoint } from "@/lib/nucleo/developmentCheckpointV12";
import type {
  NucleoDevelopmentDatabase, DevelopmentWorkstream, DevelopmentDependency,
  DevelopmentEvent, DevelopmentKind, DevelopmentStatus, Priority, EvidenceState,
} from "@/lib/nucleo/development.types";

const client = supabase as unknown as SupabaseClient<NucleoDevelopmentDatabase>;
const states: Array<{ key: DevelopmentStatus; label: string }> = [
  { key: "planejado", label: "Planejado" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "bloqueado", label: "Bloqueado" },
  { key: "em_validacao", label: "Em validação" },
  { key: "concluido", label: "Concluído com evidência" },
];
const priorityNames: Record<Priority, string> = {
  baixa: "Baixa", normal: "Normal", alta: "Alta", critica: "Crítica",
};
const evidenceNames: Record<EvidenceState, string> = {
  sem_evidencia: "Sem evidência", relatada: "Relatada", comprovada: "Comprovada",
};
const EDITABLE_KEYS = [
  "title", "description", "specialist", "status", "priority", "next_action",
  "blocker", "acceptance_criteria", "evidence_state", "evidence_note",
] as const;

function changedEditableFields(
  original: DevelopmentWorkstream,
  values: Partial<DevelopmentWorkstream>,
): Partial<DevelopmentWorkstream> {
  const changes: Partial<DevelopmentWorkstream> = {};
  for (const key of EDITABLE_KEYS) {
    if (values[key] !== undefined && values[key] !== original[key]) {
      // All editable columns in this view are strings.
      (changes as Record<string, string>)[key] = values[key] as string;
    }
  }
  return changes;
}

const emptyDraft = {
  code: "", title: "", parent_id: "", kind: "modulo" as DevelopmentKind,
  description: "", specialist: "", acceptance_criteria: "",
};
function cleanCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 60);
}

export default function NucleoDevelopmentCenter() {
  const { session } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState(false);
  const [lastReadAt,setLastReadAt] = useState<string|null>(null);
  const [items, setItems] = useState<DevelopmentWorkstream[]>([]);
  const [dependencies, setDependencies] = useState<DevelopmentDependency[]>([]);
  const [history, setHistory] = useState<DevelopmentEvent[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("");
  const [displayMode, setDisplayMode] = useState<"lista" | "quadro">("lista");
  // UX-A1: as duas visões permanecem montadas durante a sessão.
  const [workspaceView, setWorkspaceView] = useState<"geral" | "frentes">("geral");
  // Filtro de apresentação, sem alteração de estado no Core.
  const [attentionStatus,setAttentionStatus] = useState<DevelopmentStatus | null>(null);
  const [moduleFocusId,setModuleFocusId] = useState("");
  const [specialistFocus,setSpecialistFocus] = useState("");
  const [executiveVisited,setExecutiveVisited] = useState(false);
  const [executiveExpanded,setExecutiveExpanded] = useState(false);
  const [supervisionExpanded,setSupervisionExpanded] = useState(false);
  const [supervisionVisited,setSupervisionVisited] = useState(false);
  // Prova M4 só é consultada quando o usuário abre esta área.
  const [expandedEvidenceFor,setExpandedEvidenceFor] = useState<string|null>(null);
  // Exploração detalhada sob demanda; preserva contexto depois da primeira abertura.
  const [atlasVisited,setAtlasVisited] = useState(false);
  const [atlasExpanded,setAtlasExpanded] = useState(false);
  const [lastOpenedId,setLastOpenedId] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [creating, setCreating] = useState(false);
  const [dependencyTarget, setDependencyTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<Partial<DevelopmentWorkstream>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    const [fronts, links, events] = await Promise.all([
      client.from("nucleo_development_workstreams").select("*").order("code"),
      client.from("nucleo_development_dependencies").select("*").order("created_at", { ascending: false }).limit(500),
      client.from("nucleo_development_events").select("*").order("recorded_at", { ascending: false }).limit(200),
    ]);
    if (fronts.error || links.error || events.error) {
      setReadError(true);
      setLastReadAt(null);
      // Não apresentar um snapshot anterior como se fosse leitura M3 atual.
      setItems([]);
      setDependencies([]);
      setHistory([]);
      setSelectedId("");
      setEdit({});
      toast.error("Leitura M3 indisponível. Nenhum estado anterior foi reutilizado.");
    } else {
      setReadError(false);
      setLastReadAt(new Date().toISOString());
      setItems(fronts.data ?? []);
      setDependencies(links.data ?? []);
      setHistory(events.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let stopped = false;
    setAuthorized(false);
    setItems([]);
    setSelectedId("");
    if (!session?.user?.id) return;
    void (async () => {
      const { data, error } = await supabase.from("app_admin_capabilities")
        .select("capability")
        .eq("auth_user_id", session.user.id)
        .eq("capability", "nucleo_manage")
        .eq("active", true)
        .is("revoked_at", null)
        .maybeSingle();
      if (stopped) return;
      setAuthorized(!error && !!data);
    })();
    return () => { stopped = true; };
  }, [session?.user?.id]);

  useEffect(() => { if (authorized) void refresh(); }, [authorized, refresh]);
  // ID local por usuário; não armazenar minutas, conteúdo ou permissões.
  useEffect(() => {
    const uid=session?.user?.id;
    if(!uid){setLastOpenedId("");return;}
    try {setLastOpenedId(window.localStorage.getItem("nucleo-last-opened:"+uid)||"");}
    catch {setLastOpenedId("");}
  },[session?.user?.id]);

  const byId = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);
  const selected = byId.get(selectedId);
  const pendingChanges = useMemo(
    () => selected ? changedEditableFields(selected, edit) : {},
    [selected, edit],
  );
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;
  useEffect(() => {
    if (!hasPendingChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasPendingChanges]);
  const visible = useMemo(() => {
    const term = filter.toLocaleLowerCase("pt-BR").trim();
    return items.filter(item => !term || [item.code,item.title,item.specialist,item.next_action]
      .some(value => value.toLocaleLowerCase("pt-BR").includes(term)));
  }, [items, filter]);
  const selectedHistory = useMemo(() => history.filter(event => event.workstream_id === selectedId), [history, selectedId]);
  const lastOpened=byId.get(lastOpenedId);
  // A trilha carregada tem até 200 eventos globais; não representa o último ato pessoal.
  const latestEvent=history.find(e=>{const item=byId.get(e.workstream_id);return !!item&&item.code!=="NUC";});
  const resumeItem=lastOpened ?? (latestEvent ? byId.get(latestEvent.workstream_id) : undefined);
  const resumeSource=lastOpened?"Último registro aberto neste navegador"
    :latestEvent?"Última movimentação entre os eventos carregados do Core":null;
  const resumeCheckpoint=resumeItem
    ? history.find(event=>event.workstream_id===resumeItem.id)
    : undefined;
  const resumeCheckpointSummary=resumeCheckpoint? summarizeDevelopmentCheckpoint(resumeCheckpoint):null;
  const moduleOptions=items.filter(item=>item.kind==="modulo"&&item.code!=="NUC");
  const specialistOptions=Array.from(new Set(
    items.filter(item=>item.kind!=="modulo"&&item.code!=="NUC")
      .map(item=>item.specialist.trim()).filter(Boolean)
  )).sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const attention=items.filter(item=>item.kind!=="modulo"&&item.code!=="NUC");
  const blocked=attention.filter(item=>item.status==="bloqueado").length;
  const validating=attention.filter(item=>item.status==="em_validacao").length;
  const active=attention.filter(item=>item.status==="em_andamento").length;
  // A raiz NUC integra o total M3, mas não é uma frente operacional.
  const governanceRootCount = visible.filter(item => item.code === "NUC").length;
  const allOperationalVisible = visible.filter(item =>
    item.code !== "NUC" && item.kind !== "modulo"
    && (!moduleFocusId || moduleIdForWorkstream(item,byId)===moduleFocusId)
    && (!specialistFocus || item.specialist.trim()===specialistFocus)
  );
  const operationalVisible = allOperationalVisible.filter(item => !attentionStatus || item.status === attentionStatus);
  const sortedOperational = useMemo(() => {
    const priorityRank: Record<Priority,number> = {critica:0,alta:1,normal:2,baixa:3};
    const stateRank: Record<DevelopmentStatus,number> = {
      bloqueado:0,em_andamento:1,em_validacao:2,planejado:3,concluido:4,
    };
    return [...operationalVisible].sort((a,b)=>
      stateRank[a.status] - stateRank[b.status] ||
      priorityRank[a.priority] - priorityRank[b.priority] ||
      a.code.localeCompare(b.code, "pt-BR"));
  }, [visible,attentionStatus,moduleFocusId,specialistFocus]);

  const choose = (id: string): boolean => {
    if (id === selectedId) return true;
    if (saving) {
      toast.warning("Aguarde a conclusão do registro antes de trocar de frente.");
      return false;
    }
    if (hasPendingChanges && !window.confirm(
      "Há alterações não salvas nesta frente. Descartá-las e abrir outra frente?"
    )) return false;
    setSelectedId(id);
    setLastOpenedId(id);
    if(session?.user?.id){
      try {window.localStorage.setItem("nucleo-last-opened:"+session.user.id,id);}
      catch {/* A navegação não depende do armazenamento local. */}
    }
    setDependencyTarget("");
    const item = byId.get(id);
    setEdit(item ? {
      title:item.title,description:item.description,specialist:item.specialist,
      status:item.status, priority:item.priority,next_action:item.next_action,
      blocker:item.blocker,acceptance_criteria:item.acceptance_criteria,
      evidence_state:item.evidence_state,evidence_note:item.evidence_note,
    } : {});
    return true;
  };

  const addItem = async () => {
    if (readError || loading) { toast.error("Atualize a leitura M3 antes de registrar."); return; }
    if (saving) return;
    if (!draft.code || draft.title.trim().length < 3 || (draft.kind !== "modulo" && !draft.parent_id)) {
      toast.error("Informe código, título e frente pai quando necessário."); return;
    }
    setSaving(true);
    const { error } = await client.from("nucleo_development_workstreams").insert({
      code: draft.code, title: draft.title.trim(), kind: draft.kind,
      parent_id: draft.parent_id || null, description: draft.description,
      specialist: draft.specialist, acceptance_criteria: draft.acceptance_criteria,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Frente registrada, com histórico auditável.");
    setCreating(false);
    setDraft(emptyDraft);
    await refresh();
  };

  const addDependency = async () => {
    if (!selected || !dependencyTarget || dependencyTarget === selected.id || saving) return;
    setSaving(true);
    const { error } = await client.from("nucleo_development_dependencies").insert({
      workstream_id: selected.id, depends_on_id: dependencyTarget,
      description: "Dependência declarada para acompanhamento",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Dependência adicionada sem substituir as anteriores.");
    setDependencyTarget("");
    await refresh();
  };

  const saveItem = async () => {
    if (!selected || saving) return;
    const changes = changedEditableFields(selected, edit);
    if (Object.keys(changes).length === 0) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }
    if (edit.status === "concluido" &&
      (edit.evidence_state !== "comprovada" || !edit.evidence_note?.trim())) {
      toast.error("Para concluir, registre evidência comprovada e sua descrição."); return;
    }
    if (edit.status === "bloqueado" && !edit.blocker?.trim()) {
      toast.error("Indique o motivo do bloqueio."); return;
    }
    setSaving(true);
    const { data, error } = await client.from("nucleo_development_workstreams")
      .update(changes).eq("id",selected.id).eq("updated_at",selected.updated_at)
      .select("id").maybeSingle();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if (!data) {
      toast.error("O registro mudou desde a abertura. Atualize e confira antes de salvar.");
      await refresh();
      return;
    }
    // Só confirmar sucesso quando o Core devolver o registro salvo E a trilha de auditoria.
    // Se houver erro/concorrência na leitura, não prometer um histórico que não vimos.
    const [readback, audit] = await Promise.all([
      client.from("nucleo_development_workstreams")
        .select("*").eq("id", selected.id).maybeSingle(),
      client.from("nucleo_development_events")
        .select("event_type,before_state,after_state")
        .eq("workstream_id", selected.id)
        .order("recorded_at", { ascending: false })
        .limit(1).maybeSingle(),
    ]);
    const saved = readback.data as DevelopmentWorkstream | null;
    const after = audit.data?.after_state as Record<string, unknown> | null | undefined;
    const persisted = !!saved && Object.entries(changes).every(([key, value]) =>
      (saved as unknown as Record<string, unknown>)[key] === value);
    const audited = audit.data?.event_type === "alterado" && !!after &&
      Object.entries(changes).every(([key, value]) => after[key] === value);
    if (readback.error || audit.error || !persisted || !audited) {
      toast.warning("Alteração enviada, mas a gravação ou o histórico não pôde ser confirmado. Atualize e confira a ficha.");
      await refresh();
      return;
    }
    toast.success("Atualização salva e histórico confirmado.");
    await refresh();
  };

  if (!authorized) return (
    <Card className="p-5">
      <h2 className="font-semibold">Central Visual de Desenvolvimento</h2>
      <p className="text-sm text-muted-foreground mt-2">
        Acompanhamento restrito. Acesso depende de uma concessão individual ativa de
        nucleo_manage; nenhuma permissão é concedida automaticamente.
      </p>
    </Card>
  );

  if (loading) return (
    <Card className="p-5" role="status" aria-live="polite">
      <h2 className="font-semibold">Central Visual de Desenvolvimento</h2>
      <p className="text-sm text-muted-foreground mt-2">Consultando módulos, frentes e histórico autorizados no Core M3…</p>
    </Card>
  );

  if (readError) return (
    <Card className="p-5 space-y-3" role="alert">
      <h2 className="font-semibold">Leitura da Central indisponível</h2>
      <p className="text-sm text-muted-foreground">
        Os registros M3 ou seu histórico não puderam ser consultados nesta sessão.
        A cobertura, as contagens e os vínculos estão indeterminados — não significa que
        os módulos tenham sido apagados ou que não existam frentes.
      </p>
      <Button type="button" variant="outline" onClick={()=>void refresh()}>Tentar leitura novamente</Button>
    </Card>
  );

  const resumeFront=(id:string)=>{
    if(!choose(id))return;
    setFilter("");
    setAttentionStatus(null);
    setModuleFocusId("");
    setSpecialistFocus("");
    setWorkspaceView("frentes");
    requestAnimationFrame(()=>document.getElementById("nucleo-m3-workstream-detail")?.scrollIntoView({behavior:"smooth",block:"start"}));
  };
  const toggleAtlas=()=>{setAtlasVisited(true);setAtlasExpanded(open=>!open);};
  const prepareModule = (module:KnowledgeModule) => {
    const registered=items.find(item=>item.kind==="modulo"&&item.code===module.id);
    if(registered){
      if (!choose(registered.id)) return;
      setFilter("");
      setAttentionStatus(null);
      setModuleFocusId("");
      setSpecialistFocus("");
      setWorkspaceView("frentes");
      toast.info("Este módulo já está cadastrado no Core M3.");
      requestAnimationFrame(()=>document.getElementById("nucleo-m3-workstream-detail")?.scrollIntoView({behavior:"smooth",block:"start"}));
      return;
    }
    // Preenche somente identidade presente no inventário. Nunca inventa
    // método, especialista, escopo, estado, frente ou certificação.
    setDraft({...emptyDraft,code:cleanCode(module.id),title:module.name,kind:"modulo"});
    setWorkspaceView("frentes");
    setCreating(true);
    requestAnimationFrame(()=>document.getElementById("nucleo-m3-create-module")?.scrollIntoView({behavior:"smooth",block:"start"}));
  };

  return (
    <div className="space-y-4" aria-label="Central Visual de Desenvolvimento">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="font-semibold text-lg">Central Visual de Desenvolvimento</h2>
          <p className="text-xs text-muted-foreground">
            Acompanhe as frentes do Core, retome o trabalho registrado e abra detalhes quando precisar.
          </p>
        </div>
        <Button type="button" size="sm" className="nucleo-v22-primary-button" onClick={() => {
          if (workspaceView === "frentes" && creating) setCreating(false);
          else {
            setWorkspaceView("frentes");
            setCreating(true);
            requestAnimationFrame(()=>document.getElementById("nucleo-m3-create-module")?.scrollIntoView({behavior:"smooth",block:"start"}));
          }
        }}>{workspaceView === "frentes" && creating ? "Fechar cadastro" : "+ Nova frente"}</Button>
      </div>

      <nav className="nucleo-v22-tabs flex flex-wrap" aria-label="Áreas da Central Visual">
        <Button type="button" size="sm" className="nucleo-v22-pill" variant={workspaceView === "geral" ? "default" : "outline"}
          aria-pressed={workspaceView === "geral"} onClick={() => setWorkspaceView("geral")}>
          Visão Geral e módulos
        </Button>
        <Button type="button" size="sm" className="nucleo-v22-pill" variant={workspaceView === "frentes" ? "default" : "outline"}
          aria-pressed={workspaceView === "frentes"} onClick={() => setWorkspaceView("frentes")}>
          Frentes e acompanhamento
        </Button>
      </nav>

      {/* Entrada resumida; Atlas detalhado só é montado quando solicitado. */}
      <div hidden={workspaceView !== "geral"} className={workspaceView === "geral" ? "space-y-4" : "hidden"}
        aria-hidden={workspaceView !== "geral"}>
        <section className="space-y-3" aria-label="Início do acompanhamento do Núcleo">
          <div className="rounded-2xl border border-[#d2e3fc] bg-[#e8f0fe] p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <p className="text-xs font-bold text-[#174ea6] dark:text-blue-200">CENTRAL VISUAL / INÍCIO</p>
            <h3 className="mt-1 text-xl font-bold text-[#202124] dark:text-slate-50">Onde estamos e como continuar</h3>
            <p className="mt-1 text-sm text-[#3c4043] dark:text-slate-200">
              Resumo do Core M3 e da navegação deste navegador. Não indica homologação, vigência nem publicação.
            </p>
            <p className="mt-2 text-xs text-[#5f6368] dark:text-slate-300">
              Última leitura M3 nesta sessão: {lastReadAt ? new Date(lastReadAt).toLocaleString("pt-BR") : "não verificada"}.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="rounded-2xl border-[#dce5f1] p-4 dark:border-slate-700" aria-label="De onde continuar">
              <h4 className="text-sm font-semibold">De onde continuar</h4>
              {resumeItem ? <div className="mt-2 space-y-2">
                <p className="text-xs font-medium text-[#174ea6] dark:text-blue-300">{resumeSource}</p>
                <h5 className="break-words text-base font-semibold">{resumeItem.code} · {resumeItem.title}</h5>
                <p className="text-sm text-muted-foreground">
                  Situação: <strong>{states.find(v=>v.key===resumeItem.status)?.label}</strong>
                  {" · "}Atualizada em {new Date(resumeItem.updated_at).toLocaleString("pt-BR")}
                </p>
                <p className="break-words rounded-xl bg-[#f5f9ff] p-3 text-sm dark:bg-slate-800">
                  <strong>Próxima ação registrada:</strong>{" "}
                  {resumeItem.next_action?.trim()||"Nenhuma próxima ação registrada nesta frente."}
                </p>
                <div className="rounded-xl border p-3 space-y-1" aria-label="Último checkpoint M3 localizado">
                  <p className="text-xs font-semibold">Último checkpoint M3 localizado nesta leitura</p>
                  {resumeCheckpoint && resumeCheckpointSummary ? <>
                    <p className="text-sm">{resumeCheckpointSummary.label} · {new Date(resumeCheckpoint.recorded_at).toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground">
                      {resumeCheckpointSummary.changes.length>0
                        ? resumeCheckpointSummary.changes.slice(0,2).map(change=>change.field+": "+change.after).join(" · ")
                        : "Este evento não contém campos comparáveis para resumir."}
                    </p>
                    <p className="text-xs text-muted-foreground">Evento administrativo; não equivale a aceite, deploy ou homologação.</p>
                  </> : <p className="text-xs text-muted-foreground">
                    Nenhum evento desta frente localizado na janela global de 200 registros. Histórico anterior pode existir.
                  </p>}
                </div>
                {resumeItem.status==="bloqueado"&&<p className="text-sm text-rose-800 dark:text-rose-200">
                  <strong>Bloqueio:</strong> {resumeItem.blocker?.trim()||"Motivo não informado"}
                </p>}
                <Button type="button" className="min-h-11 rounded-full bg-[#1a73e8] px-5 text-white hover:bg-[#185abc]"
                  onClick={()=>resumeFront(resumeItem.id)}>Continuar nesta frente</Button>
              </div>:<div className="mt-2 space-y-3">
                <p className="text-sm text-muted-foreground">Nenhum registro anterior identificado neste navegador ou no recorte de eventos carregados.</p>
                <Button type="button" variant="outline" className="min-h-11 rounded-full" onClick={()=>setWorkspaceView("frentes")}>
                  Escolher uma frente
                </Button>
              </div>}
            </Card>
            <Card className="rounded-2xl border-[#dce5f1] p-4 dark:border-slate-700" aria-label="Situação das frentes registradas no Core">
              <h4 className="text-sm font-semibold">O que precisa de atenção</h4>
              <p className="mt-1 text-sm text-muted-foreground">Frentes e subfrentes M3 carregadas, sem módulos-raiz. Não é inventário global.</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button type="button" aria-label="Ver frentes: Bloqueadas"
                  onClick={()=>{setFilter("");setModuleFocusId("");setSpecialistFocus("");setAttentionStatus("bloqueado");setWorkspaceView("frentes");}}
                  className="min-h-20 rounded-xl border border-rose-200 bg-rose-50 p-3 text-center transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 dark:border-rose-800 dark:bg-rose-950/20">
                  <p className="text-2xl font-bold tabular-nums text-rose-800 dark:text-rose-200">{blocked}</p>
                  <p className="text-xs font-semibold text-rose-950 dark:text-rose-100">Bloqueadas</p>
                </button>
                <button type="button" aria-label="Ver frentes: Em validação"
                  onClick={()=>{setFilter("");setModuleFocusId("");setSpecialistFocus("");setAttentionStatus("em_validacao");setWorkspaceView("frentes");}}
                  className="min-h-20 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 dark:border-amber-800 dark:bg-amber-950/20">
                  <p className="text-2xl font-bold tabular-nums text-amber-800 dark:text-amber-200">{validating}</p>
                  <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">Em validação</p>
                </button>
                <button type="button" aria-label="Ver frentes: Em andamento"
                  onClick={()=>{setFilter("");setModuleFocusId("");setSpecialistFocus("");setAttentionStatus("em_andamento");setWorkspaceView("frentes");}}
                  className="min-h-20 rounded-xl border border-blue-200 bg-blue-50 p-3 text-center transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 dark:border-blue-800 dark:bg-blue-950/20">
                  <p className="text-2xl font-bold tabular-nums text-blue-800 dark:text-blue-200">{active}</p>
                  <p className="text-xs font-semibold text-blue-950 dark:text-blue-100">Em andamento</p>
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Selecione uma situação para ver as frentes correspondentes. As cores não certificam aprovação.</p>
              <Button type="button" variant="outline" className="mt-3 min-h-11 rounded-full border-[#1a73e8] text-[#174ea6] hover:bg-[#e8f0fe]"
                onClick={()=>setWorkspaceView("frentes")}>Ver frentes e próximas ações</Button>
            </Card>
          </div>
          <NucleoPanoramaDinV30 workstreams={items}
            onFocusModule={moduleId=>{
              setFilter("");
              setAttentionStatus(null);
              setSpecialistFocus("");
              setModuleFocusId(moduleId);
              setWorkspaceView("frentes");
            }}
            onFocusStatus={status=>{
              setFilter("");
              setModuleFocusId("");
              setSpecialistFocus("");
              setAttentionStatus(status);
              setWorkspaceView("frentes");
            }}/>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce5f1] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <div>
              <h4 className="text-sm font-semibold">Precisa explorar um módulo?</h4>
              <p className="text-xs text-muted-foreground">Consulte especialistas, Ficha Viva e documentação no Atlas detalhado.</p>
            </div>
            <Button type="button" variant="outline" className="min-h-11 rounded-full"
              aria-expanded={atlasExpanded} aria-controls="nucleo-atlas-completo" onClick={toggleAtlas}>
              {atlasExpanded?"Recolher módulos":"Explorar módulos"}
            </Button>
          </div>
        </section>
        <div id="nucleo-atlas-completo" hidden={!atlasExpanded} aria-hidden={!atlasExpanded}
          className={atlasExpanded?"space-y-4":"hidden"}>
          {atlasVisited&&<NucleoOperationalAtlas workstreams={items} dependencies={dependencies} events={history}
            onPrepareModule={prepareModule}
            onSelectWorkstream={id => {
              if (!choose(id)) return;
              setWorkspaceView("frentes");
              requestAnimationFrame(()=>document.getElementById("nucleo-m3-workstream-detail")?.scrollIntoView({behavior:"smooth",block:"start"}));
            }}/>}
        </div>
      </div>
      <div hidden={workspaceView !== "frentes"} className={workspaceView === "frentes" ? "space-y-4" : "hidden"}
        aria-hidden={workspaceView !== "frentes"}>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dce5f1] bg-[#f7faff] p-3 dark:border-slate-700 dark:bg-slate-800">
          <div>
            <p className="text-sm font-semibold">Análise executiva detalhada</p>
            <p className="text-xs text-muted-foreground">Prioridades, pendências e checkpoints; abra somente quando precisar.</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="min-h-10 rounded-full"
            aria-expanded={executiveExpanded} aria-controls="nucleo-din-executive"
            onClick={() => {setExecutiveVisited(true);setExecutiveExpanded(v=>!v);}}>
            {executiveExpanded?"Recolher análise":"Abrir análise"}
          </Button>
        </div>
        <div id="nucleo-din-executive" hidden={!executiveExpanded} className={executiveExpanded?"":"hidden"}>
          {executiveVisited&&<NucleoExecutiveDevelopment workstreams={items} dependencies={dependencies}
            events={history} onOpenWorkstream={id=>{
              if (!choose(id)) return;
              setFilter("");
              setAttentionStatus(null);
              setModuleFocusId("");
              setSpecialistFocus("");
              requestAnimationFrame(()=>document.getElementById("nucleo-m3-workstream-detail")?.scrollIntoView({behavior:"smooth",block:"start"}));
            }}/>}
        </div>

      {creating && (
        <Card id="nucleo-m3-create-module" className="p-4 space-y-3 scroll-mt-24">
          <h3 className="font-semibold text-sm">Cadastrar módulo, frente ou subfrente</h3>
          <p className="text-xs text-muted-foreground">Pré-preenchimento vindo do inventário não é certificação nem cadastro. Revise código, escopo e fonte original antes de clicar em Salvar. Não cria frentes ou responsáveis automaticamente.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="text-xs space-y-1">Código estável
              <Input value={draft.code} placeholder="NUC-M3-F1" onChange={e => setDraft(v => ({...v,code:cleanCode(e.target.value)}))}/>
            </label>
            <label className="text-xs space-y-1">Título
              <Input value={draft.title} onChange={e => setDraft(v => ({...v,title:e.target.value}))}/>
            </label>
            <label className="text-xs space-y-1">Tipo
              <select className="block w-full rounded-md border bg-background p-2" value={draft.kind}
                onChange={e => setDraft(v => ({...v,kind:e.target.value as DevelopmentKind,parent_id:""}))}>
                <option value="modulo">Módulo</option>
                <option value="frente">Frente</option>
                <option value="subfrente">Subfrente</option>
              </select>
            </label>
            <label className="text-xs space-y-1">Pai
              <select className="block w-full rounded-md border bg-background p-2" disabled={draft.kind==="modulo"} value={draft.parent_id}
                onChange={e => setDraft(v => ({...v,parent_id:e.target.value}))}>
                <option value="">Selecione</option>
                {items.filter(i => i.kind === (draft.kind==="frente"?"modulo":"frente")).map(i => (
                  <option key={i.id} value={i.id}>{i.code} — {i.title}</option>
                ))}
              </select>
            </label>
            <label className="text-xs space-y-1">Especialista responsável
              <Input value={draft.specialist} onChange={e => setDraft(v => ({...v,specialist:e.target.value}))}/>
            </label>
            <label className="text-xs space-y-1">Critérios de aceite
              <Input value={draft.acceptance_criteria} onChange={e => setDraft(v => ({...v,acceptance_criteria:e.target.value}))}/>
            </label>
          </div>
          <label className="text-xs space-y-1 block">Escopo original
            <Textarea value={draft.description} onChange={e => setDraft(v => ({...v,description:e.target.value}))}/>
          </label>
          <Button size="sm" disabled={saving} onClick={addItem}>Salvar sem substituir histórico</Button>
        </Card>
      )}

      <section id="nucleo-din-focus" className="scroll-mt-28 space-y-2 rounded-2xl border border-[#d2e3fc] bg-[#f5f9ff] p-3 dark:border-slate-700 dark:bg-slate-900" aria-label="Foco do acompanhamento">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Foco do acompanhamento</h3>
            <p className="text-xs text-muted-foreground">Filtre o mesmo Core M3 por módulo, especialista declarado ou situação; não altera os registros.</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="min-h-10 rounded-full"
            onClick={()=>{
              setFilter("");
              setModuleFocusId("");
              setSpecialistFocus("");
              setAttentionStatus(null);
            }}>Limpar foco</Button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,1.3fr)_auto]">
          <label className="space-y-1 text-xs font-semibold">Módulo
            <select className="min-h-11 w-full rounded-xl border border-[#d2e3fc] bg-white px-3 text-sm font-normal dark:bg-slate-800"
              value={moduleFocusId} onChange={e=>setModuleFocusId(e.target.value)}>
              <option value="">Todos os módulos</option>
              {moduleOptions.map(item=><option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold">Especialista declarado
            <select className="min-h-11 w-full rounded-xl border border-[#d2e3fc] bg-white px-3 text-sm font-normal dark:bg-slate-800"
              value={specialistFocus} onChange={e=>setSpecialistFocus(e.target.value)}>
              <option value="">Todos os especialistas</option>
              {specialistOptions.map(name=><option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold">Situação
            <select className="min-h-11 w-full rounded-xl border border-[#d2e3fc] bg-white px-3 text-sm font-normal dark:bg-slate-800"
              value={attentionStatus||""} onChange={e=>setAttentionStatus(e.target.value?(e.target.value as DevelopmentStatus):null)}>
              <option value="">Todas as situações</option>
              {states.map(state=><option key={state.key} value={state.key}>{state.label}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold">Buscar neste recorte
            <Input className="min-h-11 rounded-xl border-[#d2e3fc] bg-white text-sm" value={filter}
              onChange={e=>setFilter(e.target.value)} placeholder="Código, frente ou próxima ação"/>
          </label>
          <Button type="button" size="sm" variant="outline" className="min-h-11 self-end rounded-full"
            onClick={()=>void refresh()} disabled={loading}>Atualizar</Button>
        </div>
        {(moduleFocusId||specialistFocus||attentionStatus||filter.trim())&&
          <p role="status" className="text-xs font-semibold text-[#174ea6] dark:text-blue-300">
            Recorte ativo: {moduleFocusId?(byId.get(moduleFocusId)?.title||"Módulo indisponível"):"Todos os módulos"}
            {" · "}{specialistFocus||"Todos os especialistas"}
            {" · "}{attentionStatus?(states.find(state=>state.key===attentionStatus)?.label||"Situação"):"Todas as situações"}
            {" · "}{operationalVisible.length} frente(s)/subfrente(s) no recorte
          </p>}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div>
          <p className="text-sm font-semibold">Supervisão de dependências</p>
          <p className="text-xs text-muted-foreground">Indicadores gerais e leitura técnica disponíveis sob demanda.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-10 rounded-full"
          aria-expanded={supervisionExpanded} aria-controls="nucleo-din-supervision"
          onClick={()=>{setSupervisionVisited(true);setSupervisionExpanded(v=>!v);}}>{supervisionExpanded?"Recolher supervisão":"Abrir supervisão"}</Button>
      </div>
      <div id="nucleo-din-supervision" hidden={!supervisionExpanded} className={supervisionExpanded?"":"hidden"}>
        {supervisionVisited&&!loading && <NucleoSupervisionPanel workstreams={items} dependencies={dependencies} />}
      </div>

      <details className="rounded-2xl border border-[#dce5f1] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <summary className="min-h-10 cursor-pointer rounded-lg px-2 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]">
          Explorar árvore completa de módulos e frentes
        </summary>
        <Card className="mt-3 space-y-2 p-3">
        <h3 className="text-sm font-semibold">Árvore de módulos e frentes</h3>
        <p className="text-xs text-muted-foreground">
          Identidade numerada e relações pai–filho preservadas. Selecione qualquer item para abrir a ficha.
        </p>
        {items.filter(i => i.kind === "modulo").map(mod => (
          <div key={mod.id} className="rounded-md border px-3 py-2 space-y-1">
            <button type="button" className="text-sm font-medium hover:underline" onClick={() => choose(mod.id)}>
              {mod.code} — {mod.title}
            </button>
            {items.filter(i => i.parent_id === mod.id).map(front => (
              <div key={front.id} className="ml-3 pl-3 border-l space-y-1">
                <button type="button" className="text-xs font-medium hover:underline" onClick={() => choose(front.id)}>
                  {front.code} — {front.title}
                </button>
                {items.filter(i => i.parent_id === front.id).map(sub => (
                  <div key={sub.id} className="ml-3 pl-3 border-l">
                    <button type="button" className="text-xs hover:underline" onClick={() => choose(sub.id)}>
                      {sub.code} — {sub.title}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
        {!loading && !items.length && <p className="text-xs text-muted-foreground">Nenhuma frente cadastrada.</p>}
        </Card>
      </details>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Acompanhamento das frentes</h3>
            <p className="text-sm text-muted-foreground">
              {operationalVisible.length} frente(s)/registro(s) operacional(is)
              {governanceRootCount > 0 ? ` + ${governanceRootCount} raiz de governança NUC` : ""}.
              A raiz é exibida separadamente para evitar contagens contraditórias.
            </p>
          </div>
          <div className="inline-flex flex-wrap gap-1 rounded-lg border p-1" aria-label="Modo de visualização">
            <Button type="button" size="sm" variant={displayMode === "lista" ? "default" : "ghost"}
              aria-pressed={displayMode === "lista"} onClick={() => setDisplayMode("lista")}>
              Lista compacta
            </Button>
            <Button type="button" size="sm" variant={displayMode === "quadro" ? "default" : "ghost"}
              aria-pressed={displayMode === "quadro"} onClick={() => setDisplayMode("quadro")}>
              Quadro por estado
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {states.map(state => (
            <div className="border rounded-lg p-3" key={state.key}>
              <p className="text-xs text-muted-foreground">{state.label}</p>
              <p className="font-bold text-xl tabular-nums">
                {allOperationalVisible.filter(item => item.status === state.key).length}
              </p>
            </div>
          ))}
        </div>
        {governanceRootCount > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={() => {
            const root = visible.find(item => item.code === "NUC");
            if (root) {
              if (!choose(root.id)) return;
              document.getElementById("nucleo-m3-workstream-detail")
                ?.scrollIntoView({behavior:"smooth",block:"start"});
            }
          }}>
            Abrir raiz de governança NUC
          </Button>
        )}
      </div>

      {(moduleFocusId||specialistFocus||attentionStatus||filter.trim())&&(
        <NucleoFocusPreviewV30 records={sortedOperational} onOpenWorkstream={id=>{
          if (!choose(id)) return;
          requestAnimationFrame(()=>document.getElementById("nucleo-m3-workstream-detail")
            ?.scrollIntoView({behavior:"smooth",block:"start"}));
        }}/>
      )}

      {displayMode === "lista" && (
        <section aria-label="Lista compacta de frentes" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Frentes organizadas por situação e prioridade. Acesse a ficha para ler a próxima ação integral e as evidências.
          </p>
          <div className="space-y-2">
            {sortedOperational.map(item => {
              const tone: Record<DevelopmentStatus,string> = {
                planejado:"border-l-slate-400",
                em_andamento:"border-l-blue-500",
                bloqueado:"border-l-rose-500",
                em_validacao:"border-l-amber-500",
                concluido:"border-l-emerald-500",
              };
              return (
                <button type="button" key={item.id}
                  aria-pressed={selectedId === item.id}
                  onClick={() => {
                    if (!choose(item.id)) return;
                    document.getElementById("nucleo-m3-workstream-detail")
                      ?.scrollIntoView({ behavior:"smooth", block:"start" });
                  }}
                  className={`w-full text-left border border-l-4 rounded-lg p-3 md:p-4 bg-background hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors ${tone[item.status]} ${selectedId === item.id ? "ring-1 ring-primary/40" : ""}`}>
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.8fr)_auto] gap-2 md:gap-4 items-center">
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-mono text-xs font-semibold">{item.code}</span>
                        <Badge variant="outline">{states.find(state => state.key === item.status)?.label}</Badge>
                        <Badge variant="secondary">{priorityNames[item.priority]}</Badge>
                      </div>
                      <p className="font-semibold text-sm mt-1">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate" title={item.specialist}>
                        {item.kind} · {item.specialist || "Especialista não informado"}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium">Próxima ação</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.next_action || "Não registrada"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-primary md:text-right">Ver ficha completa</span>
                  </div>
                </button>
              );
            })}
            {!loading && sortedOperational.length === 0 && (
              <p className="border rounded-lg p-5 text-sm text-muted-foreground">
                Nenhuma frente corresponde ao filtro.
              </p>
            )}
          </div>
        </section>
      )}

      {displayMode === "quadro" && <section className="space-y-3 min-w-0" aria-label="Quadro de estados das frentes">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Quadro de acompanhamento</h3>
            <p className="text-sm text-muted-foreground">
              Leia o estado e a próxima ação; selecione uma frente para consultar o conteúdo completo abaixo.
            </p>
          </div>
          <Badge variant="outline">{operationalVisible.length} frente(s) no filtro</Badge>
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 items-start">
          {states.map(state => {
            const stateItems = operationalVisible.filter(item => item.status === state.key);
            const stateStyle: Record<DevelopmentStatus, string> = {
              planejado: "border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-950/20",
              em_andamento: "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20",
              bloqueado: "border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20",
              em_validacao: "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20",
              concluido: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20",
            };
            return (
              <Card className={`p-3 md:p-4 min-w-0 space-y-3 ${stateStyle[state.key]}`} key={state.key}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm">{state.label}</h3>
                  <Badge variant="secondary" className="tabular-nums">{stateItems.length}</Badge>
                </div>
                <div className="space-y-2">
                  {stateItems.map(item => (
                    <button type="button" key={item.id}
                      onClick={() => {
                        if (!choose(item.id)) return;
                        document.getElementById("nucleo-m3-workstream-detail")
                          ?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      aria-pressed={selectedId === item.id}
                      className={`text-left w-full min-w-0 p-3 rounded-lg border bg-background shadow-sm hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors ${selectedId===item.id?"border-primary ring-1 ring-primary/40":"border-border"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-semibold truncate">{item.code}</span>
                        <Badge variant="outline" className="text-[11px] shrink-0">{priorityNames[item.priority]}</Badge>
                      </div>
                      <p className="text-sm font-semibold leading-snug mt-2 line-clamp-2" title={item.title}>{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate" title={item.specialist || undefined}>
                        {item.kind} · {item.specialist || "Especialista não informado"}
                      </p>
                      {item.parent_id && <p className="text-xs text-muted-foreground mt-1">
                        Pai: {byId.get(item.parent_id)?.code || "não identificado"}
                      </p>}
                      <div className="mt-3 border-t pt-2 space-y-1">
                        <p className="text-xs font-medium text-foreground">Próxima ação</p>
                        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3"
                          title={item.next_action || "Não registrada"}>
                          {item.next_action || "Não registrada"}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Evidência: {evidenceNames[item.evidence_state]}
                      </p>
                      <p className="text-xs font-semibold text-primary mt-2">Abrir ficha completa</p>
                    </button>
                  ))}
                  {!loading && stateItems.length === 0 &&
                    <p className="text-sm text-muted-foreground py-4 text-center">Sem registros neste estado</p>}
                </div>
              </Card>
            );
          })}
        </div>
      </section>}
        <Card id="nucleo-m3-workstream-detail" className="p-4 md:p-5 space-y-4 min-w-0 scroll-mt-28 w-full">
          {!selected ? (
            <div>
              <h3 className="font-semibold text-sm">Ficha da frente</h3>
              {hasPendingChanges && <p role="status" className="text-xs font-medium text-amber-800 dark:text-amber-200">Alterações não salvas — salve antes de selecionar outra frente.</p>}
              <p className="text-xs text-muted-foreground mt-2">
                Selecione um cartão para editar acompanhamento e visualizar histórico.
                Nenhuma porcentagem é calculada sem critérios verificáveis.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-[#d2e3fc] bg-[#e8f0fe] p-3 dark:border-blue-900 dark:bg-blue-950/20">
                <p className="text-xs font-semibold text-[#174ea6] dark:text-blue-300">NÚCLEO / FOCO / EXECUÇÃO</p>
                <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs">{selected.code}</p>
                    <h3 className="break-words text-lg font-semibold">{selected.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {selected.kind} · Atualizada em {new Date(selected.updated_at).toLocaleString("pt-BR")}
                      {" · "}Situação registrada: {states.find(state=>state.key===selected.status)?.label}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="min-h-10 rounded-full"
                    onClick={()=>document.getElementById("nucleo-din-focus")?.scrollIntoView({behavior:"smooth",block:"start"})}>
                    Voltar ao foco
                  </Button>
                </div>
              </div>
              {hasPendingChanges&&<p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-950 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
                Alterações não salvas nesta frente. Salve ou confirme descarte antes de navegar para outro registro.
              </p>}
              <div className="space-y-2 rounded-xl border border-[#dce5f1] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-semibold text-[#174ea6] dark:text-blue-200">PRÓXIMA AÇÃO · EDITÁVEL</p>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {(edit.next_action||"").trim()||"Nenhuma próxima ação registrada nesta frente."}
                </p>
                <label className="block space-y-1 text-xs font-medium">Atualizar próxima ação
                  <Input className="min-h-11" value={edit.next_action||""}
                    onChange={e=>setEdit(v=>({...v,next_action:e.target.value}))}/>
                </label>
                <Button size="sm" className="min-h-10 rounded-full" disabled={saving || !hasPendingChanges} onClick={saveItem}>
                  {hasPendingChanges ? "Salvar e registrar histórico" : "Sem alterações"}
                </Button>
              </div>
              <details className="rounded-xl border border-[#dce5f1] bg-[#f8fbff] p-3 dark:border-slate-700 dark:bg-slate-900">
                <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a73e8]">
                  Editar demais dados da frente
                </summary>
                <div className="mt-3 space-y-3">
              <label className="block text-xs space-y-1">Título
                <Input value={edit.title||""} onChange={e=>setEdit(v=>({...v,title:e.target.value}))}/>
              </label>
              <label className="block text-xs space-y-1">Escopo / decisões
                <Textarea value={edit.description||""} onChange={e=>setEdit(v=>({...v,description:e.target.value}))}/>
              </label>
              <label className="block text-xs space-y-1">Especialista
                <Input value={edit.specialist||""} onChange={e=>setEdit(v=>({...v,specialist:e.target.value}))}/>
              </label>
              <label className="block text-xs space-y-1">Estado
                <select className="block w-full rounded-md border bg-background p-2" value={edit.status||"planejado"}
                  onChange={e=>setEdit(v=>({...v,status:e.target.value as DevelopmentStatus}))}>
                  {states.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              <label className="block text-xs space-y-1">Prioridade
                <select className="block w-full rounded-md border bg-background p-2" value={edit.priority||"normal"}
                  onChange={e=>setEdit(v=>({...v,priority:e.target.value as Priority}))}>
                  {Object.entries(priorityNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-xs space-y-1">Critérios de aceite
                <Textarea value={edit.acceptance_criteria||""} onChange={e=>setEdit(v=>({...v,acceptance_criteria:e.target.value}))}/>
              </label>
              <label className="block text-xs space-y-1">Motivo do bloqueio
                <Input value={edit.blocker||""} onChange={e=>setEdit(v=>({...v,blocker:e.target.value}))}/>
              </label>
              <label className="block text-xs space-y-1">Classificação da evidência
                <select className="block w-full rounded-md border bg-background p-2" value={edit.evidence_state||"sem_evidencia"}
                  onChange={e=>setEdit(v=>({...v,evidence_state:e.target.value as EvidenceState}))}>
                  {Object.entries(evidenceNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-xs space-y-1">Evidência / justificativa
                <Textarea value={edit.evidence_note||""} onChange={e=>setEdit(v=>({...v,evidence_note:e.target.value}))}/>
              </label>
                </div>
              </details>
              <section className="space-y-2 rounded-xl border border-[#dce5f1] bg-white p-3 dark:border-slate-700 dark:bg-slate-900" aria-label="Consulta de evidências técnicas M4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">Evidências técnicas M4</h4>
                    <p className="text-xs text-muted-foreground">Carregadas apenas sob solicitação; não são a classificação declarada M3.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="min-h-10 rounded-full"
                    aria-expanded={expandedEvidenceFor===selected.id}
                    onClick={()=>setExpandedEvidenceFor(current=>current===selected.id?null:selected.id)}>
                    {expandedEvidenceFor===selected.id?"Recolher provas M4":"Consultar provas M4"}
                  </Button>
                </div>
                {expandedEvidenceFor===selected.id&&<NucleoTechnicalEvidence workstreamId={selected.id} />}
              </section>
              <details className="rounded-xl border border-[#dce5f1] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <summary className="cursor-pointer text-sm font-semibold">Dependências registradas</summary>
                <div className="mt-3 space-y-2">
                {dependencies.filter(d=>d.workstream_id===selected.id).map(d=>(
                  <p key={d.id} className="text-xs">{byId.get(d.depends_on_id)?.code||"ID não disponível"} — {d.description}</p>
                ))}
                {dependencies.every(d=>d.workstream_id!==selected.id)&&
                  <p className="text-xs text-muted-foreground">Sem dependências cadastradas.</p>}
                <div className="flex items-center gap-2">
                  <select className="w-full min-w-0 rounded-md border bg-background p-2" aria-label="Selecionar dependência"
                    value={dependencyTarget} onChange={e => setDependencyTarget(e.target.value)}>
                    <option value="">Vincular dependência</option>
                    {items.filter(i => i.id!==selected.id &&
                      !dependencies.some(d=>d.workstream_id===selected.id && d.depends_on_id===i.id))
                      .map(i=><option value={i.id} key={i.id}>{i.code} — {i.title}</option>)}
                  </select>
                  <Button size="sm" variant="outline" disabled={!dependencyTarget||saving} onClick={addDependency}>Adicionar</Button>
                </div>
                </div>
              </details>
              <details className="rounded-xl border border-[#dce5f1] bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <summary className="cursor-pointer text-sm font-semibold">Histórico M3 no recorte (últimos 200 eventos globais)</summary>
                <div className="mt-3 space-y-2">
                {selectedHistory.map(event=>(
                  <div key={event.id} className="text-xs border-l-2 pl-2">
                    <p>{event.event_type} — {new Date(event.recorded_at).toLocaleString("pt-BR")}</p>
                    <p className="text-muted-foreground">Histórico preservado no Core</p>
                  </div>
                ))}
                {!selectedHistory.length&&<p className="text-xs text-muted-foreground">Nenhum evento carregado; registros anteriores podem existir.</p>}
                </div>
              </details>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
