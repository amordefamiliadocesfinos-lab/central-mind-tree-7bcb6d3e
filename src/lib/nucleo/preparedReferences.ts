// Generated from coverage-batches-prepared.json and the four recovered states (PR #1075).
// Metadata only. No identity, authority, or write is inferred.
export type PreparedReference={moduleId:string;title:string;kind:string;locator:string;checksum:string;note:string;requestId:string;retained:boolean};
export const preparedReferences:readonly PreparedReference[]=[
  {
    "moduleId": "4b3b4b50-48e8-495d-a42e-bae9d20a8a15",
    "title": "Digital — página do módulo",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/src/pages/Digital.tsx",
    "checksum": "6a1cf104bd6cda8247217d298ae958f79cc51b37c3246327d48da81df0ee8106",
    "note": "Inventário de fonte, não método homologado. Superfícies de código, sem evidência de aceite funcional ou governança do especialista.",
    "requestId": "a778e20c-c68d-8052-a3f3-72c2f82d0d00",
    "retained": false
  },
  {
    "moduleId": "d587170d-c77e-4d20-a638-74db67d407e0",
    "title": "Assistente — página do módulo",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/src/pages/Assistente.tsx",
    "checksum": "fb971f61fd1588a480f9cc2bf2127657b34f64f4ccd73aeb95d4cdbee91ce0f2",
    "note": "Inventário de fonte, não método homologado. Fluxos presentes em código; autorização e operação não verificadas pelo Núcleo.",
    "requestId": "3dc89393-8454-835e-b1af-16aee4397b64",
    "retained": false
  },
  {
    "moduleId": "db57b5cf-b621-4c05-8d80-054e7289c878",
    "title": "Operações — código da página",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/src/pages/Operacoes.tsx",
    "checksum": "1e0cffad1da5efa632c47b5d476b5fd071cb8a77f911aadb1772e72e4a754dca",
    "note": "Inventário de fonte, não método homologado. Controles de pedidos, produtos, produção, estoque e logística; sem teste operacional nesta investigação.",
    "requestId": "ee917cdd-01e7-86c3-a364-99ecf8fbe0a5",
    "retained": false
  },
  {
    "moduleId": "db57b5cf-b621-4c05-8d80-054e7289c878",
    "title": "Compras — edição, faturamento e documentos",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/src/components/operations/PurchasesTab.tsx",
    "checksum": "7fc3e35cda38ce82389089f3db64448ee5fb6ab28b3010eb1d1592e8bc8d18b4",
    "note": "Inventário de fonte, não método homologado. Código de Compras inclui diálogo de condições financeiras e documentação; uso real e conclusão do contrato requerem validação específica.",
    "requestId": "5a4092ed-a8c3-881a-b0dc-b294d74578ec",
    "retained": false
  },
  {
    "moduleId": "db57b5cf-b621-4c05-8d80-054e7289c878",
    "title": "Compra ↔ Financeiro — RPCs do código",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/src/lib/purchases/confirmPurchaseFinancial.ts",
    "checksum": "5b439f9bf52ce5c34508ea4acb0607b9d48a3859c1bb9353cf9be2cb43cdf692",
    "note": "Inventário de fonte, não método homologado. RPCs register_purchase_billing e register_purchase_invoice_billing presentes também no Core; não prova liquidação ou aceitação operacional.",
    "requestId": "e56cbf5f-8da3-8220-8427-cb2eea242b33",
    "retained": false
  },
  {
    "moduleId": "db57b5cf-b621-4c05-8d80-054e7289c878",
    "title": "Documentos de Compra",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/src/lib/purchases/purchaseDocuments.ts",
    "checksum": "0048447919179bbe5a494d583be2da49f5c18b0a72af2e2ab5bc463aa63464b6",
    "note": "Inventário de fonte, não método homologado. Tabela purchase_documents existe no Core, com funções de listagem/upload no código; sem prova de uso real nesta análise.",
    "requestId": "ae3fc127-a177-83bb-84cc-669f79655ed5",
    "retained": false
  },
  {
    "moduleId": "db57b5cf-b621-4c05-8d80-054e7289c878",
    "title": "MRP → Compra — passagem de contexto",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/src/components/operations/MRPTab.tsx",
    "checksum": "8438f92157c618df433481dc17967e30f64f13fcbf79c3e6c283e1cc64b913b3",
    "note": "Inventário de fonte, não método homologado. Abre a aba de Compras com parâmetros da necessidade; não comprova fechamento automático do ciclo ou homologação.",
    "requestId": "6f53a92c-ff5d-8d8d-a47c-db6f8160cff2",
    "retained": false
  },
  {
    "moduleId": "db57b5cf-b621-4c05-8d80-054e7289c878",
    "title": "ET1 — contrato de embalagem P100/EA",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/docs/operacoes/ET1_EMBALAGEM_TRUFA_P100_EA_CONTRATO_TESTES.md",
    "checksum": "1c627e02559e2c93953ebc436e19ff5a292213f62c66efdcd9af3ec6edc6193f",
    "note": "Inventário de fonte, não método homologado. Contrato ET1 histórico parcial; PR #355 mergeada em 23/10/2026, mas aplicação de migrations, ativação e homologação física não confirmadas.",
    "requestId": "fd732b33-e133-86d2-8583-b7b5be4f96aa",
    "retained": false
  },
  {
    "moduleId": "db57b5cf-b621-4c05-8d80-054e7289c878",
    "title": "CB3 — nota de engenharia Chocolate Base",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/docs/operacoes/chocolate-cb3-notas-implementacao-20261021.md",
    "checksum": "3f9a758914d10da4611ac620fa39704a7f613eed4a2db70bd9dd39ecefa3a40c",
    "note": "Inventário de fonte, não método homologado. Rascunho de engenharia, não documento canônico; não autoriza publicação isolada.",
    "requestId": "eccd71df-62eb-889f-9a3d-3fc70f4978f8",
    "retained": false
  },
  {
    "moduleId": "fd862761-1261-4d31-8f37-7a03af61977a",
    "title": "Financeiro — página e funções",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/src/pages/Financeiro.tsx",
    "checksum": "84765b516a9fe0a3c686d9c9a6b70bd068c71d6c6a2966e92825c063c5424177",
    "note": "Inventário de fonte, não método homologado. Presença de componentes de lançamentos, pagamentos, extratos e importações; não prova resultados persistidos.",
    "requestId": "f961ed14-4cba-8fc7-901b-f7ed37782096",
    "retained": false
  },
  {
    "moduleId": "1a68b07b-d6c5-4c80-9ec5-401235a9b742",
    "title": "Captura Central — página e funções",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/src/pages/CapturaCentral.tsx",
    "checksum": "088b9753b9ed79ebf214ee5788480cc93a39d5cba4e9f697f4ecfdbbbd85445b",
    "note": "Inventário de fonte, não método homologado. Superfície de captura e estado; não representa prova de homologação de classificação ou tarefas.",
    "requestId": "e3c09b8e-5875-88f5-9989-2bb3cf30f833",
    "retained": false
  },
  {
    "moduleId": "75e54d32-d287-4d7c-8af8-dd862b10857e",
    "title": "Rotina — página e funções",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/src/pages/Rotina.tsx",
    "checksum": "f008d737a648e15c205792fbf2c1c4798def0daea353451fa8d663bfe6274f56",
    "note": "Inventário de fonte, não método homologado. Presença de estados e ações no código, sem prova independente de funcionamento.",
    "requestId": "489b521e-75f9-808e-9f19-c31d9a982281",
    "retained": false
  },
  {
    "moduleId": "f07bb967-788a-45eb-bce7-242581d74cd4",
    "title": "CRM UX 02 — A3.1/B3.1-A",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/docs/crm/CRM_UX_02_MAPA_EXECUCAO_A31_B31A.md",
    "checksum": "4321ffc7f38946c30d42d2b1a93e22ff8237b02856ddd3f85a43550066c1c1be",
    "note": "Inventário de fonte, não método homologado. Execução técnica referenciada em 16/10/2026; experiência autenticada permaneceu pendente no checkpoint.",
    "requestId": "a8748601-8b8b-835f-a612-1ac26ea3e949",
    "retained": false
  },
  {
    "moduleId": "f07bb967-788a-45eb-bce7-242581d74cd4",
    "title": "CRM — rotas",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/src/App.tsx",
    "checksum": "3641452d115c998391873ae2864b58b9e812848863c11531b594cbf322cd8f40",
    "note": "Inventário de fonte, não método homologado. /contatos, /contatos/inbox e /contatos/tarefas; não confere a operação.",
    "requestId": "8eda5fc5-0cff-8c2c-8524-2ea129205b98",
    "retained": false
  },
  {
    "moduleId": "a0974b54-e8bf-46a0-8998-af5f667e1c8a",
    "title": "CCH — Mapa Soberano Unificado V6.0",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/docs/health/CCH_MAPA_SOBERANO_UNIFICADO_V6_0_FROZEN_2026-11-24.md",
    "checksum": "e28ab7af0260b748b37b6d4601887d07a5496627af2cc4e0afb6fad805eddca3",
    "note": "Inventário de fonte, não método homologado. Índice normativo de continuidade datado de 24/11/2026; preserva os portões de implantação e a privacidade do módulo.",
    "requestId": "41b5f71a-c543-8aec-84ac-f25f9e96408c",
    "retained": false
  },
  {
    "moduleId": "a0974b54-e8bf-46a0-8998-af5f667e1c8a",
    "title": "CCH — Mapa Soberano v5.4",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/docs/health/CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v5_4_FROZEN.md",
    "checksum": "e55992d07f7a149b550f9ba6d71da77cfec759bb72d6084861b25e5c24a0f9be",
    "note": "Inventário de fonte, não método homologado. Data 12/11/2026; substitui v5.3. Implementação e uso real devem permanecer separados.",
    "requestId": "615e4548-f96b-8551-89fa-ad81ad2d003c",
    "retained": false
  },
  {
    "moduleId": "a0974b54-e8bf-46a0-8998-af5f667e1c8a",
    "title": "CCH — Matriz de cobertura v3",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/docs/health/CCH_REQUIREMENTS_COVERAGE_MATRIX_v3_2026-11-09.md",
    "checksum": "294dae88dcd0709188fde2b5f9b4b2109ac4d6890163ef327a9e904533c6a659",
    "note": "Inventário de fonte, não método homologado. Matriz datada de 09/11/2026, com distinção entre implementação em código e gates.",
    "requestId": "b22c7814-a226-8782-b640-57842bfa16dd",
    "retained": false
  },
  {
    "moduleId": "a0974b54-e8bf-46a0-8998-af5f667e1c8a",
    "title": "Saúde — rotas e páginas",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/src/modules/health/HealthModule.tsx",
    "checksum": "4a9b42d3fa480b478c5989d7e0f2bf29f4113ad94c39d75cdbb524089b1529a2",
    "note": "Inventário de fonte, não método homologado. Mapa de componentes, não validação clínica, de autorização ou da experiência de usuário.",
    "requestId": "27aa729d-a4ff-88a4-a115-5556be8ac9f9",
    "retained": false
  },
  {
    "moduleId": "3d9351f1-75e0-4581-86e1-edb902532ae3",
    "title": "F12 — mapa congelado, frente ativa",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/docs/operations/F12_MAPA_CONGELADO_ESCOPO_CONTROLADO_ATIVO_2026-11-12.md",
    "checksum": "17ed550f15ee8ef6836ec190cd10218712466587dca6b0e20cd9289fb353b624",
    "note": "Inventário de fonte, não método homologado. Decisão 12/11/2026: F12 aberta. Evidência de código, publicação e homologação são categorias diferentes.",
    "requestId": "449b7495-c594-8e3a-9648-bfbb368a1a8a",
    "retained": false
  },
  {
    "moduleId": "3d9351f1-75e0-4581-86e1-edb902532ae3",
    "title": "Mapa Mestre Integração Shopee V2",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/docs/operations/MAPA_MESTRE_INTEGRACAO_SHOPEE_PAINEL_CENTRAL_V2.md",
    "checksum": "e8ef8eae9a0fa26e21bc62b324072314d4d92e67e0cc77d3452ab2ce8f9114a0",
    "note": "Inventário de fonte, não método homologado. Autoridade documental declarada pela F12. Não representa autorização de execução de pedidos.",
    "requestId": "754b8ad1-b933-8d5f-9aeb-4a8e17c42908",
    "retained": false
  },
  {
    "moduleId": "3d9351f1-75e0-4581-86e1-edb902532ae3",
    "title": "F12 — encerramento histórico retificado",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/docs/operations/F12_ENCERRAMENTO_ADMINISTRATIVO_E_REPASSE_2026-11-12.md",
    "checksum": "39e5a986c234de020c46ac52c96a95fce3cd76b8fbd535d45d406b4a82b9ac13",
    "note": "Inventário de fonte, não método homologado. Referência histórica retificada; NÃO tratar a frente como encerrada.",
    "requestId": "5508cda5-e081-8812-b9ef-fab5310f57e1",
    "retained": false
  },
  {
    "moduleId": "636768e6-e782-4c7d-8132-e7381621be12",
    "title": "Continuidade Canônica V1.1",
    "kind": "arquivo",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/5b56d64b7b009649ac331182a12932661213ae1e/docs/architecture/MAPA_CONTINUIDADE_CANONICA_ESPECIALISTAS_NUCLEO20_V1_1_CONGELADO_PLANEJAMENTO_2026-11-19.md",
    "checksum": "85378afcc24b395104de79f43e173a7c1d7b4e7129f3afe246a88cc08791f24f",
    "note": "Inventário de fonte, não método homologado. Planejamento congelado, sem homologação produtiva.",
    "requestId": "7dbd963c-1729-8ed8-8e6d-120ee641928c",
    "retained": true
  },
  {
    "moduleId": "fd862761-1261-4d31-8f37-7a03af61977a",
    "title": "Estado Mestre Financeiro V1.0 — 03/10/2026",
    "kind": "mapa",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/7bc90a08e214bf6c3c67beadb7ce2cc13f7753fb/docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-FINANCEIRO-V1.0.txt",
    "checksum": "291edc5886d3829915b36d0be79ab96552201946aa3565c82d4dcaa5c3a714e6",
    "note": "Fonte histórica recuperada do ZIP oficial. Vigência declarada em 03/10/2026; atualidade a reconciliar. Proposta de referência, não nova homologação.",
    "requestId": "291edc58-86d3-8299-a5b3-6d0be79ab965",
    "retained": false
  },
  {
    "moduleId": "4b3b4b50-48e8-495d-a42e-bae9d20a8a15",
    "title": "Estado Mestre Digital V1.0 — 03/10/2026",
    "kind": "mapa",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/7bc90a08e214bf6c3c67beadb7ce2cc13f7753fb/docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-DIGITAL-V1.0.txt",
    "checksum": "76626a909ae029ada04d3a3cd84236009903e7fee7a71ab3de96602ddaf861df",
    "note": "Fonte histórica recuperada do ZIP oficial. Vigência declarada em 03/10/2026; atualidade a reconciliar. Proposta de referência, não nova homologação.",
    "requestId": "76626a90-9ae0-89ad-a04d-3a3cd8423600",
    "retained": false
  },
  {
    "moduleId": "1a68b07b-d6c5-4c80-9ec5-401235a9b742",
    "title": "Estado Mestre Captura Central V1.0 — 03/10/2026",
    "kind": "mapa",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/7bc90a08e214bf6c3c67beadb7ce2cc13f7753fb/docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-CAPTURA-CENTRAL-V1.0.txt",
    "checksum": "539a8f7bd641d020870098b1fd104daf83425e3baeb9b756ddc3b1a65bf787ba",
    "note": "Fonte histórica recuperada do ZIP oficial. Vigência declarada em 03/10/2026; atualidade a reconciliar. Proposta de referência, não nova homologação.",
    "requestId": "539a8f7b-d641-8020-a700-98b1fd104daf",
    "retained": false
  },
  {
    "moduleId": "75e54d32-d287-4d7c-8af8-dd862b10857e",
    "title": "Estado Mestre Rotina V1.0 — 03/10/2026",
    "kind": "mapa",
    "locator": "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/7bc90a08e214bf6c3c67beadb7ce2cc13f7753fb/docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-ROTINA-V1.0.txt",
    "checksum": "5601d187712d2b0bee82ee1bb4bfa601799a997d4ee5c7892d08f6f92d81e947",
    "note": "Fonte histórica recuperada do ZIP oficial. Vigência declarada em 03/10/2026; atualidade a reconciliar. Proposta de referência, não nova homologação.",
    "requestId": "5601d187-712d-8b0b-ae82-ee1bb4bfa601",
    "retained": false
  }
];
export function isPreparedDuplicate(p:PreparedReference, rows:readonly {source_locator:string;source_checksum_sha256:string|null;request_id:string}[]){return p.retained||rows.some(r=>r.request_id===p.requestId||r.source_locator===p.locator||r.source_checksum_sha256===p.checksum);}
