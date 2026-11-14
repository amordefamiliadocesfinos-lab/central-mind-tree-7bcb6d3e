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
