import { CRM_ACTIONS } from "./operationalKnowledgeV12";
/**
 * Núcleo 2.0 V1.2 — descobertas operacionais verificadas no código para
 * a Entrega A+ CA-14/22. Apenas leitura/orientação: não constitui manual
 * homologado, prova de uso real, instrução de execução por IA ou autoridade.
 */
export type ModuleControlDiscovery = {
  label:string;
  screenId?:string;
  screen:string;
  prerequisite:string;
  observed:string;
  confirmation:string;
  limitation:string;
  source:string;
};
const repo="https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/main/";
export const MODULE_CONTROLS_V12:Readonly<Record<string,ReadonlyArray<ModuleControlDiscovery>>>={
 CRM:CRM_ACTIONS.map(action=>({
  label:action.label,screenId:action.screenId,screen:action.screen,prerequisite:action.prerequisite,
  observed:action.expectedEffect,confirmation:action.confirmation,
  limitation:action.limit,source:action.source,
 })),

  FIN:[
    {
      label:"Revisar importados",screen:"Financeiro — filtros e operações de importação",
      prerequisite:"Acessar Financeiro com permissão própria e localizar lançamentos importados.",
      observed:"O botão aciona a abertura de UncategorizedReviewDialog; o diálogo possui callback para atualizar lançamentos após alteração.",
      confirmation:"Conferir o conteúdo do diálogo e recarregar os lançamentos antes de considerar uma revisão concluída.",
      limitation:"Abertura do diálogo não comprova categorização nem o efeito financeiro no dashboard; não modificar registros durante a inspeção.",
      source:repo+"src/pages/Financeiro.tsx",
    },
    {
      label:"Importar Extrato",screen:"Financeiro — ações de importação",
      prerequisite:"Conferir conta, competência e critérios do importador antes de enviar arquivo.",
      observed:"O botão aciona StatementImporter; o componente recebe contas e categorias e callback de atualização.",
      confirmation:"Confirmar resultado e valores efetivos pelo fluxo do Financeiro, sem deduzir pela abertura da janela.",
      limitation:"Presença do importador não comprova conciliação, ausência de duplicatas ou data de caixa correta; não importar dados em teste exploratório.",
      source:repo+"src/pages/Financeiro.tsx",
    },
  ],
  OPE:[
    {
      label:"Preparar compra",screenId:"mrp",screen:"Operações — MRP / Planejamento de compras",
      prerequisite:"Existe necessidade de material com falta calculada (shortage > 0) na tabela de Planejamento de compras do MRP.",
      observed:"O botão Preparar compra chama preparePurchase(need), que transfere contexto à aba Compras via parâmetros mrpProductId, mrpNeedQty, mrpUnit e mrpName; PurchasesTab prepara o editor com planning_source mrp.",
      confirmation:"Conferir a aba Compras, o editor aberto e a identidade/necessidade do material. Preparação não é Pedido de Compra salvo.",
      limitation:"Sem necessidade real elegível, o controle não é exibido. Não confirmar nem salvar compra, recebimento, estoque ou financeiro em teste de consulta.",
      source:repo+"src/components/operations/MRPTab.tsx",
    },
    {
      label:"Nova compra",screenId:"purchases",screen:"Operações — Compras / Pedidos de compra",
      prerequisite:"Abrir o setor Compras e conferir fornecedor, itens e condições antes de qualquer registro.",
      observed:"O botão Nova compra chama openEditor no componente PurchasesTab.",
      confirmation:"Conferir o editor; uma compra só é efetiva após o fluxo de gravação e verificação próprios.",
      limitation:"Abrir o editor não cria pedido nem prova faturamento, recebimento físico ou movimentação financeira.",
      source:repo+"src/components/operations/PurchasesTab.tsx",
    },
    {
      label:"Central de Fornecedores",screenId:"purchases",screen:"Operações — Compras",
      prerequisite:"Estar na área de Compras.",
      observed:"O botão alterna purchaseSection para suppliers e exibe SupplierCenter.",
      confirmation:"Conferir que a seção de fornecedores foi exibida.",
      limitation:"Navegar não comprova cadastro, validação ou aprovação de fornecedores.",
      source:repo+"src/components/operations/PurchasesTab.tsx",
    },
  ],
  ROT:[
    {
      label:"Encerrar dia",screen:"Rotina — visão Dia",
      prerequisite:"A opção é exibida na visão diária quando há blocos pendentes ou em andamento.",
      observed:"O botão chama handleCloseDay, operação que precisa de confirmação conforme os estados da Rotina.",
      confirmation:"Conferir diálogo/retorno e situação dos blocos antes de considerar o dia encerrado.",
      limitation:"O botão não comprova que todas as tarefas terminaram; não acioná-lo apenas para explorar a interface.",
      source:repo+"src/pages/Rotina.tsx",
    },
    {
      label:"Minha Rotina / Empresa",screen:"Rotina — seleção de escopo",
      prerequisite:"Acessar Rotina com sessão autorizada.",
      observed:"Os botões alternam routineScope entre mine e company.",
      confirmation:"Verificar escopo selecionado e contexto apresentado.",
      limitation:"A alternância visual não comprova autorização a dados de outro escopo nem uma tarefa concluída.",
      source:repo+"src/pages/Rotina.tsx",
    },
  ],
  CAP:[
    {
      label:"Fazer",screen:"Captura Central — decisões da entrada",
      prerequisite:"Uma entrada está na visualização decisao e workflowReady é verdadeiro.",
      observed:"O botão invoca openDecision(entry, fazer), abrindo preparação de decisão sobre a entrada.",
      confirmation:"Conferir contexto e confirmação posterior; clicar não comprova criação de tarefa.",
      limitation:"Não executar o fluxo para criar tarefas durante uma simples inspeção do Núcleo.",
      source:repo+"src/pages/CapturaCentral.tsx",
    },
    {
      label:"Planejar",screen:"Captura Central — decisões da entrada",
      prerequisite:"Entrada elegível na visualização de decisão e workflowReady verdadeiro.",
      observed:"O botão invoca openDecision(entry, planejar).",
      confirmation:"Conferir os dados exibidos e a confirmação no processo de planejamento.",
      limitation:"Abertura da decisão não garante agendamento nem vínculo criado.",
      source:repo+"src/pages/CapturaCentral.tsx",
    },
    {
      label:"Guardar / Arquivar",screen:"Captura Central — decisões da entrada",
      prerequisite:"Entrada elegível na visualização de decisão com workflowReady verdadeiro.",
      observed:"Os controles acionam resolveWithoutTask com os estados referencia e arquivada.",
      confirmation:"Conferir estado e retorno de gravação antes de considerar a entrada classificada.",
      limitation:"São ações de escrita no módulo; o Núcleo apenas as descreve e jamais as executa.",
      source:repo+"src/pages/CapturaCentral.tsx",
    },
  ],
};
