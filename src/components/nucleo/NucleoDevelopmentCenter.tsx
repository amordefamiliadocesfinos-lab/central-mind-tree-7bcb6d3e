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
  const [items, setItems] = useState<DevelopmentWorkstream[]>([]);
  const [dependencies, setDependencies] = useState<DevelopmentDependency[]>([]);
  const [history, setHistory] = useState<DevelopmentEvent[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("");
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
      toast.error("Não foi possível consultar o acompanhamento M3.");
    } else {
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

  const byId = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);
  const selected = byId.get(selectedId);
  const pendingChanges = useMemo(
    () => selected ? changedEditableFields(selected, edit) : {},
    [selected, edit],
  );
  const hasPendingChanges = Object.keys(pendingChanges).length > 0;
  const visible = useMemo(() => {
    const term = filter.toLocaleLowerCase("pt-BR").trim();
    return items.filter(item => !term || [item.code,item.title,item.specialist,item.next_action]
      .some(value => value.toLocaleLowerCase("pt-BR").includes(term)));
  }, [items, filter]);
  const selectedHistory = useMemo(() => history.filter(event => event.workstream_id === selectedId), [history, selectedId]);

  const choose = (id: string) => {
    setSelectedId(id);
    setDependencyTarget("");
    const item = byId.get(id);
    setEdit(item ? {
      title:item.title,description:item.description,specialist:item.specialist,
      status:item.status, priority:item.priority,next_action:item.next_action,
      blocker:item.blocker,acceptance_criteria:item.acceptance_criteria,
      evidence_state:item.evidence_state,evidence_note:item.evidence_note,
    } : {});
  };

  const addItem = async () => {
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
    toast.success("Atualização auditada.");
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

  return (
    <div className="space-y-4" aria-label="Central Visual de Desenvolvimento">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="font-semibold text-lg">Central Visual de Desenvolvimento</h2>
          <p className="text-xs text-muted-foreground">
            Estados declarados e histórico auditável; evidências técnicas do GitHub e do Supabase serão vinculadas na M4.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(value => !value)}>{creating ? "Fechar" : "+ Nova frente"}</Button>
      </div>

      {creating && (
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">Cadastrar módulo, frente ou subfrente</h3>
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

      <div className="flex items-center gap-2">
        <Input className="max-w-md" value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filtrar código, especialista, frente ou próxima ação"/>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>Atualizar</Button>
      </div>

      <Card className="p-3 space-y-2">
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

      <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
        {states.map(state => (
          <div className="border rounded-lg p-3" key={state.key}>
            <p className="text-xs text-muted-foreground">{state.label}</p>
            <p className="font-bold text-xl">{visible.filter(item => item.status===state.key).length}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 min-[1400px]:grid-cols-[minmax(0,1fr)_minmax(350px,400px)] gap-4 items-start">
        <div className="min-w-0 overflow-x-auto pb-2">
          <div className="grid grid-cols-5 gap-3 min-w-[1100px] items-start">
          {states.map(state => (
            <Card className="p-3 space-y-2" key={state.key}>
              <h3 className="font-semibold text-sm">{state.label}</h3>
              {visible.filter(item => item.status === state.key).map(item => (
                <button type="button" key={item.id} onClick={() => choose(item.id)}
                  className={`text-left w-full p-3 rounded-lg border hover:bg-accent/50 ${selectedId===item.id?"border-primary":"border-border"}`}>
                  <div className="flex justify-between gap-2">
                    <span className="text-xs font-mono">{item.code}</span>
                    <Badge variant="outline" className="text-[10px]">{priorityNames[item.priority]}</Badge>
                  </div>
                  <p className="text-sm font-medium mt-1">{item.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{item.kind} · {item.specialist || "Sem especialista"}</p>
                  {item.parent_id && <p className="text-[11px] text-muted-foreground mt-1">
                    Pai: {byId.get(item.parent_id)?.code || "não identificado"}
                  </p>}
                  {item.next_action && <p className="text-[11px] mt-2">Próxima ação: {item.next_action}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">{evidenceNames[item.evidence_state]}</p>
                </button>
              ))}
              {!loading && visible.every(item => item.status !== state.key) &&
                <p className="text-xs text-muted-foreground">Sem registros</p>}
            </Card>
          ))}
          </div>
        </div>
        <Card className="p-4 space-y-3 min-w-0">
          {!selected ? (
            <div>
              <h3 className="font-semibold text-sm">Ficha da frente</h3>
              <p className="text-xs text-muted-foreground mt-2">
                Selecione um cartão para editar acompanhamento e visualizar histórico.
                Nenhuma porcentagem é calculada sem critérios verificáveis.
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs font-mono">{selected.code}</p>
                <h3 className="font-semibold">{selected.title}</h3>
                <p className="text-xs text-muted-foreground">{selected.kind} · {new Date(selected.updated_at).toLocaleDateString("pt-BR")}</p>
              </div>
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
              <label className="block text-xs space-y-1">Próxima ação
                <Input value={edit.next_action||""} onChange={e=>setEdit(v=>({...v,next_action:e.target.value}))}/>
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
              <Button size="sm" disabled={saving || !hasPendingChanges} onClick={saveItem}>
                {hasPendingChanges ? "Salvar e registrar histórico" : "Sem alterações"}
              </Button>
              <NucleoTechnicalEvidence workstreamId={selected.id} />
              <div className="border-t pt-3 space-y-2">
                <h4 className="text-xs font-semibold">Dependências registradas</h4>
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
                <h4 className="text-xs font-semibold pt-2">Linha do tempo (últimos 200 eventos globais)</h4>
                {selectedHistory.map(event=>(
                  <div key={event.id} className="text-xs border-l-2 pl-2">
                    <p>{event.event_type} — {new Date(event.recorded_at).toLocaleString("pt-BR")}</p>
                    <p className="text-muted-foreground">Histórico preservado no Core</p>
                  </div>
                ))}
                {!selectedHistory.length&&<p className="text-xs text-muted-foreground">Nenhum evento carregado.</p>}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
