/**
 * AC-02 / CA-29 — roteiro consultivo de recuperação de contexto.
 * Nenhuma autorização, identidade, fonte secreta, entrega ou aceite é inferida.
 * O roteiro diferencia localizar referências de ler/validar os documentos.
 */
import type { Ac02DocumentaryCoverage } from "./ac02-documentary-coverage.ts";
import type { Ac02ContinuitySummary } from "./ac02-continuity-summary.ts";

export type Ac02AssumptionGuideStep=Readonly<{
 order:1|2|3|4|5|6;
 subject:"identidade"|"escopo"|"metodo_ecossistema"|"checkpoint"|"frentes"|"pendencias";
 state:"referencia_disponivel"|"consulta_necessaria"|"recorte_incompleto";
 action:string;
 evidence:string;
}>;
export type Ac02AssumptionGuide=Readonly<{
 kind:"nucleo_ac02_roteiro_assuncao_consultivo";
 status:"nao_homologado";
 moduleCode:string;
 steps:readonly Ac02AssumptionGuideStep[];
 caveats:readonly string[];
}>
const codePattern=/^[A-Z]{3}$/;
export function buildAc02AssumptionGuide(
 moduleCode:string,
 coverage:Ac02DocumentaryCoverage|null,
 continuity:Ac02ContinuitySummary|null,
 unresolved:readonly string[],
):Ac02AssumptionGuide{
 if(!codePattern.test(moduleCode))throw new Error("AC02: module code invalid");
 const fm=(key:string)=>coverage?.entries.find(e=>e.sectionCode===key);
 const referenceState=(key:string):Ac02AssumptionGuideStep["state"]=>{
  if(!coverage||fm(key)?.status!=="referencia_core_declarada")return "consulta_necessaria";
  if(coverage.warnings.some(w=>w.includes("Leitura de revisões não comprovadamente completa")||
       w.includes("Metadados de revisão inválidos")||
       w.includes("Múltiplas revisões")))return "recorte_incompleto";
  return "referencia_disponivel";
 };
 const scope=referenceState("FM-03"),method=referenceState("FM-08");
 const checkpoint=referenceState("FM-09");
 const m3:Ac02AssumptionGuideStep["state"]=continuity
  ?continuity.completeness==="recorte_incompleto"?"recorte_incompleto":"referencia_disponivel"
  :"consulta_necessaria";
 const step=(order:Ac02AssumptionGuideStep["order"],subject:Ac02AssumptionGuideStep["subject"],
  state:Ac02AssumptionGuideStep["state"],action:string,evidence:string):Ac02AssumptionGuideStep=>
  Object.freeze({order,subject,state,action,evidence});
 const steps=[
  step(1,"identidade","referencia_disponivel",
    "Conferir identidade oficial do Núcleo 2.0 V1.3 e confirmar, fora deste roteiro, o mandato e os acessos do destinatário.",
    "Identidade global declarada pela Camada Mestre; não é identidade de sessão."),
  step(2,"escopo",scope,
    "Localizar a revisão FM-03 do módulo e consultar o conteúdo original somente com autorização. Não expandir escopo por inferência.",
    scope==="referencia_disponivel"?"Referência de revisão FM-03 disponível; conteúdo não foi transmitido.":"FM-03 requer consulta ou reconciliação."),
  step(3,"metodo_ecossistema",method,
    "Localizar FM-08 e verificar nas fontes se método e ecossistema têm identidade e vigência próprias.",
    "FM-08 é compartilhada; não comprova dois documentos independentes."),
  step(4,"checkpoint",checkpoint,
    "Localizar FM-09, consultar o checkpoint registrado e confrontar com evidência de trabalho concluído antes de retomar.",
    "Revisão FM-09 não comprova o último checkpoint operacional."),
  step(5,"frentes",m3,
    "Conferir o inventário M3 e as referências M4 no Core e nos provedores; separar concluído declarado, em execução e bloqueado.",
    "Estados M3/M4 são declarados; bloqueios permanecem bloqueios."),
  step(6,"pendencias",unresolved.length?"consulta_necessaria":"referencia_disponivel",
    "Revisar pendências e dependências com a Camada Mestre antes de decidir qualquer execução; não usar esta lista como autorização.",
    "O roteiro é consultivo; não certifica continuidade, publicação, recebimento ou aceite."),
 ];
 return Object.freeze({
  kind:"nucleo_ac02_roteiro_assuncao_consultivo",
  status:"nao_homologado",moduleCode,steps:Object.freeze(steps),
  caveats:Object.freeze([
   "Acesso a fontes, contas, sessões e documentos não é transferido pelo pacote.",
   "Roteiro não é mandato, aprovação, prova de entrega ou substituto dos originais.",
   "Segurança, ledger produtivo, gateway, testes reais e homologação permanecem pendentes.",
  ]),
 });
}
