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
