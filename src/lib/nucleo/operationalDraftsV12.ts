/**
 * Núcleo V1.2 — propostas operacionais para revisão humana; NÃO são revisões
 * persistidas nem documentos homologados. Cada fato remete ao código ou ao
 * checkpoint histórico do CRM no GitHub. O administrador deve ler, ajustar
 * e salvar manualmente um rascunho com autoria via sessão autenticada.
 */
export type ModuleDraft = {
  title: string;
  body: string;
  source: string;
};
export type DraftSection = "FM-01"|"FM-02"|"FM-03"|"FM-04"|"FM-05"|"FM-06"|"FM-07"|"FM-08"|"FM-09"|"FM-10";
const ROUTES = "src/App.tsx; src/pages/Contatos.tsx; src/pages/ContatosInbox.tsx";
const UX = "docs/crm/CRM_UX_02_MAPA_EXECUCAO_A31_B31A.md";
const BAR = "src/components/crm/AttendanceActionBar.tsx";
export const CRM_DRAFTS: Partial<Record<DraftSection,ModuleDraft>> = {
  "FM-01": {
    title: "CRM — identidade e finalidade (rascunho)",
    body: "O CRM é o módulo comercial de contatos e atendimento do Painel Central. Rotas observadas no roteador: /contatos (visão principal), /contatos/inbox (caixa de atendimentos) e /contatos/tarefas (tarefas agendadas). Finalidade documentada no piloto: apoiar a organização dos contatos, a triagem e o registro de desfechos e próximas ações. Especialista CRM é um papel funcional; a identidade persistente, seu método atual e a autoridade de cada documento ainda precisam de reconciliação. Esta ficha é um rascunho fundamentado em código, não uma homologação de fluxos em uso real.",
    source: ROUTES,
  },
  "FM-02": {
    title: "CRM — visão rápida (rascunho)",
    body: "Para iniciar um atendimento: abrir /contatos/inbox, selecionar o contato/conversa, consultar o histórico e a próxima ação. A fila e os filtros ajudam a localizar prioridades, mas sua execução real depende das permissões e do contexto. Registrar resultado descreve o que de fato ocorreu; Adiar agenda uma nova análise e não equivale a um resultado comercial. A escolha de um resultado não confirma gravação: é preciso acionar Confirmar resultado e conferir o retorno. Links: /contatos, /contatos/inbox e /contatos/tarefas. Não usar este texto como instrução para execução autônoma por IA.",
    source: ROUTES+"; "+BAR,
  },
  "FM-03": {
    title: "CRM — limites e fronteiras (rascunho)",
    body: "Preservar a distinção entre cadastro, conversa, Resultado, próxima ação e adiamento. O checkpoint CRM UX 02 exige evitar a criação de escritores concorrentes, proteger edições pendentes e preservar a conversa. Gestão, Financeiro, Operações e Captura Central possuem responsabilidades próprias: não assumir alteração de seus registros a partir de um manual do Núcleo. A classificação do método vigente e a homologação da experiência atual permanecem pendentes.",
    source: UX,
  },
  "FM-04": {
    title: "CRM — mapa inicial de telas (rascunho)",
    body: "Rotas observadas em src/App.tsx: /contatos, /contatos/inbox, /contatos/tarefas. O checkpoint histórico UX 02 descreve a faixa de filtros A3.1 e ficha de contato B3.1-A na terceira coluna da Inbox, com dados principais, seções fiscais, endereço e financeiro. Os oito incrementos A-01/A-02/B-01...B-06 foram registrados como integrados em 16/10/2026; seu teste UAT autenticado permanecia pendente naquele checkpoint. Rota identificada no código não equivale a tela testada agora.",
    source: ROUTES+"; "+UX,
  },
  "FM-05": {
    title: "CRM — catálogo de ações relevantes (rascunho)",
    body: "Registrar resultado (AttendanceActionBar): abre formulário contextual, solicita opção de resultado e, quando necessário, data; Confirmar resultado aciona o fluxo de gravação; o formulário só fecha após retorno confirmado, mas isso não substitui readback de produção. Adiar: oferece Amanhã, 3 dias, 7 dias ou data, com confirmação específica, sem fabricar resultado. Preparar contato no WhatsApp (CrmFocusQueue): inicia contato externo; não comprova mensagem entregue nem encerra atendimento. O checkpoint UX 02 cita também Concluir atendimento, Registrar venda e Tirar/Voltar para fila como ações críticas, mas esta proposta NÃO descreve seus efeitos sem revisão funcional específica.",
    source: BAR+"; src/components/crm/CrmFocusQueue.tsx; "+UX,
  },
  "FM-06": {
    title: "CRM — jornada de triagem e registro (rascunho)",
    body: "1. Abrir a Caixa de atendimentos e selecionar um contato autorizado. 2. Conferir histórico, estágio, conversa e próxima ação. 3. Se necessário, abrir o contato externo; verificar pessoalmente o que ocorreu. 4. Para um desfecho verdadeiro, escolher Registrar resultado, selecionar a opção e acionar Confirmar resultado; uma escolha sem confirmação não persiste. 5. Se não há desfecho e a análise precisa ser postergada, utilizar Adiar e conferir a data/posição na fila. 6. Em caso de falha ou contexto inesperado, não presumir sucesso; consultar o histórico e registrar a pendência. Jornada baseada em código/escopo documentado, ainda sem ensaio independente do operador.",
    source: ROUTES+"; "+BAR,
  },
  "FM-07": {
    title: "CRM — fontes e limites de evidência (rascunho)",
    body: "Fontes: roteador src/App.tsx; código operacional AttendanceActionBar.tsx e CrmFocusQueue.tsx; mapa UX 02 histórico de 16/10/2026; PRs #296 (escritor canônico) e #297 (ficha responsiva), registradas como mergeadas. No Núcleo, a frente CRM-UX02 possui duas evidências GitHub M4 append-only. Essas evidências provam o registro técnico e o vínculo, não o deploy corrente nem a homologação de toda operação. Não incorporar dados pessoais de clientes a esta ficha.",
    source: ROUTES+"; "+BAR+"; "+UX,
  },
  "FM-08": {
    title: "CRM — governança do especialista (rascunho)",
    body: "O mapa CRM UX 02 registra CRM 7 como responsável técnico no checkpoint de 16/10/2026 e decisões congeladas de A3.1/B3.1-A. Isso comprova um registro histórico de especialidade, NÃO a identidade atual de um especialista persistente ou o método vigente. Antes de homologar este campo, verificar mandato, métodos atuais, versões, ecossistema, documentos soberanos, histórico de transferência entre chats e autoridade da Camada Mestre. Não atribuir nome pessoal nem promover documento provisório.",
    source: UX,
  },
  "FM-09": {
    title: "CRM — evolução técnica e pendências (rascunho)",
    body: "O mapa CRM UX 02 registra A3.1 (filtros e indicadores da Inbox) e B3.1-A (ficha do contato na terceira coluna). No checkpoint final de 16/10/2026, os oito incrementos A-01, A-02 e B-01 a B-06 estavam integrados, com CI técnica aprovada. As PRs #283, #284, #286, #287, #290, #291, #296 e #297 são referências de integração naquele marco; os trabalhos #292, #293 e #294 foram substituídos e não devem ser confundidos com entregas atuais. O próprio mapa exige UAT autenticada em desktop, largura intermediária e celular; conferir filtro, edição fiscal/endereço/financeiro, próxima ação, opt-out, navegação com rascunho pendente, conversa e ações críticas. A existência de código e merge não prova deploy atual nem aceite funcional. O registro CRM-UX02 do Núcleo acompanha o checkpoint, não deve encerrar a frente por inferência.",
    source: UX+"; src/components/crm/AttendanceActionBar.tsx; src/components/crm/CrmFocusQueue.tsx",
  },
  "FM-10": {
    title: "CRM — aprendizados reutilizáveis e limites (rascunho)",
    body: "Aprendizado do mapa UX 02: centralizar a escrita canônica de Próxima Ação, sem usar atualização genérica de contatos para os campos operacionais; preservar opt-out, histórico e autorizações ao editar apenas campos alterados. Para evitar perda de dados em telas concorrentes, manter estados Pendente → Salvando → Salvo/Erro e proteger troca de contato, aba, seção ou rota enquanto houver edição pendente. Outra decisão importante é preservar editores e ações antigas até comprovar cobertura real do substituto; não eliminar caminhos funcionais apenas porque a nova UI foi integrada. Essas são regras documentadas no checkpoint técnico, NÃO validação atual de todos os cenários. Aprendizado de uso real, causas de falha e medidas de desempenho ainda exigem evidência específica do operador e especialista; não inventar métricas nem resultados.",
    source: UX,
  }
};


/**
 * Propostas de metadados para o mapa CCH v5.4 de 12/11/2026.
 * A Ficha Viva permanece vazia até revisão e gravação HUMANA autenticada.
 * Não são prescrições, dados de pacientes, nem autorização clínica/operacional.
 */
const CCH_MAP = "docs/health/CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v5_4_FROZEN.md";
const CCH_ROUTES = "src/modules/health/HealthModule.tsx";
export const CCH_DRAFTS: Partial<Record<DraftSection,ModuleDraft>> = {
  "FM-01": {
    title: "Saúde/CCH — identidade do módulo (rascunho)",
    body: "O módulo Saúde/CCH integra a rota /saude/* no Painel Central. Seu Mapa Soberano v5.4, datado de 12/11/2026, declara-se VIGENTE e FROZEN e substitui a v5.3. A fonte registra M0–M9 como fundação, F10–F22 como implementadas, F22 operacional no Lovable Cloud e F23 não aberta. Esses estados pertencem ao documento do CCH e não representam uma homologação adicional do Núcleo. Não inserir dados pessoais, prescrições ou histórico de praticantes nesta Ficha Viva.",
    source: CCH_MAP+"; "+CCH_ROUTES,
  },
  "FM-03": {
    title: "Saúde/CCH — fronteiras da calibração (rascunho)",
    body: "O Mapa Soberano v5.4 distingue nível do praticante (beginner, intermediate, advanced), confiança do CCH nos dados (unknown, low, medium, high) e fase real do treinamento. Esses são conceitos diferentes. A confiança pode variar por exercício e confiança baixa não deve reduzir automaticamente volume, intensidade, frequência ou complexidade. A publicação exige prescrição completa para cada exercício obrigatório. Não atribuir estado aprovado à jornada inteira apenas porque existe código.",
    source: CCH_MAP,
  },
  "FM-04": {
    title: "Saúde/CCH — mapa de rotas técnicas (rascunho)",
    body: "As rotas do HealthModule incluem /saude/hoje, /saude/treino, /saude/treino/atividades, /saude/treino/historico, /saude/treino/programa, /saude/alimentacao, /saude/evolucao, /saude/recuperacao, /saude/exames, /saude/revisao, /saude/replanejamento, /saude/relatorios, /saude/rotina, /saude/analytics, /saude/perfil e /saude/biblioteca. Identificação de rotas no código não demonstra publicação, acesso permitido a todos os usuários ou validação visual.",
    source: CCH_ROUTES,
  },
  "FM-08": {
    title: "Saúde/CCH — autoridade e especialista (rascunho)",
    body: "A fonte documental CCH v5.4 declara-se soberana e congelada em 12/11/2026. O especialista técnico atual, seu mandato, versão de método e eventual sucessão ainda precisam ser vinculados à governança do Núcleo por evidência própria; não deduzir identidade nominal a partir do conteúdo do mapa. Preservar as fronteiras de autorização do módulo Saúde e não tratar a supervisão M5 read-only como executor de treinos ou intervenções.",
    source: CCH_MAP,
  },
};


/**
 * Acompanhamento F12: propostas documentais, não instruções para executar API,
 * pedidos, ship_order, etiquetas, Scheduler ou reconciliação automaticamente.
 * Preserva o escopo e as fases da frente operacional original.
 */
const F12_MAP = "docs/operations/F12_MAPA_CONGELADO_ESCOPO_CONTROLADO_ATIVO_2026-11-12.md";
const SHP_MASTER = "docs/operations/MAPA_MESTRE_INTEGRACAO_SHOPEE_PAINEL_CENTRAL_V2.md";
export const SHOPEE_DRAFTS: Partial<Record<DraftSection,ModuleDraft>> = {
  "FM-01": {
    title: "Shopee / Integração — identidade e escopo (rascunho)",
    body: "O Núcleo acompanha a integração Shopee / Integration Hub por metadados e evidências verificadas. A autoridade declarada é o Mapa Mestre Integração Shopee V2 e a F12, que está ABERTA, em desenvolvimento sob escopo congelado em 12/11/2026. A frente operacional pertence ao especialista Integração Shopee e não é executada pelo Núcleo. As subfrentes existentes são F12.1 lote inicial 3+3, F12.2 fila justa, F12.3 retomada / meta de 100 pedidos por dia, e F12.4 multicontas. Congelamento não equivale a encerramento ou homologação.",
    source: F12_MAP+"; "+SHP_MASTER,
  },
  "FM-03": {
    title: "Shopee / Integração — limites e autorizações (rascunho)",
    body: "A fonte F12 exige preservar escritores, pré-verificações LIVE, controle de claims duráveis, tombstones, separação conta+pedido+pacote, orçamento 3+3 e reconciliação antes de retries. A F12 não autoriza, por mero recebimento/etiqueta, iniciar OP, produção, estoque, Financeiro, CRM, impressão ou postagem. Código mergeado, deployment, teste sintético, operação real e homologação são provas distintas. O Núcleo M5 permanece somente leitura; esta Ficha Viva não habilita worker, Scheduler, pedidos, etiquetas, importação ou mudança multicontas.",
    source: F12_MAP,
  },
  "FM-06": {
    title: "Shopee / Integração — jornada de acompanhamento humano (rascunho)",
    body: "1. Identificar a frente F12 no Núcleo e abrir sua ficha documental. 2. Comparar F12.1–F12.4 com o Mapa Mestre e com a versão vigente, sem supor progresso a partir de código isolado. 3. Conferir evidências distintas de PR GitHub, implantação e operação real disponibilizadas pelo especialista competente; se ausentes, registrar lacuna. 4. Manter F12.1 com prova incompleta do máximo 3+3; F12.2 aguardando confirmação de deploy/ciclos; F12.3 com teste de concorrência real e piloto legítimo ainda pendentes; F12.4 não iniciada. 5. Solicitar ao especialista a confirmação de qualquer nova prova e à autoridade competente a decisão de homologação; nunca disparar ações Shopee pelo Núcleo. Esta é uma jornada de acompanhamento documental proposta, não procedimento operacional para processar pedidos.",
    source: F12_MAP+"; "+SHP_MASTER,
  },
  "FM-07": {
    title: "Shopee / Integração — evidências e gates F12 (rascunho)",
    body: "F12.1: código na main, dois envios no mesmo ciclo e PDFs no Core registrados na fonte, sem prova do teto 3 por tipo nem métricas completas. F12.2: PRs #623 e #625 integradas, mas o mapa não comprova publicação da última alteração no ambiente Adão isolado. F12.3: checkpoint durável aplicado ao Core e ensaios sintéticos realizados; o mapa declara pendentes a prova concorrente de duas sessões reais, autorização de piloto legítimo e throughput de 100/dia. F12.4: não iniciada. Toda nova afirmação exige data, origem e prova própria; este modelo não faz consulta LIVE e não certifica operação atual.",
    source: F12_MAP,
  },
  "FM-08": {
    title: "Shopee / Integração — método e responsabilidade (rascunho)",
    body: "O método da F12 exige desenvolvimento pela frente especialista de Integração Shopee, GitHub como fonte de código e Lovable Cloud/Core como verdade operacional, com implantação isolada e autorização explícita. O mapa descreve a ordem F12.1 → F12.2 → F12.3 → F12.4 e proíbe criar frente paralela. A identidade nominal vigente do especialista e a eventual sucessão ainda precisam ser reconciliadas pela autoridade competente. O Núcleo só espelha registros existentes para acompanhamento humano; decisões de deploy, migrations, pedidos e escala são externas à Ficha Viva.",
    source: F12_MAP+"; "+SHP_MASTER,
  },
};


/**
 * Os quatro inventários abaixo são propostas de conhecimento baseadas em
 * superfícies de código. Não estabelecem que os procedimentos estejam
 * homologados, nem atribuem o especialista vigente.
 * O contrato ET1 é referência HISTÓRICA de implantação parcial, não gate aberto.
 */
const OP_PAGE = "src/pages/Operacoes.tsx";
const ET1_DOC = "docs/operacoes/ET1_EMBALAGEM_TRUFA_P100_EA_CONTRATO_TESTES.md";
const FIN_PAGE = "src/pages/Financeiro.tsx";
const CAP_PAGE = "src/pages/CapturaCentral.tsx";
const ROT_PAGE = "src/pages/Rotina.tsx";

export const OPERACOES_DRAFTS: Partial<Record<DraftSection,ModuleDraft>> = {
  "FM-01": {
    title: "Operações — identidade e fronteira (rascunho)",
    body: "O módulo Operações do Painel Central é acessível pela rota /operacoes. O código da página referencia pedidos, produtos, produção, estoque por localização, histórico de movimentos e logística. Essas superfícies se relacionam com CRM, Financeiro e Integração Shopee, mas o Núcleo não deve iniciar produção, movimentar estoque ou reconciliar pedidos. A identificação atual do especialista Operações, seu mapa e método vigente continuam pendentes de confirmação.",
    source: OP_PAGE+"; src/App.tsx",
  },
  "FM-04": {
    title: "Operações — mapa inicial de funções (rascunho)",
    body: "Código inspecionado: src/pages/Operacoes.tsx compõe áreas e componentes de pedidos, produtos, estoque, produção, galeria, BOM, histórico de movimentos, separação e navegação operacional. Presença desses controles no repositório não equivale à homologação de entradas, saldos, expedição ou uso real. Registrar o caminho e efeito exato de cada ação somente após reconciliação com o especialista responsável.",
    source: OP_PAGE,
  },
  "FM-07": {
    title: "Operações — referência ET1 e seus limites (rascunho)",
    body: "O contrato técnico ET1 de Embalagem para Trufa, P100 lacrado / EA avulso, documenta implantação PARCIAL na PR #355 e proíbe aplicar migration antes de integrar os acoplamentos necessários. Define que 100 × P100 + EA é conservado na conversão física por variante/local; não converter estoque histórico automaticamente nem deduzir pacotes de unidades antigas. A abertura de pacote e os consumos precisam ser atômicos e idempotentes. O checkpoint é histórico e não comprova o estado atual da implementação nem autoriza execução. Para avaliar vigência, consultar especialista e testes sem alterar produção.",
    source: ET1_DOC+"; "+OP_PAGE,
  },
  "FM-08": {
    title: "Operações — autoridade do método (rascunho)",
    body: "O responsável técnico vigente do módulo Operações e a hierarquia dos métodos devem ser conferidos na documentação soberana e pela Camada Mestre. O ET1 é contrato de escopo específico e não substitui método geral. Código, testes em transação reversível, deploy, operação real e homologação são níveis distintos de prova. Sem autoridade confirmada, manter o estado como proposta e não iniciar integração entre módulos.",
    source: OP_PAGE+"; "+ET1_DOC,
  },
};

export const FINANCEIRO_DRAFTS: Partial<Record<DraftSection,ModuleDraft>> = {
  "FM-01": {
    title: "Financeiro — identidade e finalidade (rascunho)",
    body: "A rota /financeiro oferece uma área financeira do Painel Central. A página reúne dashboard, lançamentos, contas, categorias, contatos, precificação, documentos fiscais, extratos, importação e componentes de conciliação. Este catálogo se refere à presença de código, não ao funcionamento ou fechamento financeiro. A autoridade do método e o responsável atual ainda não foram reconciliados no Núcleo.",
    source: FIN_PAGE+"; src/App.tsx",
  },
  "FM-04": {
    title: "Financeiro — mapa técnico das telas (rascunho)",
    body: "O arquivo src/pages/Financeiro.tsx importa FinancialDashboard, FinancialEntriesList, AccountsManager, CategoriesManager, ContactsManager, PricingManagerV2, InvoicesManager, StatementImporter, FinancialIntegrityDialog e MarketplaceSettlementDialog. A página também inclui visão móvel MobileFinancialView. Importar extrato, registrar pagamento ou conciliar lançamento são ações com potencial de escrita e devem permanecer sob a operação financeira autorizada; não executar a partir desta Ficha Viva.",
    source: FIN_PAGE,
  },
  "FM-08": {
    title: "Financeiro — especialista e método (rascunho)",
    body: "A identidade funcional e a vigência do método do especialista Financeiro ainda exigem confirmação em mapa soberano ou transferência formal. Não transformar nomes de componentes em regras fiscais ou contábeis. Conciliar datas de compra, vencimento, liquidação e movimento bancário somente com o contrato financeiro vigente e provas de uso real, sem presumir regra a partir deste rascunho.",
    source: FIN_PAGE,
  },
};

export const CAPTURA_DRAFTS: Partial<Record<DraftSection,ModuleDraft>> = {
  "FM-01": {
    title: "Captura Central — identidade e fronteiras (rascunho)",
    body: "A Captura Central é acessível por /captura e recebe registros em texto e mídia para organização posterior. O código distingue estado de captura, anexos, decisões, vínculos a tarefas e áreas de referência. Capturar não significa aprovar, classificar automaticamente ou executar tarefa. O método vigente do especialista de Captura Central ainda precisa ser confirmado.",
    source: CAP_PAGE+"; src/App.tsx",
  },
  "FM-04": {
    title: "Captura Central — controles observáveis (rascunho)",
    body: "A página src/pages/CapturaCentral.tsx apresenta registros de texto, áudio, foto e vídeo, anexos, histórico de decisões e opções de associação a tarefas ou referências. A existência de funções de editar, excluir, arquivar ou planejar exige conferir permissões e confirmação antes de qualquer procedimento normativo. Esta Ficha Viva não gera capturas nem move tarefas.",
    source: CAP_PAGE,
  },
  "FM-08": {
    title: "Captura Central — autoridade e vigência (rascunho)",
    body: "Mapear o especialista atual e seu método de triagem, classificação, destino e retenção antes de homologar a Ficha Viva. O código atual comprova superfícies técnicas, mas não a vigência do processo humano. Preservar o conteúdo original, anexos e rastros de decisões; não importar dados pessoais de capturas no Núcleo.",
    source: CAP_PAGE,
  },
};

export const ROTINA_DRAFTS: Partial<Record<DraftSection,ModuleDraft>> = {
  "FM-01": {
    title: "Rotina — identidade e fronteiras (rascunho)",
    body: "O módulo Rotina, rota /rotina, organiza blocos em visualizações de dia, semana e mês. O código diferencia escopos pessoais e da empresa, datas, alarmes, templates e estados de bloco. A Ficha Viva apenas documenta as interfaces e não dispara cronogramas, altera blocos ou notifica usuários.",
    source: ROT_PAGE+"; src/App.tsx",
  },
  "FM-04": {
    title: "Rotina — mapa técnico de ações (rascunho)",
    body: "A página src/pages/Rotina.tsx utiliza useRoutine e componentes RoutineDayView, RoutineWeekView, RoutineMonthView, CustomAlarmsPanel, BlockEditDialog, MTPickerDialog e RoutineCompletionDialog. O hook expõe iniciar, completar, pular, adicionar, atualizar, excluir, pausar e reordenar blocos; também contém planejamento automático do dia/semana. Isso comprova a existência do contrato no código, não seus efeitos persistidos, permissões ou uso real. Não executar essas ações pelo Núcleo.",
    source: ROT_PAGE+"; src/hooks/useRoutine.ts",
  },
  "FM-08": {
    title: "Rotina — método e especialista (rascunho)",
    body: "Identificar mapa soberano, especialista atual e distinção de rotinas pessoais/empresariais antes de promover instruções. Fluxos de alarmes, priorização, replanejamento e conclusão precisam de prova funcional e limites de autoridade. Enquanto a documentação não estiver reconciliada, a ficha permanece proposta de referência.",
    source: ROT_PAGE,
  },
};

/**
 * Entrega A+ V1.2 — mapas de consulta de Digital e Assistente/IA.
 * Fontes de CÓDIGO somente: não conferem mandato, ato de aprovação,
 * publicação em redes sociais, nem autorização para executar autopilot.
 */
const DIGITAL_CODE = "src/pages/Digital.tsx";
const ASSISTENTE_CODE = "src/pages/Assistente.tsx";
const ASSISTENTE_HOOK = "src/hooks/useAICEO.ts";

export const DIGITAL_DRAFTS: Partial<Record<DraftSection,ModuleDraft>> = {
  "FM-01": {
    title: "Digital — identidade e objetivo no código (rascunho)",
    body: "A página Digital organiza ideias e variações de conteúdo e apresenta áreas de calendário, mídia, métricas, plataformas/canais, tendências, engajamento, FAQ, atendimento e campanhas. Essas áreas são superfícies identificadas no código, não um método comercial homologado nem prova de publicação efetiva. O Núcleo acompanha a documentação e não publica material em canais externos.",
    source: DIGITAL_CODE,
  },
  "FM-03": {
    title: "Digital — fronteiras e decisões humanas (rascunho)",
    body: "Criar uma ideia, planejar campanha, associar produto/canal e publicar são eventos diferentes. A identificação de ações de criação, filtros e plataformas em Digital.tsx não autoriza publicação, alteração de mídia, comunicação com clientes ou integração de CRM a partir do Núcleo. Critérios editoriais, direitos de uso de mídia, aprovação de campanhas e método vigente do especialista precisam de confirmação independente.",
    source: DIGITAL_CODE,
  },
  "FM-04": {
    title: "Digital — mapa técnico de telas (rascunho)",
    body: "A página Digital.tsx declara abas ideias, calendario, midia, metricas, plataformas, tendencias, engajamento, faq, atendimento e campanhas. A visão de ideias oferece modos lista, kanban e planilha, além de busca e filtros de status, canal, variação, tipo, produto e período. A presença do controle na main não comprova operação da tela autenticada, acesso ou persistência dos dados.",
    source: DIGITAL_CODE,
  },
  "FM-07": {
    title: "Digital — evidência e lacunas verificáveis (rascunho)",
    body: "A evidência desta proposta é a leitura da página src/pages/Digital.tsx no GitHub. Ainda não existe, nesta proposta, prova de um método soberano atual, mandato nominal homologado, publicação real de campanha ou resultado de métricas. Para promover procedimentos, o especialista deve apresentar mapa vigente e evidências específicas, separando código, deploy, uso real e aprovação.",
    source: DIGITAL_CODE,
  },
  "FM-08": {
    title: "Digital — governança do especialista (rascunho)",
    body: "O registro de especialista no cadastro de módulos é uma declaração de responsabilidade, não um mandato certificado. O Núcleo não deve inferir identidade, autoridade de publicação ou método a partir do texto da ficha. A Camada Mestre e o responsável competente devem reconciliar o método e seus limites antes de qualquer homologação.",
    source: DIGITAL_CODE,
  },
};

export const ASSISTENTE_DRAFTS: Partial<Record<DraftSection,ModuleDraft>> = {
  "FM-01": {
    title: "Assistente/IA — identidade técnica observada (rascunho)",
    body: "A página Assistente.tsx apresenta a experiência CEO IA, com conversa, insights, políticas e registro de ações. O hook useAICEO fornece contratos de leitura e atualização utilizados pela tela. Trata-se de inventário de superfícies implementadas, não de reconhecimento de um método soberano próprio do Assistente e não de autorização para executar ações automaticamente.",
    source: ASSISTENTE_CODE+"; "+ASSISTENTE_HOOK,
  },
  "FM-03": {
    title: "Assistente/IA — fronteiras de autonomia (rascunho)",
    body: "A interface contém controles de autopilot, limite de risco e propostas/ações, mas sua existência não comprova quais políticas estão ativas, quem pode alterá-las nem quais ações foram realizadas. O Núcleo M5 mantém supervisão somente leitura; esta ficha não modifica políticas, aprova insights, executa ações ou aciona provedores externos. Toda autorização depende dos contratos e permissões próprias do Assistente e da Camada Mestre.",
    source: ASSISTENTE_CODE+"; "+ASSISTENTE_HOOK,
  },
  "FM-04": {
    title: "Assistente/IA — mapa de interface (rascunho)",
    body: "No código, a página CEO IA separa as abas chat, insights, policies e log. Há cartões de insights, filtros por status/área, cartões de políticas com autopilot e ajuste de risco, além de itens de histórico de ações. Esse mapa auxilia a descoberta humana, mas não descreve execução real nem comprova o resultado de qualquer insight, diálogo ou ação.",
    source: ASSISTENTE_CODE,
  },
  "FM-07": {
    title: "Assistente/IA — estado da evidência (rascunho)",
    body: "Fonte primária verificada nesta proposta: src/pages/Assistente.tsx e o contrato referenciado src/hooks/useAICEO.ts. A auditoria do Núcleo em 13/11/2026 não localizou Estado Vigente ou método soberano próprio nas fontes examinadas; isso não prova inexistência fora do universo pesquisado. Não criar conteúdo normativo substituto nem afirmar homologação do comportamento da IA.",
    source: ASSISTENTE_CODE+"; "+ASSISTENTE_HOOK+"; docs/architecture/NUCLEO_2_0_AUDITORIA_FINAL_PENDENCIAS_PRIORIZADAS_2026-11-12.md",
  },
  "FM-08": {
    title: "Assistente/IA — mandato e autoridade pendentes (rascunho)",
    body: "O método soberano do Assistente, a identidade atual do especialista, a cadeia de aprovação e as condições para executar ações permanecem sem reconciliação formal no Núcleo. Registros textuais ou componentes no GitHub não atribuem mandato. Cabe à autoridade competente fornecer a referência original e aprovar o vínculo; até lá, manter somente leitura e linguagem não homologada.",
    source: ASSISTENTE_CODE+"; docs/architecture/NUCLEO_2_0_AUDITORIA_FINAL_PENDENCIAS_PRIORIZADAS_2026-11-12.md",
  },
};
