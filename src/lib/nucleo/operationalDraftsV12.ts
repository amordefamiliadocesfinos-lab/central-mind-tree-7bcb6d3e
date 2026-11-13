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
};
