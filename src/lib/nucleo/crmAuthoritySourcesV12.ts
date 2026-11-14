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
/**
 * Checkpoints posteriores com texto efetivamente consultado na Biblioteca e
 * verificações de PR na main. Não substitui nem reclassifica os originais.
 */
export const CRM_CONTINUITY_CHECKPOINTS_V12=[
  {
    id:"CRM-ESTADO-V1.2",date:"14/10/2026",
    title:"Estado CRM V1.2 — revisão de continuidade preparada",
    originalFile:"PCL-MST-ESTADO-CRM-V1.2.txt",
    sourceLocation:"Biblioteca pessoal — original, preservar metadados e versão",
    state:"PREPARADO PARA PUBLICAÇÃO / NÃO VIGENTE ATÉ SUBSTITUIÇÃO CONTROLADA",
    evidence:"O cabeçalho afirma que V1.2 substitui V1.1 somente quando publicada. Preserva 33 Resultados, 19 Próximas Ações e a separação entre Resultado, Etapa, Próxima Ação e Estado operacional.",
    action:"Conferir a publicação autorizada e o exemplar V1.1 na origem antes de registrar qualquer substituição. A existência da V1.2 na Biblioteca não comprova vigência.",
  },
  {
    id:"CRM-UX-02",date:"16/10/2026",
    title:"Checkpoint CRM–UX02: A3.1 + B3.1-A",
    originalFile:"docs/crm/CRM_UX_02_MAPA_EXECUCAO_A31_B31A.md",
    sourceLocation:"GitHub main — checkpoint técnico",
    state:"8/8 incrementos integrados segundo mapa; UAT autenticada pendente",
    evidence:"PRs #296 e #297 integradas com CI. Edição protegida, escritor canônico e apresentação responsiva descritos no mapa; CI não prova operação real.",
    action:"Conservar separação entre método CRM e execução UX; não encerrar piloto ou remover editores por mera aprovação técnica.",
  },
  {
    id:"CRM-SUCESSAO-04-11",date:"04/11/2026",
    title:"Adendo de sucessão CRM 7 → CRM 8",
    originalFile:"PCL-MST-ESTADO-CRM-V1.2.txt — adendo 04/11/2026",
    sourceLocation:"Biblioteca pessoal — adendo preparado, não publicado",
    state:"CHECKPOINT DE SUCESSÃO PREPARADO; NÃO CERTIFICA MANDATO ATUAL",
    evidence:"O texto registra CRM 7 como origem e CRM 8 como sucessor designado no repasse, com missão de continuidade da correção de reaberturas artificiais da fila P0. PR #411 merged em 04/11, SHA 5f178ac08ea5fa39f5870efd3dbe0f0e1c2846f0; PR #412 merged, SHA c5b86f4bcec8c2e4143690b49b0393120f11edee. Consulta de GitHub confirmou os merges.",
    action:"Conferir com a Camada Mestre a assunção efetiva, mandato e versão de método; não tomar o repasse como certificação nem transformar relatos de deploy em inspeção de runtime.",
  },
  {
    id:"CRM-411-OPERACIONAL",date:"04/11/2026",
    title:"Correção preventiva de eventos Meta e filas CRM",
    originalFile:"https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/411",
    sourceLocation:"GitHub — PR conferida; adendo de sucessão como checkpoint",
    state:"MERGE COMPROVADO; DEPLOY RELATADO NO ADENDO, NÃO RECONFIRMADO",
    evidence:"Evita classificar reações, duplicatas e replays como novos inbounds operacionais; ordenação por timestamp e proteção de estados. A PR #412 reverte alteração incidental de plano, não a #411.",
    action:"Pendentes segundo o adendo: reconciliação controlada dos seis casos históricos e observação de novos eventos legítimos; exigem especialista CRM e autorização própria, fora da escrita do Núcleo.",
  },
] as const;
export const CRM_SPECIALIST_CA17 = {
  functionalRole:"Especialista CRM — papel funcional persistente",
  historicalTechnicalRole:"CRM 7 — responsável técnico do checkpoint CRM UX02, em 16/10/2026",
  successionRecord:"CRM 7 → CRM 8 — repasse descrito em 04/11/2026, em adendo preparado e não publicado",
  activeMandate:"não certificado no Core; sucessão documental não equivale a mandato efetivo",
  nextGate:"Confirmar decisão/mandato atual com Camada Mestre e origem competente, mantendo histórico CRM 7, adendo V1.2 não vigente e evidências reais distintas de merge/CI.",
};
