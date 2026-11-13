import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DevelopmentWorkstream, DevelopmentEvent } from "@/lib/nucleo/development.types";
import NucleoTechnicalEvidence from "@/components/nucleo/NucleoTechnicalEvidence";
import NucleoModuleKnowledge from "@/components/nucleo/NucleoModuleKnowledge";
import { MODULE_PROVENANCE, SOURCE_AUTHORITY_LABELS } from "@/lib/nucleo/operationalProvenanceV12";
import { BookOpen, ExternalLink, Layers, Search, ShieldCheck, GitBranch, FolderTree, Activity, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CRM_ACTIONS, CRM_JOURNEY, CRM_REFERENCE, CRM_SCREENS, MODULES_V12,
  type KnowledgeModule,
} from "@/lib/nucleo/operationalKnowledgeV12";

type Level = "overview" | "module" | "operation";
const specialistConfidence = (value: string | null | undefined): "declarado" | "nao_verificado" =>
  value && !/não verificado|não verificados|a conciliar|a reconciliar|vigência a conferir|vigência não/i.test(value)
    ? "declarado" : "nao_verificado";

const confidenceLabels = {
  codigo_verificado: "Verificado no código",
  declarado: "Declarado, a conciliar",
  nao_verificado: "Não verificado",
};

/** V1.2: descoberta orientada, sem escrita em outras frentes ou cópia documental. */
interface Props {
  workstreams: DevelopmentWorkstream[];
  events: DevelopmentEvent[];
  onSelectWorkstream: (id: string) => void;
}

export default function NucleoOperationalAtlas({ workstreams, events, onSelectWorkstream }: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("overview");
  const [actionSearch, setActionSearch] = useState("");
  const [evidenceFrontId, setEvidenceFrontId] = useState<string | null>(null);
  const [knowledgeOpen,setKnowledgeOpen]=useState(false);
  // O Core é a fonte do cadastro. O inventário GitHub apenas complementa rotas
  // observadas e mantém entradas ainda não catalogadas como não verificadas.
  // Novos módulos M3 aparecem aqui sem alterações de código.
  const governanceRoot = workstreams.find(item => item.kind === "modulo" && item.code === "NUC");
  const governanceFronts = governanceRoot ? workstreams.filter(item => item.parent_id === governanceRoot.id) : [];
  const registeredModules = useMemo(
    () => workstreams.filter(item => item.kind === "modulo" && item.code !== "NUC"),
    [workstreams],
  );
  // Contagem apenas dos registros do Core — não porcentagem de implementação.
  // Exclui a ficha raiz NUC para não contabilizar governança duas vezes.
  const monitored = workstreams.filter(item => item.code !== "NUC");
  const summary = {
    modules: registeredModules.length,
    governanceFronts: governanceFronts.length,
    active: monitored.filter(item => item.status === "em_andamento").length,
    validating: monitored.filter(item => item.status === "em_validacao").length,
    completed: monitored.filter(item =>
      item.status === "concluido" && item.evidence_state === "comprovada").length,
    blocked: monitored.filter(item => item.status === "bloqueado").length,
  };
  // A Central carrega até 200 eventos M3; não representa um feed global do GitHub.
  const recentEvents = useMemo(() => [...events]
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
    .slice(0, 5), [events]);
  const workstreamsById = useMemo(() =>
    new Map(workstreams.map(item => [item.id, item])), [workstreams]);
  const catalog = useMemo<KnowledgeModule[]>(() => {
    const byCode = new Map(MODULES_V12.map(module => [module.id, module]));
    for (const record of workstreams.filter(item => item.kind === "modulo" && item.code !== "NUC")) {
      const source = byCode.get(record.code);
      byCode.set(record.code, source ? {
        ...source, name: record.title, purpose: record.description || source.purpose,
        specialist: record.specialist || source.specialist,
        specialistConfidence: record.specialist ? specialistConfidence(record.specialist) : source.specialistConfidence,
      } : {
        id: record.code, name: record.title,
        domain: "Domínio ainda não classificado", route: null,
        purpose: record.description || "Finalidade detalhada não verificada.",
        coverage: "inventario_de_rotas", specialist: record.specialist || null,
        specialistConfidence: specialistConfidence(record.specialist),
        source: "Ficha do módulo no Core M3 — estado declarado, sem prova externa de rota",
      });
    }
    return [...byCode.values()];
  }, [workstreams]);
  const modules = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return catalog.filter(item => !term ||
      [item.name, item.domain, item.id, item.specialist ?? ""].some(value => value.toLocaleLowerCase("pt-BR").includes(term)));
  }, [catalog, search]);
  const selected = catalog.find(item => item.id === selectedId) ?? null;
  const selectedProvenance = selected ? MODULE_PROVENANCE[selected.id] : undefined;
  const selectedRecord = workstreams.find(item => item.kind === "modulo" && item.code === selectedId);
  const selectedFronts = selectedRecord ? workstreams.filter(item => item.parent_id === selectedRecord.id) : [];
  const selectedSubfronts = selectedFronts.flatMap(front => workstreams.filter(item => item.parent_id === front.id));
  const actions = useMemo(() => {
    const term = actionSearch.trim().toLocaleLowerCase("pt-BR");
    return CRM_ACTIONS.filter(action => !term ||
      [action.label, action.screen, action.expectedEffect].some(value => value.toLocaleLowerCase("pt-BR").includes(term)));
  }, [actionSearch]);
  const choose = (item: KnowledgeModule) => {
    setSelectedId(item.id);
    setLevel("module");
    setActionSearch("");
    setEvidenceFrontId(null);
    setKnowledgeOpen(false);
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
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Acompanhe módulos, frentes e procedimentos. O Núcleo governa essas informações, mas não entra na contagem dos módulos acompanhados.
            </p>
          </div>
          <Badge variant="outline">Piloto — cobertura parcial</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Níveis de navegação">
          <Button size="sm" variant={level==="overview"?"default":"outline"} onClick={() => { setLevel("overview"); setSelectedId(null); }}>1. Visão geral</Button>
          <Button size="sm" variant={level==="module"?"default":"outline"} disabled={!selected} onClick={() => setLevel("module")}>2. Módulo</Button>
          <Button size="sm" variant={level==="operation"?"default":"outline"} disabled={!selected || selected.id!=="CRM"} onClick={() => setLevel("operation")}>3. Operação / prova</Button>
        </div>
        <div className="rounded-md border p-3 text-sm leading-relaxed text-muted-foreground">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          {registeredModules.length} módulo(s) acompanhado(s) cadastrado(s) no Core; os demais cartões representam rotas ou fontes em investigação.
          As informações ainda não equivalem a um inventário global homologado nem autorizam a IA a executar operações.
        </div>
      </Card>

      {level==="overview" && (
        <section aria-label="Indicadores do acompanhamento" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">Leitura rápida do gestor</h3>
            <p className="text-xs text-muted-foreground">Contagem das fichas M3 autorizadas, sem porcentagem inferida</p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {[
              { label:"Módulos no Core", value:summary.modules, style:"border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100" },
              { label:"Frentes NUC", value:summary.governanceFronts, style:"border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100" },
              { label:"Em andamento", value:summary.active, style:"border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100" },
              { label:"Em validação", value:summary.validating, style:"border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" },
              { label:"Concluídas com prova", value:summary.completed, style:"border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100" },
              { label:"Bloqueadas", value:summary.blocked, style:"border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" },
            ].map(item => (
              <div key={item.label} className={`rounded-xl border p-3 md:p-4 shadow-sm ${item.style}`}>
                <p className="text-sm font-medium leading-snug">{item.label}</p>
                <p className="mt-2 text-3xl font-bold tabular-nums">{item.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {level==="overview" && (
        <Card className="p-4 md:p-5 space-y-4 border-violet-200 bg-violet-50/50 dark:border-violet-900 dark:bg-violet-950/20" aria-label="Núcleo — ambiente de governança">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-muted p-2"><FolderTree className="h-5 w-5" aria-hidden="true" /></div>
              <div>
                <h3 className="text-base font-semibold">Núcleo — ambiente de governança</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Supervisiona a arquitetura, os especialistas e a evolução dos módulos. Não é um módulo operacional do catálogo abaixo.</p>
              </div>
            </div>
            <Badge variant="outline">Estrutura separada</Badge>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5"><GitBranch className="h-4 w-4" aria-hidden="true" /> {governanceFronts.length} frentes do Núcleo no Core</span>
            <span className="text-muted-foreground">Navegue pela árvore e pela ficha de governança abaixo, sem duplicar seus registros.</span>
          </div>
          {governanceRoot && (
            <div className="pl-12 sm:pl-0 pt-2 pb-4">
              <Button type="button" variant="outline" size="sm" className="min-h-11 px-5"
                onClick={() => onSelectWorkstream(governanceRoot.id)}>
                Abrir ficha de governança
              </Button>
            </div>
          )}
        </Card>
      )}

      {level==="overview" && (
        <Card className="p-4 md:p-5 space-y-4" aria-label="Módulos operacionais acompanhados">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <h3 className="font-semibold text-base">Módulos do Painel Central</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{catalog.length} módulo(s) identificado(s) no catálogo · {registeredModules.length} cadastrado(s) no Core. O Núcleo de governança não entra nesta contagem.</p>
            </div>
            <Badge variant="secondary">Não representa progresso global</Badge>
          </div>
          <label className="relative block max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="Buscar módulo ou domínio" className="pl-9" value={search} onChange={event=>setSearch(event.target.value)}
              placeholder="Buscar CRM, Financeiro, Operações…" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {modules.map(item=>(
              <button key={item.id} type="button" onClick={()=>choose(item)}
                className="rounded-lg border p-4 min-h-[148px] text-left space-y-2.5 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">{item.id}</span>
                  <Badge variant={item.coverage==="piloto_parcial"?"secondary":"outline"}>
                    {item.coverage==="piloto_parcial"?"Piloto parcial":"Levantamento inicial"}
                  </Badge>
                </div>
                <p className="font-semibold text-base leading-snug">{item.name}</p>
                <p className="text-sm text-muted-foreground">{item.domain} · {item.route ?? "Rota não verificada"}</p>
                <p className="text-sm text-muted-foreground">{workstreams.some(front => front.code === item.id && front.kind === "modulo") ? "Cadastro no Core confirmado" : "Cadastro no Core ainda não verificado"}</p>
                <p className="text-sm font-medium underline underline-offset-2">Ver ficha e fontes</p>
              </button>
            ))}
          </div>
          {modules.length===0 && <p role="status" className="text-sm text-muted-foreground">Nenhum módulo encontrado com esse filtro.</p>}
        </Card>
      )}

      {level==="overview" && (
        <Card className="p-4 md:p-5 space-y-4" aria-label="Atividade recente registrada no Core">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold inline-flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-700 dark:text-sky-300" aria-hidden="true"/>
                Atividade recente
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Últimas alterações carregadas da trilha de auditoria M3, não de um feed geral do GitHub.
              </p>
            </div>
            <Badge variant="outline">Histórico do Core</Badge>
          </div>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground" role="status">Nenhuma atividade disponível nesta consulta.</p>
          ) : (
            <ol className="space-y-2">
              {recentEvents.map(event => {
                const front = workstreamsById.get(event.workstream_id);
                return (
                  <li key={event.id} className="rounded-lg border p-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold">{front?.title ?? "Registro histórico"}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.event_type === "criado" ? "Ficha criada" : "Ficha atualizada"}
                      </p>
                      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden="true"/>
                        {new Date(event.recorded_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    {front && <Button type="button" variant="outline" size="sm"
                      onClick={() => onSelectWorkstream(front.id)}>Abrir ficha</Button>}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      )}

      {selected && level==="module" && (
        <Card className="p-4 md:p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{selected.id} · {selected.domain}</p>
              <h3 className="font-semibold text-lg">{selected.name}</h3>
              <p className="text-sm leading-relaxed mt-1">{selected.purpose}</p>
            </div>
            <Badge variant={selected.coverage==="piloto_parcial"?"secondary":"outline"}>
              {selected.coverage==="piloto_parcial"?"Ficha parcial":"Cobertura não verificada"}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="border rounded-lg p-3 space-y-2">
              <h4 className="font-medium text-sm">Acesso e responsabilidade</h4>
              <p className="text-sm">Rota: <code>{selected.route??"não verificada"}</code></p>
              <p className="text-sm">Especialista: {selected.specialist??"Vínculo não verificado"}</p>
              <p className="text-sm text-muted-foreground">{confidenceLabels[selected.specialistConfidence]}</p>
              {selected.route && <Button size="sm" asChild variant="outline"><Link to={selected.route}>Abrir módulo</Link></Button>}
            </div>
            <div className="border rounded-lg p-3 space-y-2">
              <h4 className="font-medium text-sm">Fonte e método</h4>
              <p className="text-sm leading-relaxed">{selectedProvenance?.methodSummary ?? (selected.id==="CRM"?CRM_REFERENCE.method:"Método, escopo e checkpoint ainda precisam de fontes vigentes.")}</p>
              {selected.source.startsWith("https://") ?
                <a href={selected.source} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs underline">
                  Conferir código de origem <ExternalLink className="h-3 w-3" aria-hidden="true"/>
                </a> :
                <p className="text-xs text-muted-foreground">{selected.source}</p>}
            </div>
          </div>
          {selectedProvenance && (
            <section className="rounded-lg border p-3 md:p-4 space-y-3" aria-label="Fontes e autoridade documental">
              <div>
                <h4 className="font-semibold text-sm">Fontes documentais e autoridade</h4>
                <p className="text-sm text-muted-foreground mt-1">{selectedProvenance.ownerBoundary}</p>
                <p className="text-xs text-muted-foreground mt-1">Metadados de referência presentes no GitHub; sem importação para o Núcleo ou atualização automática.</p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {selectedProvenance.sources.map(source => (
                  <div key={source.path} className="rounded-lg border p-3 space-y-2 min-w-0">
                    <p className="text-sm font-medium">{source.label}</p>
                    <p className="text-xs text-muted-foreground">{SOURCE_AUTHORITY_LABELS[source.authority]}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{source.note}</p>
                    <a href={source.path} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-1 text-sm underline underline-offset-2">
                      Abrir fonte original <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}
          {selectedRecord && (
              <div className="rounded-lg border p-3 space-y-2">
                <h4 className="font-semibold text-sm">Frentes reais vinculadas no Core</h4>
                <p className="text-xs text-muted-foreground">Estado declarado pela governança, diferente de implantação, aceite e uso real. Provas M4 são registros históricos consultados sob permissão; não são verificação GitHub ao vivo.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{selectedFronts.length} frente(s) direta(s)</Badge>
                  <Badge variant="outline">{selectedSubfronts.length} subfrente(s) vinculada(s)</Badge>
                  <Button type="button" size="sm" variant="outline"
                    aria-expanded={evidenceFrontId === selectedRecord.id}
                    onClick={() => setEvidenceFrontId(current => current === selectedRecord.id ? null : selectedRecord.id)}>
                    {evidenceFrontId === selectedRecord.id ? "Ocultar evidências do módulo" : "Ver evidências do módulo"}
                  </Button>
                </div>
                {evidenceFrontId === selectedRecord.id && <NucleoTechnicalEvidence workstreamId={selectedRecord.id} />}
                {selectedSubfronts.length > 0 && (
                  <div className="rounded-md border p-3 space-y-2">
                    <p className="font-medium text-sm">Subfrentes existentes — acompanhamento documental</p>
                    <p className="text-xs text-muted-foreground">Estados e provas pertencem às fichas M3. Não indicam deploy ou homologação automática.</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedSubfronts.map(subfront => (
                        <div key={subfront.id} className="rounded-lg border p-3 space-y-2 min-w-0">
                          <div className="flex flex-wrap justify-between items-center gap-2">
                            <p className="font-semibold text-sm">{subfront.code}</p>
                            <Badge variant="outline">{subfront.status.replaceAll("_"," ")}</Badge>
                          </div>
                          <p className="text-sm">{subfront.title}</p>
                          <p className="text-xs text-muted-foreground">Frente pai: {workstreamsById.get(subfront.parent_id ?? "")?.code ?? "Vínculo não encontrado"}</p>
                          <p className="text-xs text-muted-foreground">{subfront.evidence_state.replaceAll("_", " ")} · {subfront.specialist || "Especialista não informado"}</p>
                          <p className="text-xs text-muted-foreground line-clamp-3">{subfront.next_action || "Sem próxima ação declarada"}</p>
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => onSelectWorkstream(subfront.id)}>
                              Abrir ficha na Central
                            </Button>
                            <Button type="button" size="sm" variant="outline"
                              aria-expanded={evidenceFrontId === subfront.id}
                              onClick={() => setEvidenceFrontId(current => current === subfront.id ? null : subfront.id)}>
                              {evidenceFrontId === subfront.id ? "Ocultar provas" : "Ver provas M4"}
                            </Button>
                          </div>
                          {evidenceFrontId === subfront.id && <NucleoTechnicalEvidence workstreamId={subfront.id} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedFronts.length ? selectedFronts.map(front => (
                  <div key={front.id} className="rounded-md border p-3 flex flex-wrap justify-between items-start gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-medium text-sm">{front.code} · {front.title}</p>
                      <p className="text-xs text-muted-foreground">{front.status.replaceAll("_", " ")} · {front.evidence_state.replaceAll("_", " ")} · {front.specialist || "Especialista não informado"}</p>
                      <p className="text-xs">Próxima ação: {front.next_action || "Não registrada"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => onSelectWorkstream(front.id)}>Abrir frente na Central</Button>
                      <Button type="button" size="sm" variant="outline" aria-expanded={evidenceFrontId === front.id}
                        onClick={() => setEvidenceFrontId(current => current === front.id ? null : front.id)}>
                        {evidenceFrontId === front.id ? "Ocultar provas" : "Ver provas GitHub/Supabase"}
                      </Button>
                    </div>
                    {evidenceFrontId === front.id && <div className="w-full border-t pt-2"><NucleoTechnicalEvidence workstreamId={front.id}/></div>}
                  </div>
                )) : <p className="text-xs text-muted-foreground">Nenhuma frente vinculada ao módulo no Core foi encontrada nesta sessão.</p>}
              </div>
          )}
          {selectedRecord && <div className="space-y-2">
            <Button type="button" variant="outline" size="sm" aria-expanded={knowledgeOpen}
              onClick={()=>setKnowledgeOpen(open=>!open)}>
              {knowledgeOpen?"Ocultar Ficha Viva":"Abrir Ficha Viva FM-01–FM-10"}
            </Button>
            {knowledgeOpen && <NucleoModuleKnowledge key={selectedRecord.id} moduleId={selectedRecord.id} moduleCode={selectedRecord.code}/>}
          </div>}
          {selected.id==="CRM" ? (
            <>
              <div className="rounded-md border p-3 space-y-1 text-xs">
                <p className="font-semibold">Checkpoint de especialista — referência histórica, não norma vigente</p>
                <p>CRM UX 02: mapa A3.1 / B3.1-A, com oito incrementos registrados como mergeados no checkpoint de 16/10/2026. A vigência do método e a homologação de uso real exigem reconciliação.</p>
                <a className="underline underline-offset-2" target="_blank" rel="noopener noreferrer"
                  href="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/main/docs/crm/CRM_UX_02_MAPA_EXECUCAO_A31_B31A.md">
                  Consultar fonte documental original
                </a>
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
