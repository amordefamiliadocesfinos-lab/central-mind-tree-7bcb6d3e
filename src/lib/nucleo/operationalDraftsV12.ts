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
