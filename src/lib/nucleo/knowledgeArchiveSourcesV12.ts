/**
 * Núcleo V1.2 A+ — inventário METADATA-ONLY de fontes anexadas.
 *
 * Dois ZIPs da base compartilham estes 7 documentos exatamente (SHA-256
 * dos bytes no interior do ZIP). Não implica que a versão de 03/10/2026
 * permaneça a última decisão; nem que um responsável esteja certificado.
 *
 * Sem importar conteúdo, sem gerar cópia documental concorrente no Core.
 * Os caminhos abaixo são relativos ao ZIP, NÃO URLs do GitHub.
 */
export const KNOWLEDGE_ARCHIVES = [
  "BASE_DE_CONHECIMENTOS_FINAL_WINDOWS_ATUALIZADA_2026-10-05_V3.zip",
  "BASE_DE_CONHECIMENTOS_FINAL_WINDOWS_ATUALIZADA_2026-10-22_V3_ALFAJOR_60G.zip",
] as const;

export type KnowledgeArchiveSource = {
  moduleCode: string;
  documentCode: string;
  archiveInnerPath: string;
  sha256: string;
  documentDate: "2026-10-03";
  declaredDocumentFunction: "estado_vigente_na_base" | "referencia_a_estado_externo";
  continuityScope: string;
  currentAuthorityBoundary: string;
};

const DIRECTORY = "BASE_FINAL/04_PAINEL_CENTRAL/02_ESTADOS_VIGENTES/";
export const KNOWLEDGE_ARCHIVE_SOURCES: readonly KnowledgeArchiveSource[] = [
  {
    moduleCode:"CAP",documentCode:"PCL-MST-ESTADO-CAPTURA-CENTRAL-V1.0",
    archiveInnerPath:DIRECTORY+"PCL-MST-ESTADO-CAPTURA-CENTRAL-V1.0.txt",
    sha256:"539a8f7bd641d020870098b1fd104daf83425e3baeb9b756ddc3b1a65bf787ba",
    documentDate:"2026-10-03",declaredDocumentFunction:"estado_vigente_na_base",
    continuityScope:"Captura como entrada universal; distinguir compreensão e sugestão de execução automática.",
    currentAuthorityBoundary:"Documento homologado como estado de continuidade em 03/10/2026; decisões posteriores e mandato atual não verificados.",
  },
  {
    moduleCode:"CRM",documentCode:"PCL-MST-ESTADO-CRM-V1.0",
    archiveInnerPath:DIRECTORY+"PCL-MST-ESTADO-CRM-V1.0.txt",
    sha256:"cb4802d5d7085d3eeaa6161d5b3098a8a7e7820159e8431ebc9835c0a99d5c57",
    documentDate:"2026-10-03",declaredDocumentFunction:"estado_vigente_na_base",
    continuityScope:"CRM em uso real; Resultado, Etapa, Próxima Ação e Estado operacional são entidades distintas.",
    currentAuthorityBoundary:"Fonte de continuidade de 03/10/2026, anterior ao checkpoint CRM UX 02 de 16/10. Mandato do especialista não certificado.",
  },
  {
    moduleCode:"DIG",documentCode:"PCL-MST-ESTADO-DIGITAL-V1.0",
    archiveInnerPath:DIRECTORY+"PCL-MST-ESTADO-DIGITAL-V1.0.txt",
    sha256:"76626a909ae029ada04d3a3cd84236009903e7fee7a71ab3de96602ddaf861df",
    documentDate:"2026-10-03",declaredDocumentFunction:"estado_vigente_na_base",
    continuityScope:"Digital: calendário/campanhas, análise de resultados e relação com o CRM.",
    currentAuthorityBoundary:"Marco de continuidade de 03/10, sem prova de versão posterior ou autoridade nominal do especialista.",
  },
  {
    moduleCode:"FIN",documentCode:"PCL-MST-ESTADO-FINANCEIRO-V1.0",
    archiveInnerPath:DIRECTORY+"PCL-MST-ESTADO-FINANCEIRO-V1.0.txt",
    sha256:"291edc5886d3829915b36d0be79ab96552201946aa3565c82d4dcaa5c3a714e6",
    documentDate:"2026-10-03",declaredDocumentFunction:"estado_vigente_na_base",
    continuityScope:"Financeiro: obrigação financeira e movimentação realizada são fatos diferentes.",
    currentAuthorityBoundary:"Estado de continuidade datado de 03/10; não comprova conciliações, alterações posteriores ou mandato atual.",
  },
  {
    moduleCode:"ROT",documentCode:"PCL-MST-ESTADO-ROTINA-V1.0",
    archiveInnerPath:DIRECTORY+"PCL-MST-ESTADO-ROTINA-V1.0.txt",
    sha256:"5601d187712d2b0bee82ee1bb4bfa601799a997d4ee5c7892d08f6f92d81e947",
    documentDate:"2026-10-03",declaredDocumentFunction:"estado_vigente_na_base",
    continuityScope:"Rotina é o operacional recorrente, separado de Projeto/Planejamento e Foco.",
    currentAuthorityBoundary:"Estado de continuidade 03/10; mudanças subsequentes e identidade do responsável exigem reconciliação.",
  },
  {
    moduleCode:"SHO",documentCode:"PCL-MST-ESTADO-SHOPEE-V1.0",
    archiveInnerPath:DIRECTORY+"PCL-MST-ESTADO-SHOPEE-V1.0.txt",
    sha256:"421b9ae72f3440c3a3e22da5d6c6b83c0b6a334bdc52e00acd887c4da9f68419",
    documentDate:"2026-10-03",declaredDocumentFunction:"estado_vigente_na_base",
    continuityScope:"Integração Shopee: fluxo XLSX/mappings/Pedido/Separação e evolução controlada.",
    currentAuthorityBoundary:"Estado de 03/10 anterior ao Mapa F12 ativo de 12/11; F12 posterior prevalece em matéria específica. Mandato não certificado.",
  },
  {
    moduleCode:"OPE",documentCode:"REFERENCIA_ESTADO_VIGENTE_OPERACOES",
    archiveInnerPath:DIRECTORY+"REFERENCIA_ESTADO_VIGENTE_OPERACOES.txt",
    sha256:"7b84e1ee1914cd29e16f350cb5309000adba5a8f2b4b60a1bfb7da359f200ab3",
    documentDate:"2026-10-03",declaredDocumentFunction:"referencia_a_estado_externo",
    continuityScope:"Não produzir Estado Vigente duplicado: o Mapa Norteador de Operações já exerce essa função.",
    currentAuthorityBoundary:"O original foi RECUPERADO na Biblioteca pessoal de arquivos, com hash e data; não está neste ZIP. Seu status de 18/09/2026 não comprova o estado atual de cada frente ou o mandato nominal.",
  },
];

/**
 * Registro soberano dos Estados em 03/10/2026, encontrado no mesmo ZIP.
 * Este mapa governa QUAL arquivo exerce a função de Estado Vigente naquela
 * fotografia histórica. Não certifica a autoridade nominal atual.
 */
export const HISTORICAL_STATE_REGISTRY = {
  archiveInnerPath: "BASE_FINAL/04_PAINEL_CENTRAL/00_GOVERNANCA/PCL-MAP-REGISTRO-ESTADOS-V1.1.txt",
  documentCode: "PCL-MAP-REGISTRO-ESTADOS-V1.1",
  sha256: "cf995559d8b57c72ba1790f1e10d9b6f5c6b728dcd836f9ebb3c0e3aa5c231cd",
  documentDate: "2026-10-03",
  operationCanonicalReference: "MAPA_NORTEADOR_CONTINUIDADE_MODULO_OPERACOES_V1_0_CONGELADO",
  sourceScope: "Define documentos de Estado Vigente por módulo para o checkpoint de 03/10/2026",
  currentAuthorityBoundary: "Documentos posteriores podem atualizar a leitura sem apagar o Estado de outubro",
} as const;

/**
 * Proveniência posterior precisa ser verificada domínio a domínio.
 * Estes vínculos documentam precedência, NÃO declaram que decisões antigas
 * ou atuais foram automaticamente migradas ou homologadas no Core.
 */
export const SOURCE_RECONCILIATION_BOUNDARIES = [
  {
    moduleCode: "CRM", octSource: "PCL-MST-ESTADO-CRM-V1.0",
    laterSource: "docs/crm/CRM_UX_02_MAPA_EXECUCAO_A31_B31A.md",
    laterDate: "2026-10-16",
    classification: "checkpoint tecnico posterior, sem comprovação de mandato atual",
  },
  {
    moduleCode: "SHO", octSource: "PCL-MST-ESTADO-SHOPEE-V1.0",
    laterSource: "docs/operations/F12_MAPA_CONGELADO_ESCOPO_CONTROLADO_ATIVO_2026-11-12.md",
    laterDate: "2026-11-12",
    classification: "decisão F12 específica posterior: aberta e sob escopo congelado",
  },
  {
    moduleCode: "SAU", octSource: null,
    laterSource: "docs/health/CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v5_4_FROZEN.md",
    laterDate: "2026-11-12",
    classification: "mapa que se declara vigente; ausência de Estado de outubro nesta seção não significa ausência global",
  },
  {
    moduleCode: "OPE", octSource: "REFERENCIA_ESTADO_VIGENTE_OPERACOES",
    laterSource: null, laterDate: null,
    classification: "Mapa Norteador V1.0 ORIGINAL recuperado na Biblioteca, congelado em 18/09/2026; operações atuais requerem confronto posterior e mandato continua não certificado",
  },
  {
    moduleCode: "ASS", octSource: null, laterSource: null, laterDate: null,
    classification: "sem Estado Vigente equivalente localizado nos ZIPs inspecionados, GitHub main ou pesquisa Drive",
  },
] as const;

/**
 * Recuperação de fonte externa à base ZIP, sem copiar conteúdo para o GitHub
 * ou para nucleo_documents. ID de Biblioteca não é uma URL pública.
 * A verificação de 13/11/2026 foi feita sobre os bytes da versão 1.
 */
export const OPERACOES_ORIGINAL_RECOVERED = {
  documentCode: "MAPA_NORTEADOR_CONTINUIDADE_MODULO_OPERACOES_V1_0_CONGELADO",
  filename: "MAPA_NORTEADOR_CONTINUIDADE_MODULO_OPERACOES_V1_0_CONGELADO.txt",
  sourceKind: "biblioteca_chatgpt_pessoal",
  libraryFileId: "libfile_e9cf913c12d081919007231eb532b682",
  sourceVersion: "1",
  frozenAt: "2026-09-18",
  sizeBytes: 22682,
  sha256: "69a7e90f1a68b360abdff4432a93933f841e5062539f09a46819bffcd5274f08",
  authorityAtOrigin: "CONGELADO COMO NORTE VIGENTE DE CONTINUIDADE",
  note: "Documento original de 18 seções recuperado; não foi importado ou republicado. O status e backlog são históricos da data de congelamento e precisam de confronto com mudanças posteriores. Nenhum mandato de especialista foi certificado.",
} as const;
