/**
 * Núcleo V1.2 A+ — referências de proveniência para leitura humana.
 * Estas entradas NÃO criam documentos no Core, não validam UAT e não
 * substituem a autoridade do especialista ou do Mapa Mestre.
 */
export type SourceAuthority = "vigente_declarada" | "historica" | "codigo_verificado";
export interface ModuleSource {
  label: string;
  path: string;
  authority: SourceAuthority;
  note: string;
}
export interface ModuleProvenance {
  methodSummary: string;
  ownerBoundary: string;
  sources: ModuleSource[];
}
const map = (path:string):string =>
  "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/main/" + path;

export const SOURCE_AUTHORITY_LABELS: Record<SourceAuthority,string> = {
  vigente_declarada: "Documento que se declara vigente",
  historica: "Checkpoint histórico — não confirmar vigência atual",
  codigo_verificado: "Presença no código — não equivale a uso real",
};

export const MODULE_PROVENANCE: Partial<Record<string, ModuleProvenance>> = {
  DIG: {
    methodSummary: "O código da área Digital contém ideias, campanhas, plataformas, calendário e métricas; não confirma método de publicação nem fluxo homologado.",
    ownerBoundary: "O Núcleo ainda não possui mandato do especialista Digital verificado. Não publicar campanhas ou executar ações apenas com essa referência.",
    sources: [
      {label:"Digital — página do módulo",path:map("src/pages/Digital.tsx"),authority:"codigo_verificado",
       note:"Superfícies de código, sem evidência de aceite funcional ou governança do especialista."},
    ],
  },
  ASS: {
    methodSummary: "O código de Assistente reúne propostas, políticas, ações, aprovações e histórico; isso não concede autonomia nem comprova execução.",
    ownerBoundary: "Mandato do especialista Assistente e contratos de autorização não reconciliados. A supervisão Núcleo M5 permanece somente leitura.",
    sources: [
      {label:"Assistente — página do módulo",path:map("src/pages/Assistente.tsx"),authority:"codigo_verificado",
       note:"Fluxos presentes em código; autorização e operação não verificadas pelo Núcleo."},
    ],
  },
  OPE: {
    methodSummary: "Mapa Norteador original congelado em 18/09/2026 recuperado na Biblioteca. O GitHub posterior comprova código de documentos, condições financeiras de compras e fluxo MRP → proposta de compra, com RPCs correspondentes no Core; implantação e homologação de cada fluxo ainda exigem evidências próprias. ET1 PR #355 foi mergeada em 23/10, sem comprovar ativação física.",
    ownerBoundary: "Especialista e método soberano de Operações ainda não reconciliados. Não ativar migration ET1 isolada, converter estoque legado ou mover produção/pedidos.",
    sources: [
      {label:"Operações — código da página",path:map("src/pages/Operacoes.tsx"),authority:"codigo_verificado",
       note:"Controles de pedidos, produtos, produção, estoque e logística; sem teste operacional nesta investigação."},
      {label:"Compras — edição, faturamento e documentos",path:map("src/components/operations/PurchasesTab.tsx"),authority:"codigo_verificado",
       note:"Código de Compras inclui diálogo de condições financeiras e documentação; uso real e conclusão do contrato requerem validação específica."},
      {label:"Compra ↔ Financeiro — RPCs do código",path:map("src/lib/purchases/confirmPurchaseFinancial.ts"),authority:"codigo_verificado",
       note:"RPCs register_purchase_billing e register_purchase_invoice_billing presentes também no Core; não prova liquidação ou aceitação operacional."},
      {label:"Documentos de Compra",path:map("src/lib/purchases/purchaseDocuments.ts"),authority:"codigo_verificado",
       note:"Tabela purchase_documents existe no Core, com funções de listagem/upload no código; sem prova de uso real nesta análise."},
      {label:"MRP → Compra — passagem de contexto",path:map("src/components/operations/MRPTab.tsx"),authority:"codigo_verificado",
       note:"Abre a aba de Compras com parâmetros da necessidade; não comprova fechamento automático do ciclo ou homologação."},
      {label:"ET1 — contrato de embalagem P100/EA",path:map("docs/operacoes/ET1_EMBALAGEM_TRUFA_P100_EA_CONTRATO_TESTES.md"),authority:"historica",
       note:"Contrato ET1 histórico parcial; PR #355 mergeada em 23/10/2026, mas aplicação de migrations, ativação e homologação física não confirmadas."},
      {label:"CB3 — nota de engenharia Chocolate Base",path:map("docs/operacoes/chocolate-cb3-notas-implementacao-20261021.md"),authority:"historica",
       note:"Rascunho de engenharia, não documento canônico; não autoriza publicação isolada."},
    ],
  },
  FIN: {
    methodSummary: "Dashboard, lançamentos, importador e conciliação são superfícies de código verificadas. Falta conferir contrato financeiro vigente e evidências de uso real.",
    ownerBoundary: "Especialista, responsável e regras de conciliação financeira ainda não verificados; nenhuma ação deve ser executada pelo Núcleo.",
    sources: [{label:"Financeiro — página e funções",path:map("src/pages/Financeiro.tsx"),authority:"codigo_verificado",
      note:"Presença de componentes de lançamentos, pagamentos, extratos e importações; não prova resultados persistidos."}],
  },
  CAP: {
    methodSummary: "Entrada e classificação de conteúdos em texto e mídia, com ações de referência e decisões, identificadas na página.",
    ownerBoundary: "O método responsável pela triagem e autorização das ações ainda não foi reconciliado.",
    sources: [{label:"Captura Central — página e funções",path:map("src/pages/CapturaCentral.tsx"),authority:"codigo_verificado",
      note:"Superfície de captura e estado; não representa prova de homologação de classificação ou tarefas."}],
  },
  ROT: {
    methodSummary: "Rotina oferece escopos pessoal/empresa, blocos, visões de calendário e alarmes, verificados no código.",
    ownerBoundary: "Especialista e método de priorização/replanejamento não reconciliados; não disparar blocos nem alertas via Núcleo.",
    sources: [{label:"Rotina — página e funções",path:map("src/pages/Rotina.tsx"),authority:"codigo_verificado",
      note:"Presença de estados e ações no código, sem prova independente de funcionamento."}],
  },
  CRM: {
    methodSummary: "Checkpoint CRM UX 02 de 16/10/2026: oito incrementos técnicos integrados; não comprova método atual ou UAT. O conhecimento do CRM permanece piloto parcial.",
    ownerBoundary: "CRM 7 consta como responsabilidade técnica histórica. A identidade e a autoridade atual do especialista exigem confirmação.",
    sources: [
      {label:"CRM UX 02 — A3.1/B3.1-A",path:map("docs/crm/CRM_UX_02_MAPA_EXECUCAO_A31_B31A.md"),authority:"historica",
       note:"Execução técnica referenciada em 16/10/2026; experiência autenticada permaneceu pendente no checkpoint."},
      {label:"CRM — rotas",path:map("src/App.tsx"),authority:"codigo_verificado",
       note:"/contatos, /contatos/inbox e /contatos/tarefas; não confere a operação."},
    ],
  },
  SAU: {
    methodSummary: "Mapa Soberano CCH v5.4, de 12/11/2026, declara-se VIGENTE · FROZEN. F10–F22 implementadas e F22 operacional conforme a própria fonte; F23 não aberta.",
    ownerBoundary: "O documento soberano estabelece regras do produto, mas não resolve sozinho a identidade do especialista vinculada ao Núcleo. Não usar dados dos praticantes na ficha.",
    sources: [
      {label:"CCH — Mapa Soberano v5.4",path:map("docs/health/CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v5_4_FROZEN.md"),authority:"vigente_declarada",
       note:"Data 12/11/2026; substitui v5.3. Implementação e uso real devem permanecer separados."},
      {label:"CCH — Matriz de cobertura v3",path:map("docs/health/CCH_REQUIREMENTS_COVERAGE_MATRIX_v3_2026-11-09.md"),authority:"historica",
       note:"Matriz datada de 09/11/2026, com distinção entre implementação em código e gates."},
      {label:"Saúde — rotas e páginas",path:map("src/modules/health/HealthModule.tsx"),authority:"codigo_verificado",
       note:"Mapa de componentes, não validação clínica, de autorização ou da experiência de usuário."},
    ],
  },
  SHO: {
    methodSummary: "O Mapa Mestre Integração Shopee V2 governa a F12; em 12/11/2026 a frente foi expressamente mantida ABERTA sob escopo congelado. Nem congelamento nem código comprovam encerramento ou escala homologada.",
    ownerBoundary: "O papel de Especialista Integração Shopee é reconhecido nas fontes; identidade atual, mandato nominal e eventual substituição ainda precisam ser reconciliados.",
    sources: [
      {label:"F12 — mapa congelado, frente ativa",path:map("docs/operations/F12_MAPA_CONGELADO_ESCOPO_CONTROLADO_ATIVO_2026-11-12.md"),authority:"vigente_declarada",
       note:"Decisão 12/11/2026: F12 aberta. Evidência de código, publicação e homologação são categorias diferentes."},
      {label:"Mapa Mestre Integração Shopee V2",path:map("docs/operations/MAPA_MESTRE_INTEGRACAO_SHOPEE_PAINEL_CENTRAL_V2.md"),authority:"vigente_declarada",
       note:"Autoridade documental declarada pela F12. Não representa autorização de execução de pedidos."},
      {label:"F12 — encerramento histórico retificado",path:map("docs/operations/F12_ENCERRAMENTO_ADMINISTRATIVO_E_REPASSE_2026-11-12.md"),authority:"historica",
       note:"Referência histórica retificada; NÃO tratar a frente como encerrada."},
    ],
  },
};
