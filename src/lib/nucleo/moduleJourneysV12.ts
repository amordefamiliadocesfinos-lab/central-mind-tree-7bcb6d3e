/**
 * Núcleo 2.0 V1.2 — A+ CA-14/15/22 — jornadas de LEITURA.
 * Cada passo vincula uma tela real e opcionalmente um controle já inventariado.
 * Não contém instruções para IA executar ações; nem confirma uso real/UAT.
 */
export type JourneyStepV12={
  screenId:string;
  controlLabel?:string;
  task:string;
  inspect:string;
  verify:string;
  limit:string;
};
export type ModuleJourneyV12={
  id:string;title:string;goal:string;kind:"consulta"|"preparacao";
  steps:ReadonlyArray<JourneyStepV12>;
};
const inspectOnly="Esta orientação não executa a ação. A abertura ou seleção visual não comprova sucesso operacional.";
export const MODULE_JOURNEYS_V12:Readonly<Record<string,ReadonlyArray<ModuleJourneyV12>>>={
 CRM:[{
  id:"crm-atendimento",title:"Entender o atendimento e o registro de Resultado",
  goal:"Localizar a conversa, distinguir fatos de próxima ação e verificar os limites do registro.",
  kind:"consulta",steps:[
   {screenId:"inbox",task:"Encontrar a conversa e o histórico",inspect:"Abrir Caixa de atendimentos e selecionar um contato permitido; reconhecer contexto, histórico e próxima ação.",verify:"Conferir a conversa selecionada; não presumir que uma mensagem foi enviada.",limit:inspectOnly},
   {screenId:"contatos",controlLabel:"Registrar resultado",task:"Reconhecer a seleção de Resultado",inspect:"Localizar Registrar resultado e verificar o contexto antes de escolher um fato realmente ocorrido.",verify:"O código abre seleção contextual sem gravar só pela escolha.",limit:"Não inventar Resultado ou usar dados reais durante inspeção."},
   {screenId:"contatos",controlLabel:"Confirmar resultado",task:"Conhecer o portão de persistência",inspect:"Inspecionar as pré-condições de confirmação e os campos obrigatórios no código; não confirmar atendimento fictício.",verify:"Em operação autorizada, a confirmação depende de retorno positivo e contexto correspondente.",limit:"Este roteiro não envia comando e não substitui readback real."},
   {screenId:"inbox",controlLabel:"Próximo atendimento",task:"Distinguir avanço da fila e registro",inspect:"Localizar Próximo atendimento e confrontar com Resultado e tarefas pendentes.",verify:"Conferir seleção ou estado da fila somente em operação real acompanhada.",limit:"Avançar não cria Resultado e não comprova atendimento finalizado."},
  ],
 },{
  id:"crm-fila",title:"Entender saídas da fila e contato externo",
  goal:"Distinguir preparar o WhatsApp, retirar da fila e revisão sem fato comercial novo.",
  kind:"consulta",steps:[
   {screenId:"contatos",controlLabel:"Preparar contato no WhatsApp",task:"Reconhecer a abertura do contato externo",inspect:"Localizar o preparo do WhatsApp na fila e verificar o telefone e o contato selecionado; não enviar mensagem nesta consulta.",verify:"A abertura externa não confirma envio de mensagem nem registro de Resultado; a consulta não deve acionar o envio.",limit:"O Núcleo não executa o atendimento ou confirma entrega no WhatsApp."},
   {screenId:"inbox",controlLabel:"Tirar da fila",task:"Distinguir retirar da fila de concluir conversa",inspect:"Identificar a opção Tirar da fila, sua pré-condição e a possibilidade de retorno à fila.",verify:"Em operação legítima, conferir mensagem de retirada e classificação após recarga.",limit:"A retirada não arquiva a conversa, não registra Resultado e não conclui tarefa."},
   {screenId:"inbox",controlLabel:"Sem fato novo — retirar da prioridade",task:"Identificar revisão sem fato comercial novo",inspect:"Reconhecer as condições restritas da revisão: Resultado anterior, espera pelo cliente, ausência de resposta pendente e próxima ação não vencida.",verify:"Em operação autorizada, conferir a revisão no histórico; nenhum Resultado novo deve ser criado.",limit:"Não utilizar este fluxo para ocultar resposta pendente ou inventar atendimento."},
  ],
 },{
  id:"crm-revisao",title:"Reconhecer adiamento e fechamento sem criar fato fictício",
  goal:"Diferenciar Adiar, Concluir e Reabrir por efeito e confirmação.",
  kind:"consulta",steps:[
   {screenId:"contatos",controlLabel:"Adiar atendimento",task:"Reconhecer o adiamento",inspect:"Verificar pré-condição e motivo para usar Adiar atendimento em vez de criar Resultado comercial.",verify:"Em fluxo real autorizado, conferir data e posição da fila após retorno.",limit:inspectOnly},
   {screenId:"inbox",controlLabel:"Concluir",task:"Distinguir conclusão de conversa",inspect:"Identificar o comando Concluir e suas advertências sobre resultado/tarefa pendente.",verify:"Na execução legítima, conferir estado resolvido em service_conversations.",limit:"Não conclui tarefa oficial nem cria Resultado."},
   {screenId:"inbox",controlLabel:"Reabrir",task:"Reconhecer reabertura",inspect:"Identificar estado resolvido que habilita Reabrir.",verify:"Na execução legítima, conferir novo estado depois de recarga.",limit:"Reabrir não apaga histórico comercial."},
  ],
 }],

  FIN:[{
    id:"fin-importados",title:"Conferir lançamentos importados",goal:"Localizar o ponto de revisão sem editar lançamentos.",kind:"consulta",
    steps:[
      {screenId:"dashboard",task:"Localizar as operações de importação",inspect:"Abrir Financeiro e reconhecer os filtros de data e os comandos na área superior.",verify:"A tela Financeiro apresenta os controles de importação.",limit:inspectOnly},
      {screenId:"dashboard",controlLabel:"Revisar importados",task:"Inspecionar o controle de revisão",inspect:"Identificar o botão Revisar importados e as informações exigidas pelo diálogo; não salvar alterações.",verify:"A implementação abre UncategorizedReviewDialog. Inspecionar a abertura em sessão autorizada.",limit:"Abrir o diálogo não comprova categorização, valores ou atualização do dashboard."},
      {screenId:"receber",task:"Separar conferência de saldo e data",inspect:"Identificar as abas Receber/Pagar e o filtro de base de data; não inferir caixa pelo dia da compra.",verify:"Conferir filtros e lançamentos com fonte financeira real em etapa de homologação.",limit:"Nenhuma conciliação financeira foi executada por esta jornada."},
    ]
  }],
  OPE:[{
    id:"ope-mrp-compra",title:"Entender a passagem de MRP para preparação de Compra",
    goal:"Localizar uma falta real no MRP e reconhecer a preparação consultiva de Compra sem gravar pedido ou movimentar estoque.",kind:"preparacao",
    steps:[
      {screenId:"mrp",task:"Consultar necessidades do MRP",inspect:"Abrir a aba MRP de Operações e localizar Planejamento de compras. A tabela contém necessidades calculadas; não gerar demanda sintética.",verify:"Conferir material, falta, unidade e prazo se houver linha real. Sem falta elegível, registrar não verificável para o próximo passo.",limit:inspectOnly},
      {screenId:"mrp",controlLabel:"Preparar compra",task:"Reconhecer passagem MRP → Compras",inspect:"O botão aparece apenas quando shortage > 0. Quando houver necessidade real e inspeção autorizada, abrir preparação para ver contexto; não salvar o Pedido de Compra.",verify:"Conferir mudança para Compras e abertura do editor com material e quantidade operacional de referência.",limit:"Preparação não comprova compra salva, recebimento, entrada física ou pagamento; sem falta elegível, não criar dados para forçar o teste."},
      {screenId:"purchases",task:"Distinguir proposta de compra e persistência",inspect:"Conferir o editor de Compras e seus campos; fechar sem gravar após observar o contexto MRP.",verify:"A abertura do editor não cria compra. Confirmar somente a navegação e o contexto, não readback de pedido inexistente.",limit:"Não salvar, editar nem excluir compra, fornecedor, estoque, produção ou dados financeiros."},
    ]
  },{
    id:"ope-compras",title:"Conhecer a preparação de compra",goal:"Encontrar Compras e identificar a abertura do editor, sem criar pedido.",kind:"preparacao",
    steps:[
      {screenId:"purchases",task:"Abrir Compras",inspect:"Usar a aba Compras da página Operações; a rota com tab=purchases é reconhecida no código.",verify:"A aba Compras deve ficar selecionada na interface autenticada.",limit:inspectOnly},
      {screenId:"purchases",controlLabel:"Nova compra",task:"Identificar criação de compra",inspect:"Localizar Nova compra; código chama openEditor, mas não gravar pedido.",verify:"Verificar editor e campos existentes. Não considerar abertura do editor como compra criada.",limit:"Não comprova faturamento, trânsito, recebimento ou baixa de estoque."},
      {screenId:"purchases",controlLabel:"Central de Fornecedores",task:"Reconhecer a área de fornecedores",inspect:"Identificar o comando que altera purchaseSection para suppliers.",verify:"Confirmar somente a navegação para a seção de fornecedores.",limit:"Nenhum fornecedor deve ser criado ou homologado neste roteiro."},
    ]
  }],
  ROT:[{
    id:"rot-dia",title:"Localizar planejamento e encerramento do dia",goal:"Entender onde ficam visão diária e encerramento, sem encerrar blocos.",kind:"consulta",
    steps:[
      {screenId:"day",task:"Acessar visão Dia",inspect:"Selecionar a aba Dia da Rotina; observar o escopo Minha Rotina ou Empresa.",verify:"Confirmar a visão diária e o escopo apresentado.",limit:"Escopo visual não garante acesso a dados de outro usuário."},
      {screenId:"day",controlLabel:"Minha Rotina / Empresa",task:"Verificar seletor de contexto",inspect:"Observar os dois botões que alteram routineScope.",verify:"Conferir seleção e dados autorizados; não tomar troca visual como alteração de permissão.",limit:inspectOnly},
      {screenId:"day",controlLabel:"Encerrar dia",task:"Reconhecer condições de encerramento",inspect:"O botão existe se houver blocos pendentes/em andamento na visão Dia. Não acioná-lo na inspeção.",verify:"Verificar as condições de exibição no código e, futuramente, em UAT.",limit:"Encerrar dia é uma operação com efeitos; não presume que todos os blocos foram concluídos."},
    ]
  }],
  CAP:[{
    id:"cap-triagem",title:"Compreender a triagem de capturas",goal:"Diferenciar decisão, planejamento e arquivamento sem alterar entradas.",kind:"consulta",
    steps:[
      {screenId:"decisao",task:"Encontrar Caixa de decisão",inspect:"Abrir Captura Central e localizar a visão das entradas aguardando decisão.",verify:"Conferir o filtro selecionado e a lista sem abrir dados fora do próprio acesso.",limit:"A presença de entradas não autoriza executá-las."},
      {screenId:"decisao",controlLabel:"Fazer",task:"Reconhecer o caminho Fazer",inspect:"Identificar o controle condicionado a workflowReady; no código ele chama openDecision(entry, fazer).",verify:"Somente identificar a ação e sua pré-condição; não criar tarefa.",limit:"O clique prepara um fluxo e não comprova tarefa salva."},
      {screenId:"decisao",controlLabel:"Planejar",task:"Distinguir Planejar de Fazer",inspect:"Localizar o botão Planejar que chama openDecision(entry, planejar).",verify:"Conferir a distinção do controle no código e na interface futura.",limit:"Planejar não comprova agenda ou vínculo persistido."},
      {screenId:"decisao",controlLabel:"Guardar / Arquivar",task:"Reconhecer saídas sem tarefa",inspect:"Verificar o caminho de Guardar e Arquivar, sem acioná-lo em entradas reais.",verify:"Confrontar o estado apenas em teste autorizado posterior.",limit:"Guardar/Arquivar escrevem dados; a jornada não executa essas ações."},
    ]
  }],
  DIG:[{
    id:"dig-metricas",title:"Encontrar métricas e canais",goal:"Localizar painéis de indicadores sem inferir integração ou resultado.",kind:"consulta",
    steps:[
      {screenId:"ideias",task:"Conhecer as visões do Digital",inspect:"Abrir a aba Ideias, reconhecendo os modos lista, Kanban ou planilha existentes.",verify:"Conferir a seleção na interface sem criar ou alterar ideias.",limit:inspectOnly},
      {screenId:"metricas",task:"Consultar a tela Métricas",inspect:"Acessar a aba Métricas pelo link de tab reconhecido.",verify:"Conferir título, indicadores e filtros apresentados.",limit:"Indicador visível não comprova validade dos dados nem sincronização."},
      {screenId:"plataformas",task:"Localizar Canais",inspect:"Acessar a aba Canais sem alterar configurações.",verify:"Conferir a página apresentada; não presumir integração ativa.",limit:"Não autoriza publicação ou operação de plataforma externa."},
    ]
  }],
  ASS:[{
    id:"ass-insights",title:"Inspecionar propostas e histórico do Assistente",goal:"Reconhecer as áreas existentes sem disparar análise ou aprovar ações.",kind:"consulta",
    steps:[
      {screenId:"insights",task:"Encontrar Insights",inspect:"Abrir Assistente e selecionar a aba Insights manualmente.",verify:"Reconhecer filtros e status das propostas.",limit:"Proposta apresentada não significa ação aprovada ou executada."},
      {screenId:"policies",task:"Consultar Políticas",inspect:"Selecionar a aba Políticas e consultar apenas informações permitidas.",verify:"Confirmar apresentação da seção e sua fonte de autoridade antes de utilizá-la.",limit:"O texto de uma política na interface não certifica vigência normativa."},
      {screenId:"log",task:"Localizar Histórico",inspect:"Selecionar a aba Histórico; não recuperar dados sensíveis para o Núcleo.",verify:"Verificar a existência da área, não a completude da trilha.",limit:"O Núcleo não executa auditoria, análises ou aprovações do Assistente."},
    ]
  }],
};
