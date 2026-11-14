/**
 * Núcleo A+ V1.2 CA-13/17 — Índice de proveniência do CRM.
 * Fontes originais INSPECIONADAS nos ZIPs oficiais fornecidos:
 * - BASE_DE_CONHECIMENTOS_FINAL_WINDOWS_ATUALIZADA_2026-10-22_V3_ALFAJOR_60G.zip
 * - ATENDIMENTO CRM ETAPAS.zip
 * Metadados, NÃO cópia/importação B, certificação ou novo mapa soberano.
 */
export type CrmAuthoritySource = {
  id:string; title:string; version:string; originalFile:string;
  archive:string; sourceStatus:string; authorityScope:string;
  reconciliation:string;
};
const documents="ATENDIMENTO CRM ETAPAS.zip";
const base="BASE_DE_CONHECIMENTOS_FINAL_WINDOWS_ATUALIZADA_2026-10-22_V3_ALFAJOR_60G.zip";
const original=(file:string)=>"ATENDIMENTO CRM ETAPAS/"+file;
export const CRM_AUTHORITY_SOURCES_V12:CrmAuthoritySource[]=[
  {id:"CRM-ESTADO",title:"Estado Vigente — CRM",version:"V1.0 · 03/10/2026",
    archive:base,originalFile:"BASE_FINAL/04_PAINEL_CENTRAL/02_ESTADOS_VIGENTES/PCL-MST-ESTADO-CRM-V1.0.txt",
    sourceStatus:"ATIVO / VIGENTE declarado pelo próprio documento, em 03/10",
    authorityScope:"Continuidade operacional no marco documental de 03/10",
    reconciliation:"Estado técnico presente não confirmado pelo documento; comparar decisões posteriores antes de afirmar vigência atual."},
  {id:"CRM-05.03",title:"Arquitetura Operacional do CRM",version:"V1.0",
    archive:base,originalFile:"BASE_FINAL/70_FONTES_E_EVIDENCIAS/07_CRM_E_COMERCIAL_HISTORICO/DOCUMENTO_05_03_ARQUITETURA_OPERACIONAL_CRM_V1_0.txt",
    sourceStatus:"Consolidação documental / arquitetura oficial preservada",
    authorityScope:"Define hierarquia entre Processo, Bibliotecas, Matriz, Dicionários, Transições, Prioridade e implementação técnica",
    reconciliation:"Não substitui arquivos oficiais; aponta conflito de status do 09.02 e necessidade de normalização formal, sem reescrever fonte."},
  {id:"CRM-PROCESSO",title:"Documento Mestre — Processo Comercial CRM",version:"V1.0",
    archive:documents,originalFile:original("DOCUMENTO_MESTRE_PROCESSO_COMERCIAL_CRM_AMOR_DE_FAMILIA_V1_0.txt"),
    sourceStatus:"Documento Mestre comercial / base estrutural",
    authorityScope:"Etapas comerciais 01–08; cada mensagem possui uma função comercial",
    reconciliation:"Regras comerciais documentais não homologam automaticamente interface ou comportamento atual."},
  {id:"CRM-BIBLIOTECAS",title:"Bibliotecas oficiais de mensagens CRM 01–08",version:"V1.0",
    archive:documents,originalFile:"ATENDIMENTO CRM ETAPAS/BIBLIOTECA_OFICIAL_MENSAGENS_CRM_0[1-8]_*_HOMOLOGADA_V1_0.txt",
    sourceStatus:"HOMOLOGADAS nas fontes",
    authorityScope:"Comunicação comercial por etapa; não mesclar arbitrariamente os oito documentos",
    reconciliation:"Padrão acima é um localizador de oito arquivos, não documento único nem migração para M1."},
  {id:"CRM-09.01",title:"Matriz Operacional Mestre",version:"V1.1",
    archive:documents,originalFile:original("DOCUMENTO_09.01_MATRIZ_OPERACIONAL_MESTRE_DO_CRM_v1.1_HOMOLOGADA.txt"),
    sourceStatus:"HOMOLOGADA no cabeçalho original",
    authorityScope:"Situação operacional: contexto → evento → Resultado → Próxima Ação → continuidade",
    reconciliation:"Define relações; não redefine sozinha vocabulário técnico, Resultado ou Próxima Ação."},
  {id:"CRM-09.02",title:"Dicionário Oficial de Resultados",version:"V1.1",
    archive:documents,originalFile:original("DOCUMENTO_09.02_DICIONARIO_OFICIAL_DE_RESULTADOS_DO_ATENDIMENTO_v1.1_REFINADA_PRONTA_HOMOLOGACAO.txt"),
    sourceStatus:"Fonte: REFINADA — PRONTA PARA HOMOLOGAÇÃO",
    authorityScope:"Vocabulário de Resultado; o que efetivamente aconteceu",
    reconciliation:"Documento 09.04 posterior o referencia como homologado; 05.03 manda normalizar status formal, sem alterar silenciosamente a fonte."},
  {id:"CRM-09.03",title:"Dicionário Oficial de Próximas Ações",version:"V1.1",
    archive:documents,originalFile:original("DOCUMENTO_09.03_DICIONARIO_OFICIAL_DE_PROXIMAS_ACOES_v1.1_REFINADA_PRONTA_HOMOLOGACAO.txt"),
    sourceStatus:"Fonte: REFINADA — PRONTA PARA HOMOLOGAÇÃO",
    authorityScope:"Movimento comercial executável a seguir; não é Resultado, Etapa ou prioridade",
    reconciliation:"Conferir decisões posteriores antes de atribuir homologação formal ao arquivo-fonte."},
  {id:"CRM-09.04",title:"Mapa Oficial de Transições",version:"V1.0",
    archive:documents,originalFile:original("DOCUMENTO_09.04_MAPA_OFICIAL_DE_TRANSICOES_DO_CRM_v1.0_HOMOLOGADA.txt"),
    sourceStatus:"HOMOLOGADA no cabeçalho original",
    authorityScope:"Regras canônicas das transições comerciais",
    reconciliation:"A aplicação no código deve ser verificada separadamente; documentação original não autoriza mudança operacional."},
  {id:"CRM-09.05",title:"Arquitetura Oficial de Prioridade",version:"V1.0",
    archive:documents,originalFile:original("DOCUMENTO_09.05_ARQUITETURA_OFICIAL_DE_PRIORIDADE_DO_CRM_v1.0_HOMOLOGADA.txt"),
    sourceStatus:"HOMOLOGADA no cabeçalho original",
    authorityScope:"Prioridade de atendimento, separada de Resultado, próxima ação, etapa e tarefa",
    reconciliation:"Confirmação de comportamento em uso real permanece independente."},
];
export const CRM_SPECIALIST_CA17 = {
  functionalRole:"Especialista CRM — papel funcional persistente",
  historicalTechnicalRole:"CRM 7 — referência no checkpoint CRM UX02 de 16/10/2026",
  activeMandate:"não certificado no Core",
  nextGate:"Confrontar transferência e decisão formal do responsável com mapa e método contemporâneos. Não certificar pelo nome do chat.",
};
