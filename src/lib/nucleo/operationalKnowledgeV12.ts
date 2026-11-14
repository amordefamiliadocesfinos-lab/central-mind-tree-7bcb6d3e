/**
 * Núcleo V1.2 — levantamento inicial read-only baseado em rotas/componentes do GitHub.
 * Não é cadastro de módulos no Core e não é um manual homologado em uso real.
 * Origem: src/App.tsx e componentes CRM, conferidos em 12/11/2026.
 */
export type KnowledgeConfidence = "codigo_verificado" | "declarado" | "nao_verificado";
export type KnowledgeModule = {
  id: string;
  name: string;
  domain: string;
  route: string | null;
  purpose: string;
  coverage: "piloto_parcial" | "inventario_de_rotas";
  specialist: string | null;
  specialistConfidence: KnowledgeConfidence;
  source: string;
};
export type CrmAction = {
  label: string;
  screen: string;
  prerequisite: string;
  expectedEffect: string;
  confirmation: string;
  limit: string;
  source: string;
  confidence: KnowledgeConfidence;
};
const REPO = "https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/blob/main/";
const ROUTE_SOURCE = REPO + "src/App.tsx";
export const MODULES_V12: KnowledgeModule[] = [
  {
    id: "CRM", name: "CRM — Atendimento", domain: "Comercial",
    route: "/contatos", purpose: "Organizar contatos, oportunidades e o acompanhamento de atendimentos.",
    coverage: "piloto_parcial", specialist: "Especialista CRM (papel funcional declarado)",
    specialistConfidence: "declarado", source: REPO + "src/pages/Contatos.tsx",
  },
  {
    id: "FIN", name: "Financeiro", domain: "Financeiro",
    route: "/financeiro", purpose: "Código inspecionado: painel financeiro, lançamentos, contas, categorias e importação de extratos; experiência mobile própria. Uso real e procedimentos ainda não homologados.",
    coverage: "inventario_de_rotas", specialist: null, specialistConfidence: "nao_verificado", source: REPO + "src/pages/Financeiro.tsx",
  },
  {
    id: "OPE", name: "Operações", domain: "Operações",
    route: "/operacoes", purpose: "Código verificado: pedidos, produtos, produção, estoques e separação; o inventário documental e a homologação dos fluxos continuam pendentes.",
    coverage: "inventario_de_rotas", specialist: null, specialistConfidence: "nao_verificado", source: REPO + "src/pages/Operacoes.tsx",
  },
  {
    id: "CAP", name: "Captura Central", domain: "Captação",
    route: "/captura", purpose: "Código verificado: entrada de texto, áudio, vídeo, foto e anexos; classificação e vínculo ainda exigem revisão do método vigente.",
    coverage: "inventario_de_rotas", specialist: null, specialistConfidence: "nao_verificado", source: REPO + "src/pages/CapturaCentral.tsx",
  },
  {
    id: "ROT", name: "Rotina", domain: "Organização",
    route: "/rotina", purpose: "Código verificado: visões de dia, semana e mês, blocos e alarmes; ainda sem método documental reconciliado ou jornada homologada.",
    coverage: "inventario_de_rotas", specialist: null, specialistConfidence: "nao_verificado", source: REPO + "src/pages/Rotina.tsx",
  },
  {
    id: "SAU", name: "Saúde / CCH", domain: "Saúde",
    route: "/saude", purpose: "Rota /saude/* e subrotas verificadas no código; mapa CCH v5.4 FROZEN vigente em 12/11/2026, com F10–F22 implementadas e F23 não aberta. Implementação, publicação e uso real são estados distintos.",
    coverage: "inventario_de_rotas", specialist: null, specialistConfidence: "nao_verificado", source: REPO + "docs/health/CCH_MAPA_SOBERANO_E_METODO_DE_TRABALHO_v5_4_FROZEN.md",
  },
  {
    id: "DIG", name: "Digital", domain: "Digital",
    route: "/digital", purpose: "Código verificado: gestão de ideias, variações, campanhas, calendário, mídias, métricas e plataformas; autoridade documental e uso real ainda não reconciliados.",
    coverage: "inventario_de_rotas", specialist: null, specialistConfidence: "nao_verificado", source: REPO + "src/pages/Digital.tsx",
  },
  {
    id: "ASS", name: "Assistente", domain: "IA",
    route: "/assistente", purpose: "Código verificado: insights, propostas, aprovações, políticas e histórico do Assistente; presença de ações na interface NÃO comprova autorização, autonomia nem execução. M5 do Núcleo permanece read-only.",
    coverage: "inventario_de_rotas", specialist: null, specialistConfidence: "nao_verificado", source: REPO + "src/pages/Assistente.tsx",
  },
  {
    id: "SHO", name: "Shopee / Integração", domain: "Comercial",
    route: null, purpose: "Integração acompanhada por documentos de governança; F12 segue aberta sob escopo congelado. Não há rota própria verificada nem homologação de escala/deploy implícita.",
    coverage: "inventario_de_rotas", specialist: null, specialistConfidence: "nao_verificado",
    source: REPO + "docs/operations/F12_MAPA_CONGELADO_ESCOPO_CONTROLADO_ATIVO_2026-11-12.md",
  },
];

export const CRM_SCREENS = [
  { label: "Contatos / CRM", route: "/contatos", source: REPO + "src/pages/Contatos.tsx" },
  { label: "Caixa de atendimentos", route: "/contatos/inbox", source: REPO + "src/pages/ContatosInbox.tsx" },
  { label: "Tarefas de contatos", route: "/contatos/tarefas", source: ROUTE_SOURCE },
];

export const CRM_ACTIONS: CrmAction[] = [
  {
    label: "Preparar contato no WhatsApp", screen: "Fila de atendimento / foco",
    prerequisite: "Contato selecionado com telefone disponível.",
    expectedEffect: "Aciona o preparo/abertura do contato externo; não registra sozinho a conclusão do atendimento.",
    confirmation: "A abertura externa não é confirmação de Resultado; registrar depois o que realmente ocorreu.",
    limit: "Integração externa e entrega da mensagem não são comprovadas apenas pelo clique.",
    source: REPO + "src/components/crm/CrmFocusQueue.tsx", confidence: "codigo_verificado",
  },
  {
    label: "Registrar resultado", screen: "Fila de atendimento / formulário contextual",
    prerequisite: "Atendimento selecionado. Operador verifica o fato e escolhe uma opção do catálogo de resultados.",
    expectedEffect: "Abre seleção contextual; escolher opção não persiste resultado automaticamente.",
    confirmation: "Somente o comando Confirmar resultado envia o registro, com retorno de sucesso do fluxo canônico.",
    limit: "Não confirmar resultado hipotético. Algumas opções exigem data; falha mantém o formulário para correção.",
    source: REPO + "src/components/crm/AttendanceActionBar.tsx", confidence: "codigo_verificado",
  },
  {
    label: "Confirmar resultado", screen: "Formulário Registrar resultado",
    prerequisite: "Resultado selecionado; data fornecida quando obrigatória; contexto de contato/conversa válido.",
    expectedEffect: "Solicita a persistência ao fluxo canônico do CRM para o contexto selecionado.",
    confirmation: "O formulário só fecha após retorno confirmado de onOutcome e contexto ainda correspondente.",
    limit: "O código comprova tratamento da confirmação; não prova o resultado de todas as situações reais.",
    source: REPO + "src/components/crm/AttendanceActionBar.tsx", confidence: "codigo_verificado",
  },
  {
    label: "Adiar atendimento", screen: "Fila de atendimento / formulário contextual",
    prerequisite: "Contato selecionado e motivo operacional para remarcar a análise.",
    expectedEffect: "Abre o fluxo de adiamento em vez de registrar um resultado comercial fictício.",
    confirmation: "Conferir nova data/posição da fila no CRM após retorno do fluxo de adiamento.",
    limit: "O botão não é substituto de um Resultado já ocorrido; readback visual ainda requer homologação específica.",
    source: REPO + "src/components/crm/AttendanceActionBar.tsx", confidence: "codigo_verificado",
  },

  {
    label: "Concluir", screen: "Caixa de atendimentos / comandos essenciais",
    prerequisite: "Conversa em aberto. Confirmar eventual aviso sobre Resultado pendente, tarefa oficial ou retorno operacional.",
    expectedEffect: "Solicita marcar a conversa como resolvida; não cria Resultado comercial nem conclui tarefas oficiais.",
    confirmation: "Exigir confirmação da atualização de service_conversations e conferir mensagem Atendimento concluído e estado na Inbox.",
    limit: "Concluir conversa é diferente de Registrar resultado. Se a gravação não for confirmada, não presumir que o contato saiu de todas as filas.",
    source: REPO + "src/pages/ContatosInbox.tsx", confidence: "codigo_verificado",
  },
  {
    label: "Reabrir", screen: "Caixa de atendimentos / comandos essenciais",
    prerequisite: "Conversa selecionada com status resolvido; comando habilitado apenas nesse estado.",
    expectedEffect: "Solicita reabrir a conversa e restaurar estado de atendimento, com responsável da sessão.",
    confirmation: "Verificar confirmação de atualização e estado da conversa reaberta após recarga.",
    limit: "Reabrir conversa não desfaz automaticamente Resultado comercial anterior nem altera o histórico já registrado.",
    source: REPO + "src/pages/ContatosInbox.tsx", confidence: "codigo_verificado",
  },
  {
    label: "Tirar da fila", screen: "Caixa de atendimentos / comandos essenciais",
    prerequisite: "Contato selecionado visível na fila e escrita operacional disponível.",
    expectedEffect: "Aplica etiqueta de exclusão da fila operacional; não arquiva nem conclui a conversa.",
    confirmation: "Conferir mensagem de contato retirado da fila e recarregamento da classificação; opção Voltar à fila permite reverter.",
    limit: "Ação sobre visibilidade na fila, não sobre Resultado ou conclusão do atendimento. Falha preserva estado indeterminado até readback.",
    source: REPO + "src/pages/ContatosInbox.tsx", confidence: "codigo_verificado",
  },
  {
    label: "Próximo atendimento", screen: "Caixa de atendimentos / Fila Hoje",
    prerequisite: "Fila Hoje em execução; contato selecionado; sem gravação pendente. Verificar aviso se ainda houver obrigação de responder ou registrar Resultado.",
    expectedEffect: "Avança para o próximo contato elegível da lista de escopo atual, com recarga do estado da fila.",
    confirmation: "Conferir qual contato ficou selecionado ou mensagem de fila concluída.",
    limit: "Avançar não registra Resultado, não responde mensagem e não retira automaticamente uma obrigação pendente da fila.",
    source: REPO + "src/pages/ContatosInbox.tsx", confidence: "codigo_verificado",
  },
  {
    label: "Sem fato novo — retirar da prioridade", screen: "Caixa de atendimentos / acompanhamento da prioridade",
    prerequisite: "Aparece somente quando há Resultado anterior, espera pelo cliente, nenhuma resposta pendente, saída mais recente que entrada e próxima ação não vencida.",
    expectedEffect: "Após nova conferência do contexto, registra no histórico uma revisão sem fato comercial novo e atualiza a fila.",
    confirmation: "Conferir mensagem Revisão registrada. Nenhum Resultado foi criado e evento crm_attendance_no_new_fact no histórico autorizado.",
    limit: "Não é alternativa para ocultar obrigação de Resultado, responder ao cliente ou criar resultado fictício. Mudança simultânea do atendimento impede a revisão.",
    source: REPO + "src/pages/ContatosInbox.tsx", confidence: "codigo_verificado",
  },

];

export const CRM_JOURNEY = [
  "Abrir a Caixa de atendimentos ou a fila priorizada do CRM.",
  "Selecionar a conversa e conferir histórico, contexto e próxima ação.",
  "Quando necessário, usar o contato externo; isso não encerra o atendimento.",
  "Escolher Registrar resultado, selecionar apenas o fato ocorrido e acionar Confirmar resultado.",
  "Conferir no CRM a confirmação e o histórico; em caso de falha, não presumir sucesso.",
];

export const CRM_REFERENCE = {
  checkpoint: "Levantamento inicial de código em 12/11/2026",
  source: REPO + "src/components/crm/AttendanceActionBar.tsx",
  method: "Método/ecossistema específico do especialista CRM: vínculo documental vigente ainda não verificado.",
  limitation: "Pilotagem read-only: operação descrita a partir do código; uso real detalhado e autoridade do método exigem reconciliação própria.",
};
