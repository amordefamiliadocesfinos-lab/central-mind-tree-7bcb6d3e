import { useMemo, useState } from "react";
import type { DevelopmentEvent, DevelopmentWorkstream } from "@/lib/nucleo/development.types";
import { Button } from "@/components/ui/button";

type Filter = "todos" | "direcao" | "evidencia" | "responsabilidade" | "outros";
const fields = [
  { key: "next_action", label: "Próxima ação", group: "direcao" },
  { key: "status", label: "Estado da frente", group: "direcao" },
  { key: "priority", label: "Prioridade declarada", group: "direcao" },
  { key: "blocker", label: "Bloqueio", group: "direcao" },
  { key: "evidence_state", label: "Estado da evidência", group: "evidencia" },
  { key: "evidence_note", label: "Nota da evidência", group: "evidencia" },
  { key: "acceptance_criteria", label: "Critério de aceite", group: "evidencia" },
  { key: "specialist", label: "Responsável declarado", group: "responsabilidade" },
] as const;
type Change = { label: string; before: string; after: string; group: Exclude<Filter, "todos" | "outros"> };
type TimelineRow = { event: DevelopmentEvent; front: DevelopmentWorkstream; changes: Change[]; group: Filter };

const normalized = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

interface Props {
  module: DevelopmentWorkstream;
  workstreams: DevelopmentWorkstream[];
  events: DevelopmentEvent[];
  onOpenWorkstream: (id: string) => void;
  onOpenDocuments: () => void;
  onOpenMandates: () => void;
}

/**
 * P4-A: somente os eventos administrativos M3 autorizados, com comparação
 * restrita a campos públicos da ficha de governança. Não reconstrói decisões
 * da Camada Mestre nem substitui versões documentais AC-01/mandatos.
 */
export default function NucleoContinuityTimeline({
  module, workstreams, events, onOpenWorkstream, onOpenDocuments, onOpenMandates,
}: Props) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [limit, setLimit] = useState(10);
  const rows = useMemo(() => {
    const fronts = workstreams.filter(item => item.kind === "frente" && item.parent_id === module.id);
    const children = fronts.flatMap(front =>
      workstreams.filter(item => item.kind === "subfrente" && item.parent_id === front.id));
    const scope = new Map([module, ...fronts, ...children].map(item => [item.id, item]));
    return events
      .filter(event => scope.has(event.workstream_id))
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at) || b.id.localeCompare(a.id))
      .map(event => {
        const front = scope.get(event.workstream_id);
        if (!front) return null;
        const changes: Change[] = fields.flatMap(field => {
          const before = event.before_state?.[field.key];
          const after = event.after_state?.[field.key];
          if (event.event_type !== "alterado" || typeof before !== "string" ||
              typeof after !== "string" || before.trim() === after.trim()) return [];
          return [{ label: field.label, before: normalized(before), after: normalized(after),
            group: field.group }];
        });
        const group: Filter = event.event_type === "criado" ? "outros"
          : changes.some(item => item.group === "direcao") ? "direcao"
          : changes.some(item => item.group === "evidencia") ? "evidencia"
          : changes.some(item => item.group === "responsabilidade") ? "responsabilidade"
          : "outros";
        return { event, front, changes, group } as TimelineRow;
      })
      .filter((row): row is TimelineRow => row !== null);
  }, [module.id, workstreams, events]);
  const filtered = rows.filter(row => filter === "todos" || row.group === filter ||
    row.changes.some(change => change.group === filter));
  const displayed = filtered.slice(0, limit);
  return <section aria-label="P4-A — linha do tempo documental e operacional"
    className="rounded-xl border p-3 space-y-3">
    <div className="space-y-1">
      <h4 className="text-sm font-semibold">P4-A · Linha do tempo de continuidade</h4>
      <p className="text-xs text-muted-foreground">
        Eventos administrativos M3 vinculados ao módulo, às frentes e subfrentes cadastradas.
        Fonte: janela global autorizada de até 200 eventos carregados. Esta linha do tempo
        não representa histórico completo, decisões soberanas, aprovação documental ou implantação.
      </p>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Filtrar linha do tempo">
      {([
        ["todos", "Todos"], ["direcao", "Direção e bloqueios"],
        ["evidencia", "Evidências e aceite"], ["responsabilidade", "Responsabilidade"],
        ["outros", "Criações e outros"],
      ] as const).map(([value, label]) =>
        <Button key={value} type="button" variant={filter === value ? "default" : "outline"}
          aria-pressed={filter === value} size="sm"
          onClick={() => { setFilter(value); setLimit(10); }}>{label}</Button>)}
    </div>
    <p className="text-xs text-muted-foreground">
      {rows.length} evento(s) M3 localizado(s) neste recorte · {filtered.length} no filtro.
      O histórico documental AC-01 e as autorizações possuem fontes independentes.
    </p>
    {filtered.length === 0
      ? <p className="text-xs text-muted-foreground">
          Nenhum evento localizado neste filtro e na janela disponível; não significa ausência
          de decisões ou de registros anteriores.
        </p>
      : <ol className="space-y-2">
          {displayed.map(({ event, front, changes }) => <li key={event.id}
            className="rounded-lg border p-3 space-y-2 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold">{front.code} · {front.title}</p>
              <span className="text-muted-foreground">
                {new Date(event.recorded_at).toLocaleString("pt-BR")} · {event.event_type}
              </span>
            </div>
            <p className="text-muted-foreground">
              Origem: evento M3 · frente: {front.kind} · identificador de evento: {event.id}
            </p>
            {changes.length > 0
              ? <div className="space-y-2">
                  {changes.map(change => <div key={change.label} className="rounded-md bg-muted/40 p-2 space-y-1">
                    <p className="font-medium">{change.label}</p>
                    <p className="break-words"><strong>Antes:</strong> {change.before || "Campo vazio"}</p>
                    <p className="break-words"><strong>Depois:</strong> {change.after || "Campo vazio"}</p>
                  </div>)}
                </div>
              : <p className="text-muted-foreground">
                  {event.event_type === "criado"
                    ? "Criação registrada; não há versão anterior para comparação."
                    : "Sem diferença verificável nos campos de acompanhamento selecionados."}
                </p>}
            <Button type="button" size="sm" variant="outline"
              onClick={() => onOpenWorkstream(front.id)}>Abrir ficha M3 vinculada</Button>
          </li>)}
        </ol>}
    {filtered.length > displayed.length && <Button type="button" variant="outline" size="sm"
      onClick={() => setLimit(current => current + 10)}>
      Mostrar mais {Math.min(10, filtered.length - displayed.length)} evento(s)
    </Button>}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onOpenDocuments}>
        Consultar origem e versões AC-01
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onOpenMandates}>
        Conferir autoridade e mandatos
      </Button>
    </div>
    <p className="text-xs text-muted-foreground">
      Mudança de ação, estado, responsável, evidência ou critério é registro operacional,
      não uma decisão formal da Camada Mestre. Antes de retomar trabalho ou homologar,
      confronte AC-01, autoridade e evidências M4. Nenhuma consulta cria checkpoint.
    </p>
  </section>;
}
