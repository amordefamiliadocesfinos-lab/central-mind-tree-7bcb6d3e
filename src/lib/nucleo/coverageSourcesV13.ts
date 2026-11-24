// Generated from verified Git blobs; no Core write.
export default [
  {
    "moduleCode": "DIG",
    "label": "Digital — página do módulo",
    "path": "src/pages/Digital.tsx",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "6a1cf104bd6cda8247217d298ae958f79cc51b37c3246327d48da81df0ee8106",
    "authority": "codigo_verificado",
    "note": "Superfícies de código, sem evidência de aceite funcional ou governança do especialista."
  },
  {
    "moduleCode": "ASS",
    "label": "Assistente — página do módulo",
    "path": "src/pages/Assistente.tsx",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "fb971f61fd1588a480f9cc2bf2127657b34f64f4ccd73aeb95d4cdbee91ce0f2",
    "authority": "codigo_verificado",
    "note": "Fluxos presentes em código; autorização e operação não verificadas pelo Núcleo."
  },
  {
    "moduleCode": "OPE",
    "label": "Operações — código da página",
    "path": "src/pages/Operacoes.tsx",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "1e0cffad1da5efa632c47b5d476b5fd071cb8a77f911aadb1772e72e4a754dca",
    "authority": "codigo_verificado",
    "note": "Controles de pedidos, produtos, produção, estoque e logística; sem teste operacional nesta investigação."
  },
  {
    "moduleCode": "OPE",
    "label": "Compras — edição, faturamento e documentos",
    "path": "src/components/operations/PurchasesTab.tsx",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "7fc3e35cda38ce82389089f3db64448ee5fb6ab28b3010eb1d1592e8bc8d18b4",
    "authority": "codigo_verificado",
    "note": "Código de Compras inclui diálogo de condições financeiras e documentação; uso real e conclusão do contrato requerem validação específica."
  },
  {
    "moduleCode": "OPE",
    "label": "Compra ↔ Financeiro — RPCs do código",
    "path": "src/lib/purchases/confirmPurchaseFinancial.ts",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "5b439f9bf52ce5c34508ea4acb0607b9d48a3859c1bb9353cf9be2cb43cdf692",
    "authority": "codigo_verificado",
    "note": "RPCs register_purchase_billing e register_purchase_invoice_billing presentes também no Core; não prova liquidação ou aceitação operacional."
  },
  {
    "moduleCode": "OPE",
    "label": "Documentos de Compra",
    "path": "src/lib/purchases/purchaseDocuments.ts",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "0048447919179bbe5a494d583be2da49f5c18b0a72af2e2ab5bc463aa63464b6",
    "authority": "codigo_verificado",
    "note": "Tabela purchase_documents existe no Core, com funções de listagem/upload no código; sem prova de uso real nesta análise."
  },
  {
    "moduleCode": "OPE",
    "label": "MRP → Compra — passagem de contexto",
    "path": "src/components/operations/MRPTab.tsx",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "8438f92157c618df433481dc17967e30f64f13fcbf79c3e6c283e1cc64b913b3",
    "authority": "codigo_verificado",
    "note": "Abre a aba de Compras com parâmetros da necessidade; não comprova fechamento automático do ciclo ou homologação."
  },
  {
    "moduleCode": "OPE",
    "label": "ET1 — contrato de embalagem P100/EA",
    "path": "docs/operacoes/ET1_EMBALAGEM_TRUFA_P100_EA_CONTRATO_TESTES.md",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "1c627e02559e2c93953ebc436e19ff5a292213f62c66efdcd9af3ec6edc6193f",
    "authority": "historica",
    "note": "Contrato ET1 histórico parcial; PR #355 mergeada em 23/10/2026, mas aplicação de migrations, ativação e homologação física não confirmadas."
  },
  {
    "moduleCode": "OPE",
    "label": "CB3 — nota de engenharia Chocolate Base",
    "path": "docs/operacoes/chocolate-cb3-notas-implementacao-20261021.md",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "3f9a758914d10da4611ac620fa39704a7f613eed4a2db70bd9dd39ecefa3a40c",
    "authority": "historica",
    "note": "Rascunho de engenharia, não documento canônico; não autoriza publicação isolada."
  },
  {
    "moduleCode": "FIN",
    "label": "Financeiro — página e funções",
    "path": "src/pages/Financeiro.tsx",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "84765b516a9fe0a3c686d9c9a6b70bd068c71d6c6a2966e92825c063c5424177",
    "authority": "codigo_verificado",
    "note": "Presença de componentes de lançamentos, pagamentos, extratos e importações; não prova resultados persistidos."
  },
  {
    "moduleCode": "CAP",
    "label": "Captura Central — página e funções",
    "path": "src/pages/CapturaCentral.tsx",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "088b9753b9ed79ebf214ee5788480cc93a39d5cba4e9f697f4ecfdbbbd85445b",
    "authority": "codigo_verificado",
    "note": "Superfície de captura e estado; não representa prova de homologação de classificação ou tarefas."
  },
  {
    "moduleCode": "ROT",
    "label": "Rotina — página e funções",
    "path": "src/pages/Rotina.tsx",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "f008d737a648e15c205792fbf2c1c4798def0daea353451fa8d663bfe6274f56",
    "authority": "codigo_verificado",
    "note": "Presença de estados e ações no código, sem prova independente de funcionamento."
  },
  {
    "moduleCode": "CRM",
    "label": "CRM UX 02 — A3.1/B3.1-A",
    "path": "docs/crm/CRM_UX_02_MAPA_EXECUCAO_A31_B31A.md",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "4321ffc7f38946c30d42d2b1a93e22ff8237b02856ddd3f85a43550066c1c1be",
    "authority": "historica",
    "note": "Execução técnica referenciada em 16/10/2026; experiência autenticada permaneceu pendente no checkpoint."
  },
  {
    "moduleCode": "CRM",
    "label": "CRM — rotas",
    "path": "src/App.tsx",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "3641452d115c998391873ae2864b58b9e812848863c11531b594cbf322cd8f40",
    "authority": "codigo_verificado",
    "note": "/contatos, /contatos/inbox e /contatos/tarefas; não confere a operação."
  },
  {
    "moduleCode": "SAU",
    "label": "CCH — Mapa Soberano Unificado V6.0",
    "path": "docs/health/CCH_MAPA_SOBERANO_UNIFICADO_V6_0_FROZEN_2026-11-24.md",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "e28ab7af0260b748b37b6d4601887d07a5496627af2cc4e0afb6fad805eddca3",
    "authority": "vigente_declarada",
    "note": "Índice normativo de continuidade datado de 24/11/2026; preserva os portões de implantação e a privacidade do módulo."
  },
  {
    "moduleCode": "SAU",
    "label": "CCH — Mapa Soberano v5.4",
    "path": "docs/health/CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v5_4_FROZEN.md",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "e55992d07f7a149b550f9ba6d71da77cfec759bb72d6084861b25e5c24a0f9be",
    "authority": "historica",
    "note": "Data 12/11/2026; substitui v5.3. Implementação e uso real devem permanecer separados."
  },
  {
    "moduleCode": "SAU",
    "label": "CCH — Matriz de cobertura v3",
    "path": "docs/health/CCH_REQUIREMENTS_COVERAGE_MATRIX_v3_2026-11-09.md",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "294dae88dcd0709188fde2b5f9b4b2109ac4d6890163ef327a9e904533c6a659",
    "authority": "historica",
    "note": "Matriz datada de 09/11/2026, com distinção entre implementação em código e gates."
  },
  {
    "moduleCode": "SAU",
    "label": "Saúde — rotas e páginas",
    "path": "src/modules/health/HealthModule.tsx",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "4a9b42d3fa480b478c5989d7e0f2bf29f4113ad94c39d75cdbb524089b1529a2",
    "authority": "codigo_verificado",
    "note": "Mapa de componentes, não validação clínica, de autorização ou da experiência de usuário."
  },
  {
    "moduleCode": "SHO",
    "label": "F12 — mapa congelado, frente ativa",
    "path": "docs/operations/F12_MAPA_CONGELADO_ESCOPO_CONTROLADO_ATIVO_2026-11-12.md",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "17ed550f15ee8ef6836ec190cd10218712466587dca6b0e20cd9289fb353b624",
    "authority": "vigente_declarada",
    "note": "Decisão 12/11/2026: F12 aberta. Evidência de código, publicação e homologação são categorias diferentes."
  },
  {
    "moduleCode": "SHO",
    "label": "Mapa Mestre Integração Shopee V2",
    "path": "docs/operations/MAPA_MESTRE_INTEGRACAO_SHOPEE_PAINEL_CENTRAL_V2.md",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "e8ef8eae9a0fa26e21bc62b324072314d4d92e67e0cc77d3452ab2ce8f9114a0",
    "authority": "vigente_declarada",
    "note": "Autoridade documental declarada pela F12. Não representa autorização de execução de pedidos."
  },
  {
    "moduleCode": "SHO",
    "label": "F12 — encerramento histórico retificado",
    "path": "docs/operations/F12_ENCERRAMENTO_ADMINISTRATIVO_E_REPASSE_2026-11-12.md",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "39e5a986c234de020c46ac52c96a95fce3cd76b8fbd535d45d406b4a82b9ac13",
    "authority": "historica",
    "note": "Referência histórica retificada; NÃO tratar a frente como encerrada."
  },
  {
    "moduleCode": "NUC",
    "label": "Continuidade Canônica V1.1",
    "path": "docs/architecture/MAPA_CONTINUIDADE_CANONICA_ESPECIALISTAS_NUCLEO20_V1_1_CONGELADO_PLANEJAMENTO_2026-11-19.md",
    "commit": "5b56d64b7b009649ac331182a12932661213ae1e",
    "sha256": "85378afcc24b395104de79f43e173a7c1d7b4e7129f3afe246a88cc08791f24f",
    "authority": "vigente_declarada",
    "note": "Planejamento congelado, sem homologação produtiva."
  }
] as const;
