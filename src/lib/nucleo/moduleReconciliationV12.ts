/**
 * Entrega A+ V1.2 / Bloco 1 — superfícies documentadas para reconciliação M3.
 * Inventário somente de leitura, NUNCA cadastro de frente, histórico ou prova M4.
 * Verificação: código presente na main de 13/11/2026 e mapa CCH V5.4;
 * identidade, autoridade, vigência de métodos e homologação continuam distintas.
 */
export type ReconciliationCandidate = {
  label: string;
  observed: string;
  reference: string;
  evidenceKind: "codigo_presente" | "mapa_declarado";
  nextGate: string;
};
const src = (path:string) =>
  "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/main/" + path;

export const MODULE_RECONCILIATION_V12: Partial<Record<string,ReconciliationCandidate[]>> = {
  OPE: [
    {label:"Compras e condições financeiras",observed:"Componentes de compras e funções de faturamento presentes no código; não comprova pagamento ou conciliação final.",
      reference:src("src/components/operations/PurchasesTab.tsx"),evidenceKind:"codigo_presente",
      nextGate:"Confrontar o Mapa Norteador original recuperado com alterações posteriores e critérios do especialista."},
    {label:"MRP → contexto de Compra",observed:"O MRP encaminha necessidade à aba de Compras; não comprova geração automática ou ciclo fechado.",
      reference:src("src/components/operations/MRPTab.tsx"),evidenceKind:"codigo_presente",
      nextGate:"Confirmar limites do fluxo assistido sem modificar compra, estoque ou produção."},
  ],
  FIN: [
    {label:"Receber, pagar e dashboard",observed:"Abas de dashboard, receber, pagar, contas, notas e categorias presentes na página do Financeiro.",
      reference:src("src/pages/Financeiro.tsx"),evidenceKind:"codigo_presente",
      nextGate:"Conferir método de conciliação e uso real antes de converter áreas em frentes M3."},
  ],
  CAP: [
    {label:"Captura, classificação e encaminhamento",observed:"Página contém fluxo de captura de conteúdo e controles de encaminhamento; ações e resultados não foram homologados nesta reconciliação.",
      reference:src("src/pages/CapturaCentral.tsx"),evidenceKind:"codigo_presente",
      nextGate:"Confrontar Estado de Continuidade de 03/10 com decisões posteriores do especialista."},
  ],
  ROT: [
    {label:"Planejamento em dia, semana e mês",observed:"Visões de dia, semana e mês presentes no módulo Rotina.",
      reference:src("src/pages/Rotina.tsx"),evidenceKind:"codigo_presente",
      nextGate:"Conciliar método vigente de blocos e rotina, sem agendar ou disparar ações."},
  ],
  SAU: [
    {label:"Mapa CCH V5.4 — F10 a F22",observed:"Mapa soberano de 12/11 declara F10–F22 implementadas, F22 operacional e F23 não aberta; afirmações são da fonte.",
      reference:src("docs/health/CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v5_4_FROZEN.md"),evidenceKind:"mapa_declarado",
      nextGate:"Conciliar a autoridade do especialista e critérios de aceite, sem criar F23 ou usar informações pessoais."},
  ],
  DIG: [
    {label:"Ideias, calendário e campanhas",observed:"Interface Digital reúne superfícies de ideias, calendário, campanhas, mídias e métricas.",
      reference:src("src/pages/Digital.tsx"),evidenceKind:"codigo_presente",
      nextGate:"Conferir método editorial e decisões de publicação; não publicar nem automatizar."},
  ],
  ASS: [
    {label:"Insights, políticas e histórico do Assistente",observed:"Página apresenta abas de chat, insights, políticas e log; a presença não autoriza autonomia.",
      reference:src("src/pages/Assistente.tsx"),evidenceKind:"codigo_presente",
      nextGate:"Localizar fonte formal do método e reconciliar autorização nominal antes de cadastrar frente."},
  ],
};
