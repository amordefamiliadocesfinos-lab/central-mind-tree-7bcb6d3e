import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DevelopmentWorkstream } from "@/lib/nucleo/development.types";
import { BookOpen, ExternalLink, Layers, Search, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CRM_ACTIONS, CRM_JOURNEY, CRM_REFERENCE, CRM_SCREENS, MODULES_V12,
  type KnowledgeModule,
} from "@/lib/nucleo/operationalKnowledgeV12";

type Level = "overview" | "module" | "operation";
const confidenceLabels = {
  codigo_verificado: "Verificado no código",
  declarado: "Declarado, a conciliar",
  nao_verificado: "Não verificado",
};

/** V1.2: descoberta orientada, sem escrita em outras frentes ou cópia documental. */
interface Props {
  workstreams: DevelopmentWorkstream[];
  onSelectWorkstream: (id: string) => void;
}

export default function NucleoOperationalAtlas({ workstreams, onSelectWorkstream }: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("overview");
  const [actionSearch, setActionSearch] = useState("");
  const modules = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return MODULES_V12.filter(item => !term ||
      [item.name, item.domain, item.id].some(value => value.toLocaleLowerCase("pt-BR").includes(term)));
  }, [search]);
  const selected = MODULES_V12.find(item => item.id === selectedId) ?? null;
  const crmRoot = workstreams.find(item => item.code === "CRM" && item.kind === "modulo");
  const crmFronts = crmRoot ? workstreams.filter(item => item.parent_id === crmRoot.id) : [];
  const actions = useMemo(() => {
    const term = actionSearch.trim().toLocaleLowerCase("pt-BR");
    return CRM_ACTIONS.filter(action => !term ||
      [action.label, action.screen, action.expectedEffect].some(value => value.toLocaleLowerCase("pt-BR").includes(term)));
  }, [actionSearch]);
  const choose = (item: KnowledgeModule) => {
    setSelectedId(item.id);
    setLevel("module");
    setActionSearch("");
  };

  return (
    <section className="space-y-3" aria-label="Atlas operacional do Painel Central — piloto V1.2">
      <Card className="p-4 md:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" aria-hidden="true" />
              <h2 className="text-base font-semibold">Painel Central — módulos e operação</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Primeiro inventário navegável V1.2. Cada ficha separa código verificado, declaração e lacunas.
            </p>
          </div>
          <Badge variant="outline">Piloto — cobertura parcial</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Níveis de navegação">
          <Button size="sm" variant={level==="overview"?"default":"outline"} onClick={() => { setLevel("overview"); setSelectedId(null); }}>1. Visão geral</Button>
          <Button size="sm" variant={level==="module"?"default":"outline"} disabled={!selected} onClick={() => setLevel("module")}>2. Módulo</Button>
          <Button size="sm" variant={level==="operation"?"default":"outline"} disabled={!selected || selected.id!=="CRM"} onClick={() => setLevel("operation")}>3. Operação / prova</Button>
        </div>
        <div className="rounded-md border p-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          Catálogo inicial de rotas, não inventário homologado do banco. Nenhum módulo ou frente externa foi criado no Core.
          Conhecer um procedimento não autoriza a IA a executá-lo.
        </div>
      </Card>

      {level==="overview" && (
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <h3 className="font-semibold text-sm">Visão geral — módulos identificados</h3>
              <p className="text-xs text-muted-foreground">{MODULES_V12.length} entradas iniciais; rotas confirmadas apenas onde o código foi inspecionado.</p>
            </div>
            <Badge variant="secondary">Não representa progresso global</Badge>
          </div>
          <label className="relative block max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="Buscar módulo ou domínio" className="pl-9" value={search} onChange={event=>setSearch(event.target.value)}
              placeholder="Buscar CRM, Financeiro, Operações…" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map(item=>(
              <button key={item.id} type="button" onClick={()=>choose(item)}
                className="rounded-lg border p-3 text-left space-y-2 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
                  <Badge variant={item.coverage==="piloto_parcial"?"secondary":"outline"}>
                    {item.coverage==="piloto_parcial"?"Piloto parcial":"Levantamento inicial"}
                  </Badge>
                </div>
                <p className="font-semibold text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.domain} · {item.route ?? "Rota não verificada"}</p>
                <p className="text-xs">Ver ficha e fontes</p>
              </button>
            ))}
          </div>
          {modules.length===0 && <p role="status" className="text-sm text-muted-foreground">Nenhum módulo encontrado com esse filtro.</p>}
        </Card>
      )}

      {selected && level==="module" && (
        <Card className="p-4 md:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{selected.id} · {selected.domain}</p>
              <h3 className="font-semibold text-lg">{selected.name}</h3>
              <p className="text-sm mt-1">{selected.purpose}</p>
            </div>
            <Badge variant={selected.coverage==="piloto_parcial"?"secondary":"outline"}>
              {selected.coverage==="piloto_parcial"?"Ficha parcial":"Cobertura não verificada"}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="border rounded-lg p-3 space-y-2">
              <h4 className="font-medium text-sm">Acesso e responsabilidade</h4>
              <p className="text-xs">Rota: <code>{selected.route??"não verificada"}</code></p>
              <p className="text-xs">Especialista: {selected.specialist??"Vínculo não verificado"}</p>
              <p className="text-xs text-muted-foreground">{confidenceLabels[selected.specialistConfidence]}</p>
              {selected.route && <Button size="sm" asChild variant="outline"><Link to={selected.route}>Abrir módulo</Link></Button>}
            </div>
            <div className="border rounded-lg p-3 space-y-2">
              <h4 className="font-medium text-sm">Fonte e método</h4>
              <p className="text-xs">{selected.id==="CRM"?CRM_REFERENCE.method:"Método, escopo e checkpoint ainda precisam de fontes vigentes."}</p>
              {selected.source.startsWith("https://") ?
                <a href={selected.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline">
                  Conferir código de origem <ExternalLink className="h-3 w-3" aria-hidden="true"/>
                </a> :
                <p className="text-xs text-muted-foreground">{selected.source}</p>}
            </div>
          </div>
          {selected.id==="CRM" ? (
            <>
              <div className="rounded-lg border p-3 space-y-2">
                <h4 className="font-semibold text-sm">Frentes reais vinculadas no Core</h4>
                <p className="text-xs text-muted-foreground">Estado declarado pela governança, diferente de implantação, aceite e uso real.</p>
                {crmFronts.length ? crmFronts.map(front => (
                  <div key={front.id} className="rounded-md border p-3 flex flex-wrap justify-between items-start gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-medium text-sm">{front.code} · {front.title}</p>
                      <p className="text-xs text-muted-foreground">{front.status.replaceAll("_", " ")} · {front.evidence_state.replaceAll("_", " ")} · {front.specialist || "Especialista não informado"}</p>
                      <p className="text-xs">Próxima ação: {front.next_action || "Não registrada"}</p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => onSelectWorkstream(front.id)}>Abrir frente na Central</Button>
                  </div>
                )) : <p className="text-xs text-muted-foreground">Nenhuma frente CRM vinculada ao Core foi encontrada nesta sessão.</p>}
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Mapa de telas comprovadas no repositório</h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {CRM_SCREENS.map(screen=>(
                    <div key={screen.route} className="rounded-md border p-3 space-y-2 text-xs">
                      <p className="font-medium">{screen.label}</p>
                      <code className="text-muted-foreground">{screen.route}</code>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild><Link to={screen.route}>Abrir tela</Link></Button>
                        <a href={screen.source} target="_blank" rel="noopener noreferrer" className="underline self-center">Código</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button size="sm" onClick={()=>setLevel("operation")}><BookOpen className="h-4 w-4 mr-1.5" /> Ver como operar e comprovar</Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Esta é uma entrada de inventário de rota. Funções, especialista, método e estados operacionais ainda não foram homologados;
              não há manual de operação para este módulo neste piloto.
            </p>
          )}
        </Card>
      )}

      {selected?.id==="CRM" && level==="operation" && (
        <Card className="p-4 md:p-5 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">CRM · Piloto de conhecimento operacional · Verificado no código, não no uso real integral</p>
            <h3 className="font-semibold text-lg">Como tratar um atendimento</h3>
            <p className="text-sm text-muted-foreground mt-1">Jornada demonstrativa. A persistência de cada atendimento deve ser conferida no CRM pelo operador autorizado.</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-2">Passos da tarefa</h4>
            <ol className="list-decimal pl-6 space-y-2 text-sm">
              {CRM_JOURNEY.map((step,i)=><li key={i}>{step}</li>)}
            </ol>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Catálogo dos controles relevantes</h4>
            <Input aria-label="Buscar ação do CRM" placeholder="Buscar botão, efeito ou tela" value={actionSearch} onChange={event=>setActionSearch(event.target.value)} />
            {actions.map(action=>(
              <details key={action.label} className="border rounded-md p-3 group">
                <summary className="text-sm font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{action.label} <span className="text-xs font-normal text-muted-foreground">· {action.screen}</span></summary>
                <dl className="grid gap-2 text-xs mt-3">
                  <div><dt className="font-semibold">Antes de usar</dt><dd>{action.prerequisite}</dd></div>
                  <div><dt className="font-semibold">Efeito esperado</dt><dd>{action.expectedEffect}</dd></div>
                  <div><dt className="font-semibold">Confirmação</dt><dd>{action.confirmation}</dd></div>
                  <div><dt className="font-semibold">Limite</dt><dd>{action.limit}</dd></div>
                </dl>
                <a href={action.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline mt-2">
                  Ver evidência no código <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              </details>
            ))}
            {actions.length===0 && <p role="status" className="text-xs text-muted-foreground">Nenhuma ação encontrada.</p>}
          </div>
          <div className="rounded-lg border p-3 space-y-1 text-xs">
            <h4 className="font-semibold">Prova e limitações</h4>
            <p>{CRM_REFERENCE.checkpoint}</p><p>{CRM_REFERENCE.limitation}</p>
            <a href={CRM_REFERENCE.source} target="_blank" rel="noopener noreferrer" className="underline">Consultar origem técnica</a>
          </div>
          <Button size="sm" variant="outline" asChild><Link to="/contatos/inbox">Abrir caixa de atendimentos</Link></Button>
        </Card>
      )}
    </section>
  );
}
