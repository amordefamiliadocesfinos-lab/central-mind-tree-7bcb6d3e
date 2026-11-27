/** LH02 — presentation only. Never use these labels as identifiers or persisted values. */
const names: Readonly<Record<string,string>> = Object.freeze({
  NUC:"Núcleo", SHO:"Integração Shopee", CRM:"CRM — Relacionamento com clientes",
  FIN:"Financeiro", OPE:"Operações", SAU:"Saúde", DIG:"Digital",
  ASS:"Assistente IA", CAP:"Captura Central", ROT:"Rotina",
  "NUC-M0":"Histórico e preservação", "NUC-M1":"Gestão de documentos",
  "NUC-M2":"Biblioteca e referências", "NUC-M3":"Acompanhamento do desenvolvimento",
  "NUC-M4":"Evidências do desenvolvimento", "NUC-M5":"Supervisão e alertas",
  "CRM-UX02":"Caixa de entrada e ficha do contato",
  "DIG-N1-N2":"Identidade e resultado das campanhas",
  "FIN-N1-N2":"Compras, obrigações e movimentações financeiras",
  "OPE-03":"Planejamento e acompanhamento de compras",
  "SAU-F24":"Orientação durante os treinos",
  "SHO-F12":"Acompanhamento da integração Shopee",
  "SHO-F12-1":"Lote inicial de integração",
  "SHO-F12-2":"Distribuição da fila",
  "SHO-F12-3":"Retomada e ampliação da capacidade",
  "SHO-F12-4":"Integração de várias contas",
});
export const knowledgeSectionLabels = Object.freeze({
  "FM-01":"Sobre o módulo", "FM-02":"Resumo", "FM-03":"O que faz e seus limites",
  "FM-04":"Telas e funções", "FM-05":"Ações disponíveis", "FM-06":"Como usar",
  "FM-07":"Dados e evidências", "FM-08":"Especialista e método",
  "FM-09":"Evolução do trabalho", "FM-10":"Aprendizados",
});
export const nucleusTerms = Object.freeze({
  documents:"Documentos e versões", continuity:"Continuidade do especialista",
  knowledge:"Conhecimento do módulo", evidence:"Evidências técnicas",
  supervision:"Supervisão e alertas", source:"Base oficial do Painel Central",
  checkpoint:"Última atualização do trabalho",
});
export function humanWorkName(code:string, original:string):string {
  return Object.prototype.hasOwnProperty.call(names,code) ? names[code] : (original.trim() || code);
}
export function originalWorkReference(code:string, original:string):string {
  return code+" — "+original;
}
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
export function matchesHumanWork(query:string,code:string,original:string,...additional:string[]):boolean {
  const term=normalize(query);
  return !term || [code,original,humanWorkName(code,original),...additional].some(value=>normalize(value).includes(term));
}
