/**
 * AC-02 / CA-29 — inventário de lacunas na recuperação de conhecimento.
 * Consulta apenas projeções já existentes. NÃO usa corpo de Ficha Viva,
 * dados pessoais, texto de pendências arbitrárias, URL ou credencial.
 * Lacuna significa ausência de comprovação NESTE pacote, não no projeto inteiro.
 */
import type { Ac02DocumentaryCoverage } from "./ac02-documentary-coverage.ts";
import type { Ac02ContinuitySummary } from "./ac02-continuity-summary.ts";
import type { Ac02AssumptionGuide } from "./ac02-assumption-guide.ts";

export type Ac02KnowledgeGapId=
 "G01_ESCOPO"|"G02_METODO_ECOSSISTEMA"|"G03_CHECKPOINT"|
 "G04_M3_M4"|"G05_FONTES"|"G06_MANDATO_ACESSO"|
 "G07_HOMOLOGACAO"|"G08_SEGURANCA_IMPLANTACAO";
export type Ac02KnowledgeGap=Readonly<{
 id:Ac02KnowledgeGapId;
 state:"referencia_inexistente_no_recorte"|"referencia_presente_consulta_pendente"|
       "recorte_indeterminado"|"comprovacao_externa_pendente"|"fase_adiada";
 category:"documental"|"operacional"|"governanca"|"implantacao";
 evidence:"fm03"|"fm08"|"fm09"|"m3_m4"|"core_metadata"|"mandato"|"homologacao"|"deferimento_proprietario";
 action:string;
}>;
export type Ac02KnowledgeGapInventory=Readonly<{
 kind:"nucleo_ac02_inventario_lacunas_consultivo";
 moduleCode:string;
 status:"lacunas_para_consulta_nao_homologadas";
 gaps:readonly Ac02KnowledgeGap[];
 summary:Readonly<{documental:number;operacional:number;governanca:number;implantacao:number}>;
 caveat:"lacunas_do_recorte_nao_ausencia_global";
}>;
const code=/^[A-Z]{3}$/;
const section=(c:Ac02DocumentaryCoverage|null,s:string)=>c?.entries.find(v=>v.sectionCode===s);
const incomplete=(c:Ac02DocumentaryCoverage|null)=>
 !!c?.warnings.some(w=>w.includes("Leitura de revisões não comprovadamente completa")||
  w.includes("Metadados de revisão inválidos")||w.includes("Múltiplas revisões"));
export function inventoryAc02KnowledgeGaps(
 moduleCode:string,
 coverage:Ac02DocumentaryCoverage|null,
 continuity:Ac02ContinuitySummary|null,
 guide:Ac02AssumptionGuide,
):Ac02KnowledgeGapInventory{
 if(!code.test(moduleCode)||guide.moduleCode!==moduleCode||
    guide.kind!=="nucleo_ac02_roteiro_assuncao_consultivo")
  throw new Error("AC02: module/guide mismatch");
 const gaps:Ac02KnowledgeGap[]=[];
 const push=(id:Ac02KnowledgeGapId,state:Ac02KnowledgeGap["state"],
  category:Ac02KnowledgeGap["category"],evidence:Ac02KnowledgeGap["evidence"],action:string)=>
   gaps.push(Object.freeze({id,state,category,evidence,action}));
 const docState=(key:string):Ac02KnowledgeGap["state"]=>{
  if(!coverage||incomplete(coverage))return "recorte_indeterminado";
  return section(coverage,key)?.status==="referencia_core_declarada"?
   "referencia_presente_consulta_pendente":"referencia_inexistente_no_recorte";
 };
 push("G01_ESCOPO",docState("FM-03"),"documental","fm03",
  "Consultar conteúdo e autoridade da revisão FM-03 original; o ID/versão não comprova o escopo material.");
 push("G02_METODO_ECOSSISTEMA",docState("FM-08"),"documental","fm08",
  "Abrir FM-08 e verificar separadamente método e ecossistema; uma seção não prova dois documentos.");
 push("G03_CHECKPOINT",docState("FM-09"),"operacional","fm09",
  "Confrontar a revisão FM-09 com trabalho realmente concluído e evidência datada antes de prosseguir.");
 push("G04_M3_M4",!continuity||continuity.completeness==="recorte_incompleto"?
   "recorte_indeterminado":"referencia_presente_consulta_pendente","operacional","m3_m4",
  "Conferir M3/M4 no Core e provedores; frentes declaradas concluídas não equivalem a deploy ou homologação.");
 const fm=coverage?.entries??[];
 push("G05_FONTES",!coverage||incomplete(coverage)?"recorte_indeterminado":
   fm.some(e=>e.status==="referencia_core_declarada"&&e.sourceReference!=="presente_na_revisao")?
   "referencia_inexistente_no_recorte":"referencia_presente_consulta_pendente",
   "documental","core_metadata",
   "Abrir e validar as fontes autorizadas; campo preenchido não confirma arquivo vigente nem acesso.");
 push("G06_MANDATO_ACESSO","comprovacao_externa_pendente","governanca","mandato",
  "Confirmar titular, mandato e acessos na autoridade própria; pacote não concede permissões.");
 push("G07_HOMOLOGACAO","comprovacao_externa_pendente","governanca","homologacao",
  "Homologar assunção humana e fontes em fase futura, sem declarar aceite a partir de texto copiado.");
 push("G08_SEGURANCA_IMPLANTACAO","fase_adiada","implantacao","deferimento_proprietario",
  "Manter autenticação, ledger, gateway, deploy e testes produtivos pendentes por decisão do proprietário.");
 const summary={documental:0,operacional:0,governanca:0,implantacao:0};
 for(const g of gaps)summary[g.category]++;
 return Object.freeze({
  kind:"nucleo_ac02_inventario_lacunas_consultivo",
  moduleCode,status:"lacunas_para_consulta_nao_homologadas",
  gaps:Object.freeze(gaps),summary:Object.freeze(summary),
  caveat:"lacunas_do_recorte_nao_ausencia_global",
 });
}


/**
 * Visão de prontidão DOCUMENTAL, não "pronto para operar".
 * Cada contagem é resultado dos oito itens catalogados na leitura do recorte.
 * IDs estáveis evitam reabrir o texto livre do checkpoint.
 */
export type Ac02DocumentaryReadiness=Readonly<{
 kind:"nucleo_ac02_visao_prontidao_documental_consultiva";
 status:"nao_homologado_sem_autorizacao_de_execucao";
 moduleCode:string;
 coverage:Readonly<{
  referencias_presentes_para_consulta:number;
  referencias_ausentes_no_recorte:number;
  recortes_indeterminados:number;
  comprovacoes_externas_pendentes:number;
  fases_adiadas:number;
 }>;
 categories:readonly Readonly<{
  category:Ac02KnowledgeGap["category"];
  entries:readonly Readonly<{id:Ac02KnowledgeGapId;state:Ac02KnowledgeGap["state"]}>[];
 }>[];
 reviewOrder:readonly Ac02KnowledgeGapId[];
 readyForOperationalAssumption:false;
 disclaimer:"referencia_documental_nao_equivale_a_prontidao_operacional";
}>;
export function summarizeAc02DocumentaryReadiness(
 inventory:Ac02KnowledgeGapInventory,
):Ac02DocumentaryReadiness{
 if(inventory.kind!=="nucleo_ac02_inventario_lacunas_consultivo"||
    inventory.status!=="lacunas_para_consulta_nao_homologadas"||
    !code.test(inventory.moduleCode))throw new Error("AC02: invalid gap inventory");
 const ids=new Set<Ac02KnowledgeGapId>();
 const allowed=new Set<Ac02KnowledgeGap["state"]>([
  "referencia_presente_consulta_pendente","referencia_inexistente_no_recorte",
  "recorte_indeterminado","comprovacao_externa_pendente","fase_adiada",
 ]);
 const categories=["documental","operacional","governanca","implantacao"] as const;
 const grouped=categories.map(category=>({
  category,entries:[] as {id:Ac02KnowledgeGapId;state:Ac02KnowledgeGap["state"]}[],
 }));
 const counts={
  referencias_presentes_para_consulta:0,
  referencias_ausentes_no_recorte:0,
  recortes_indeterminados:0,
  comprovacoes_externas_pendentes:0,
  fases_adiadas:0,
 };
 const keys:Record<Ac02KnowledgeGap["state"],keyof typeof counts>={
  referencia_presente_consulta_pendente:"referencias_presentes_para_consulta",
  referencia_inexistente_no_recorte:"referencias_ausentes_no_recorte",
  recorte_indeterminado:"recortes_indeterminados",
  comprovacao_externa_pendente:"comprovacoes_externas_pendentes",
  fase_adiada:"fases_adiadas",
 };
 for(const item of inventory.gaps){
  if(ids.has(item.id)||!allowed.has(item.state))throw new Error("AC02: duplicate/invalid gap");
  const target=grouped.find(group=>group.category===item.category);
  if(!target)throw new Error("AC02: category unknown");
  ids.add(item.id);
  counts[keys[item.state]]++;
  target.entries.push(Object.freeze({id:item.id,state:item.state}));
 }
 const expected:Ac02KnowledgeGapId[]=[
  "G01_ESCOPO","G02_METODO_ECOSSISTEMA","G03_CHECKPOINT","G04_M3_M4",
  "G05_FONTES","G06_MANDATO_ACESSO","G07_HOMOLOGACAO","G08_SEGURANCA_IMPLANTACAO",
 ];
 if(ids.size!==expected.length||expected.some(id=>!ids.has(id)))throw new Error("AC02: incomplete gap registry");
 return Object.freeze({
  kind:"nucleo_ac02_visao_prontidao_documental_consultiva",
  status:"nao_homologado_sem_autorizacao_de_execucao",
  moduleCode:inventory.moduleCode,
  coverage:Object.freeze(counts),
  categories:Object.freeze(grouped.map(g=>Object.freeze({
   category:g.category,entries:Object.freeze(g.entries),
  }))),
  reviewOrder:Object.freeze(expected.filter(id=>{
   const state=inventory.gaps.find(g=>g.id===id)?.state;
   return state!=="fase_adiada";
  })),
  readyForOperationalAssumption:false,
  disclaimer:"referencia_documental_nao_equivale_a_prontidao_operacional",
 });
}
