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
    title: "CRM — catálogo de controles e limites (proposta revisada)",
    body: "Catálogo comprovado no código: Preparar contato externo não confirma entrega; Registrar resultado abre seleção, Confirmar resultado persiste pelo fluxo canônico e exige retorno confirmado; Adiar planeja reavaliação sem criar fato comercial. Na Inbox, Concluir encerra conversa (não Resultado nem tarefa oficial); Reabrir reativa conversa sem apagar Resultado histórico; Tirar da fila modifica a visibilidade por etiqueta (não arquiva); Próximo atendimento avança após verificar obrigações; Sem fato novo — retirar da prioridade registra revisão humana em histórico, sem criar Resultado. Cada comando mantém pré-condição, efeito, confirmação e limite no catálogo CA-14; verificar na fonte e no runtime antes de ampliar o status de prova.",
    source: BAR+"; src/components/crm/CrmFocusQueue.tsx; src/pages/ContatosInbox.tsx; docs/architecture/NUCLEO_V12_A_PLUS_CRM_CA14_CONTROLES_INBOX_2026-11-14.md"
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
    title: "CRM — método, sucessão e mandato (proposta revisada)",
    body: "O Documento Mestre do Processo Comercial, Bibliotecas 01–08 e documentos 09.01–09.05 constituem referências de autoridade comercial em suas respectivas situações documentais; os cabeçalhos 09.02/09.03 exigem conciliação formal. O Estado CRM V1.2 (14/10) está PREPARADO/NÃO VIGENTE segundo a própria fonte, e diz que V1.1 é anterior até substituição controlada; não presumir publicação. CRM 7 foi responsável técnico histórico do UX02 de 16/10. O adendo de 04/11 registra repasse CRM 7 → CRM 8, também PREPARADO/NÃO PUBLICADO. Não há mandato certificado no Core; o método e o titular atuais dependem de fonte de decisão e validação da Camada Mestre. Não preencher credencial, titular nominal ou data de vigência por inferência.",
    source: UX+"; docs/architecture/NUCLEO_V12_A_PLUS_CRM_CA13_CA17_RECONCILIACAO_FONTES_2026-11-14.md; docs/architecture/NUCLEO_V12_A_PLUS_CRM_CA13_CA17_SUCESSAO_2026-11-14.md"
  },
  "FM-09": {
    title: "CRM — evolução, checkpoints e gates (proposta revisada)",
    body: "Histórico preservado: CRM UX02 em 16/10 integra A-01/A-02 e B-01–B-06, com PRs #283/#284/#286/#287/#290/#291/#296/#297 e CI; UAT autenticado permanece pendente. Estado CRM V1.2 de 14/10 não foi publicado pelo simples fato de estar na Biblioteca. Adendo de 04/11 descreve sucessão CRM7→CRM8 e correção preventiva da PR #411 contra eventos Meta antigos, duplicados e reações; PR #412 só reverte mudança incidental de plano. GitHub comprova merges; deploy foi relatado no adendo, sem reconfirmação independente. Seis casos históricos e ensaio com novos eventos legítimos são pendências do especialista CRM, sem autorização de ação pelo Núcleo. Frentes CA-13/17 não são encerradas por essa proposta; registrar decisões de autoridade e testes reais apenas com prova.",
    source: UX+"; docs/architecture/NUCLEO_V12_A_PLUS_CRM_CA13_CA17_SUCESSAO_2026-11-14.md; docs/architecture/NUCLEO_V12_A_PLUS_CRM_CA14_CONTROLES_INBOX_2026-11-14.md"
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
  "FM-02": {
    title: "Saúde/CCH — visão rápida e propósito V6.0 (rascunho)",
    body: "O CCH é acompanhamento individual, ensino, interpretação, prescrição assistida, execução e evolução; não apenas contador de séries. A experiência desejada inclui iniciar/retomar treino, cronômetros, escolha de exercício e séries extras, histórico, registro e correções auditáveis, progresso e próximo ciclo. Atende níveis iniciante, intermediário e avançado sem reduzir automaticamente o treino por baixa confiança nos dados. A decisão permanece com o atleta. A visão multidisciplinar U08 não autoriza expansão produtiva. Consultar /saude e /saude/treino/programa; distinguir objetivo de produto e funcionamento comprovado.",
    source: "docs/health/CCH_MAPA_SOBERANO_UNIFICADO_V6_0_FROZEN_2026-11-24.md; https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/966",
  },
  "FM-05": {
    title: "Saúde/CCH — controles e efeitos previstos F24 (rascunho)",
    body: "O contrato V6.0 prevê + Série extra e Próximo exercício com igual destaque e escolha explícita; extras pertencem ao M4 e não reescrevem M3. O limite do schema é 100 séries. Timer é autoridade de execução; pausa, recarga e retomada devem preservar a escolha. Ver movimento é previsto sob demanda (G3 protótipo, não implantação); dicas ocasionais e silenciáveis pertencem ao G4 especificado. Publicar programa exige decisão manual e gate F22, com prescrição obrigatória completa. Estes são requisitos normativos, não catálogo de botões autenticado ou confirmação de comportamento produtivo. Não acionar controles de atletas para verificar esta ficha.",
    source: "docs/health/CCH_MAPA_SOBERANO_UNIFICADO_V6_0_FROZEN_2026-11-24.md; https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/966",
  },
  "FM-06": {
    title: "Saúde/CCH — jornada guiada e continuidade (rascunho)",
    body: "Jornada alvo do V6.0: consultar objetivo e programa autorizado, iniciar ou retomar sessão, escolher exercício, registrar séries, decidir explicitamente entre extra e próximo exercício, preservar timer e histórico, conferir realizado versus planejado. Para revisão do programa, contexto autorizado e dados comparáveis → opções justificadas → draft M3 versionado → diff/revisão humana → publicação manual F22. Não inferir identidade de aparelho por rótulo ou sugerir kg sem evidência comparável. A jornada F24 G5 segue condicionada a provas autenticadas; não usar este rascunho como prescrição ou autorização para operar sessões reais.",
    source: "docs/health/CCH_MAPA_SOBERANO_UNIFICADO_V6_0_FROZEN_2026-11-24.md; https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/966",
  },
  "FM-07": {
    title: "Saúde/CCH — fontes e limites das evidências (rascunho)",
    body: "V6.0 preserva mapas v5.4 e Motor V1.0, matriz E4, issues #966/#973/#980 e contratos M3/M4/F19/F21/F22. G1 #1025 e G2 #1027 integradas; E4 CI #45248590206 aprovada conforme matriz. G5-F #1036 usa Auth e banco efêmeros, não produção. A fonte registra falha residual React em #45394052270 apesar de cinco viewports executados; não tratar essa execução como homologação UX. Snapshot transacional, revisão servida e UAT permanecem pendências no checkpoint. Consultar issue #966 para fatos mutáveis. Não importar dados de saúde, fotos, prescrições ou histórico individual.",
    source: "docs/health/CCH_MAPA_SOBERANO_UNIFICADO_V6_0_FROZEN_2026-11-24.md; https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/966",
  },
  "FM-09": {
    title: "Saúde/CCH — evolução e checkpoint congelado V6.0 (rascunho)",
    body: "Fotografia de 24/11: U01 F24 G5-F é prioridade imediata; G1/G2 integradas, falha residual local de escolha extra após PATCH/reload, causa raiz não comprovada. U02 E2/E3 engenharia integrada com homologação pendente/adiada; U03 E4 técnica aprovada com provas remanescentes. U04 G3 protótipo, U05/U06 G4 especificação, U07 E5 real bloqueada, U08 visão estratégica. F23 fechada. Próxima ação histórica: investigar montagem/estado e sequência PATCH/reload, corrigir menor causa e provar quinto início humano sem re-seleção artificial. Antes de continuar, recuperar checkpoint atual na #966; não presumir que a falha continua nem reabrir gates.",
    source: "docs/health/CCH_MAPA_SOBERANO_UNIFICADO_V6_0_FROZEN_2026-11-24.md; https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/966",
  },
  "FM-10": {
    title: "Saúde/CCH — aprendizagem e regras reutilizáveis (rascunho)",
    body: "Lições do mapa: experiência declarada, confiança dos dados e fase real são independentes; lacuna de dados não implica iniciante nem redução automática de treino. Mesmo rótulo não comprova mesma máquina; unidade, atleta, exercício e proveniência condicionam comparabilidade. Volume executado não demonstra causalidade ou eficácia; mínimo técnico de observações não é limiar científico. Duas varreduras REST não são snapshot atômico. CI, laboratório Auth e revisão publicada são provas distintas; falha localizada pede menor correção, sem repetir provas válidas. Preservar escolha humana, histórico append-only e privacidade. Estas regras são documentais; não são aconselhamento clínico, medição individual ou autorização de intervenção.",
    source: "docs/health/CCH_MAPA_SOBERANO_UNIFICADO_V6_0_FROZEN_2026-11-24.md; https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/966",
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
  "FM-02": {
    title: "Shopee — visão rápida da operação integrada (rascunho)",
    body: "Finalidade: concentrar a rotina física na Central de Separação. Fluxo alvo: Shopee → Hub → Raw → normalização → mapping exato → Pedido, Itens e Separação → documento logístico oficial → preparação física → coleta comprovada. A Shopee continua fonte fiscal/logística; o Core governa o negócio. O mapa F12 registra a jornada Adão até a prévia combinada em 16/11; prévia não prova impressão física ou coleta. Consultar Operações / Separação e, no Núcleo, a frente F12 e suas evidências. Não executar operações por este rascunho.",
    source: SHP_MASTER+"; "+F12_MAP,
  },
  "FM-04": {
    title: "Shopee — superfícies operacionais e de acompanhamento (rascunho)",
    body: "Código consultado: Operacoes.tsx admite aba separation e renderiza OrderSeparationBoard. Na Separação existem três colunas: A FAZER, EM PREPARAÇÃO e FINALIZADO; documentos anexados e prévia Etiqueta Shopee + Composição Interna. O diálogo ShopeeOrdersImportDialog é uma superfície distinta de importação. O Núcleo acompanha F12 e subfrentes sem operar o Hub. O mapa de telas é baseado no código e no mapa soberano; visibilidade por perfil e versão servida requerem prova autenticada.",
    source: SHP_MASTER+"; src/pages/Operacoes.tsx; src/components/operations/OrderSeparationBoard.tsx",
  },
  "FM-05": {
    title: "Shopee — controles significativos e efeitos (rascunho)",
    body: "ETIQUETA PENDENTE: botão principal indisponível em A FAZER para pedido Shopee sem etiqueta. IMPRIMIR: solicita abertura do documento; conferir sucesso antes de marcar impressão. IMPRIMIR COMPOSIÇÃO INTERNA: documento auxiliar, não etiqueta oficial nem fato físico. IMPRIMIR ETIQUETA + COMPOSIÇÃO: abre prévia combinada quando existe shipping_label; prévia sozinha não move separação. FINALIZAR: ação na coluna EM PREPARAÇÃO, exige autorização e fato físico conforme mapa; estoque insuficiente exibe impedimento, não presumir baixa. REIMPRIMIR: acesso ao documento de pedido finalizado. Não acionar controles para testar esta ficha; código observado não certifica runtime.",
    source: SHP_MASTER+"; src/pages/Operacoes.tsx; src/components/operations/OrderSeparationBoard.tsx",
  },
  "FM-09": {
    title: "Shopee — evolução e checkpoint histórico (rascunho)",
    body: "F12 permanece aberta sob escopo congelado; encerramento administrativo de 12/11 foi retificado. Checkpoint 16/11: F12.1 tem prova de dois envios no ciclo, não do teto 3+3; F12.2 PRs #623/#625 e #789, revisão isolada 00260-sug, sem homologação Live da reserva; F12.3 checkpoint/resume e testes isolados, concorrência real e meta 100/dia pendentes naquele recorte; F12.4 expansão sujeita a gates. Em 19/11 o caso Celivio documentou OAuth Live homologado, não homologação de pedidos/etiquetas. Estes são marcos históricos, não estado atual de Scheduler, flags ou tráfego. Próxima ação documental: reconciliar evidências posteriores com o especialista, preservando escopo e origem; nenhuma execução operacional.",
    source: F12_MAP+"; docs/operations/METODO_IMPLANTACAO_SHOPEE_CELIVIO_NETO_V1_0_2026-11-19.md",
  },
  "FM-10": {
    title: "Shopee — aprendizados reutilizáveis com limites (rascunho)",
    body: "Caso Celivio 19/11: checklist antigo dizia Gateway pendente; inspeção FULL confirmou rota existente. Regra proposta: estado efetivo prevalece sobre checklist, diagnosticar bloqueio observável antes de mudar arquitetura. GET de início OAuth cria state/cookie; não tratar 302 como health-check. Preservar hostname durante consentimento e verificar Core antes de repetir. Causa dos 409/400 históricos não comprovada; instrumentação sanitizada e sucesso posterior não resolvem retrospectivamente a causa. F12: separar conta+pedido+pacote, claims duráveis, tombstones e reconciliação antes de retry; etiqueta e ship_order aceito não provam coleta física. Lição de ambiente compartilhado: revisão com flags diferentes pode afetar outras contas; conferir tráfego e configuração antes de promover. Método do caso aceito como registro, reutilização ainda em avaliação; não autoriza ações LIVE.",
    source: F12_MAP+"; docs/operations/METODO_IMPLANTACAO_SHOPEE_CELIVIO_NETO_V1_0_2026-11-19.md",
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
    body: "O contrato técnico ET1 de Embalagem para Trufa, P100 lacrado / EA avulso, é histórico. A PR #355 foi mergeada em 23/10/2026 como acoplamento em validação; isso não demonstra a aplicação de migration, ativação física nem homologação. Define que 100 × P100 + EA é conservado na conversão física por variante/local; não converter estoque histórico automaticamente nem deduzir pacotes de unidades antigas. A abertura de pacote e os consumos precisam ser atômicos e idempotentes. O checkpoint é histórico e não comprova o estado atual da implementação nem autoriza execução. Para avaliar vigência, consultar especialista e testes sem alterar produção.",
    source: ET1_DOC+"; "+OP_PAGE,
  },
  "FM-08": {
    title: "Operações — autoridade do método (rascunho)",
    body: "O responsável técnico vigente do módulo Operações e a hierarquia dos métodos devem ser conferidos na documentação soberana e pela Camada Mestre. O ET1 é contrato de escopo específico e não substitui método geral. Código, testes em transação reversível, deploy, operação real e homologação são níveis distintos de prova. Sem autoridade confirmada, manter o estado como proposta e não iniciar integração entre módulos.",
    source: OP_PAGE+"; "+ET1_DOC,
  },
  "FM-02": {
    title: "Operações — consulta inicial de uma necessidade (rascunho)",
    body: "Na rota /operacoes, identifique primeiro se a consulta é de Pedido, Produto, Estoque, Produção, Compras ou MRP. Verifique a origem, o contexto e os documentos da necessidade antes de interpretar sua situação. No contrato histórico recuperado de 18/09/2026, Pedido não movimenta estoque por si, MRP representa planejamento e entrada/saída física exige evento próprio. Para acompanhamento no Núcleo, consultar evidências da frente e remeter qualquer operação ao módulo e especialista autorizado; esta ficha não abre pedidos nem confirma movimentações.",
    source: "src/pages/Operacoes.tsx; src/components/operations/MRPTab.tsx; src/components/operations/PurchasesTab.tsx; MAPA_NORTEADOR_CONTINUIDADE_MODULO_OPERACOES_V1_0_CONGELADO.txt (Biblioteca, 18/09/2026)",
  },
  "FM-05": {
    title: "Operações — catálogo de ações e efeitos a verificar (rascunho)",
    body: "A página Operacoes.tsx contém ações de criação e consulta de pedidos, navegação entre áreas operacionais e componentes de produção/estoque. MRPTab.tsx abre contexto assistido para Compras; PurchasesTab.tsx permite tratar condições financeiras por fluxo específico. Distinguir abrir/filtrar um registro de criar, faturar, receber, produzir ou movimentar fisicamente. Para cada comando, o responsável precisa confirmar permissões, evento persistido e eventual efeito em outro módulo. Não deduzir criação automática de compra, baixa de estoque ou quitação a partir da existência de botão ou RPC.",
    source: "src/pages/Operacoes.tsx; src/components/operations/MRPTab.tsx; src/components/operations/PurchasesTab.tsx; src/lib/purchases/confirmPurchaseFinancial.ts",
  },
  "FM-03": {
    title: "Operações — fronteiras entre planejamento e fato físico (rascunho)",
    body: "Pedido representa demanda; OP organiza produção; MRP calcula necessidades e prazos; sugestão de compra não constitui recebimento. O código de Compras distingue confirmação com fornecedor (sem obrigação financeira ou estoque), faturamento (criação de obrigações, sem pagamento) e recebimento físico. Financeiro é autoridade sobre pagamentos; não inferir quitação da compra. ET1 exige distinguir pacote lacrado P100 de unidade EA por variante/local e preservar histórico. Não converter saldo legado automaticamente nem acionar produção, estoque, compra ou Shopee pelo Núcleo.",
    source: "src/components/operations/MRPTab.tsx; src/components/operations/PurchasesTab.tsx; src/lib/purchases/confirmPurchaseFinancial.ts; docs/operacoes/ET1_EMBALAGEM_TRUFA_P100_EA_CONTRATO_TESTES.md",
  },
  "FM-06": {
    title: "Operações — jornada MRP até preparação de compra (rascunho)",
    body: "Na aba MRP, consultar Planejamento de compras: físico, necessidade produtiva, a receber, quantidade Comprar e prazo. Quando shortage > 0, Preparar compra encaminha para aba purchases com produto, necessidade, unidade e nome. Conferir identidade/variante, apresentação de compra, fornecedor, quantidade e condições antes de salvar; contexto MRP não prova pedido criado. A confirmação com fornecedor não altera estoque nem cria obrigação; faturamento e recebimento são etapas distintas. Consultar retorno e registro competente antes de declarar sucesso. Jornada fundamentada no código, não UAT atual nem autorização de execução.",
    source: "src/components/operations/MRPTab.tsx; src/components/operations/PurchasesTab.tsx; src/lib/purchases/confirmPurchaseFinancial.ts",
  },
  "FM-09": {
    title: "Operações — evolução e checkpoints documentais (rascunho)",
    body: "Checkpoint histórico CB3 de 21/10: abertura de chocolate base prevista automaticamente, sem botão manual, dependente de contrato único recebimento/consumo/saída; nota é rascunho. ET1 PR #355 registra implementação parcial e proibição de migration antes dos acoplamentos. Preservar BOM, fatos de produção e saldos anteriores. O código MRP/Compras consultado distingue planejamento, preparação, confirmação e faturamento; isso não demonstra deploy ou aceite. Próxima ação documental: reconciliar o estado atual das frentes e evidências com o especialista Operações, sem reabrir contratos históricos ou promover conclusão por presença de código.",
    source: "docs/operacoes/chocolate-cb3-notas-implementacao-20261021.md; docs/operacoes/ET1_EMBALAGEM_TRUFA_P100_EA_CONTRATO_TESTES.md; src/components/operations/MRPTab.tsx; src/components/operations/PurchasesTab.tsx",
  },
  "FM-10": {
    title: "Operações — aprendizagens reutilizáveis e limites (rascunho)",
    body: "ET1 documenta que 100 × P100 + EA conserva quantidade física nas conversões por variante/local; 500 EA não comprovam cinco pacotes fechados. Abrir apenas o mínimo necessário, atomicamente com o fato, sob lock e idempotência; conciliar antes de repetir e preservar BOM correta (product_batch_recipe_items não é BOM de embalagem). Não deduzir consumo das variantes sem BOM nem converter histórico por conveniência. CB3 reforça contrato único entre recebimento, produção e saída, sem publicar acoplamento parcial. MRP antecipa, fatos físicos confirmam; faturamento não é pagamento. Regras documentais e testes exigidos, não prova de ativação ou autorização de mudança de estoque.",
    source: "docs/operacoes/ET1_EMBALAGEM_TRUFA_P100_EA_CONTRATO_TESTES.md; docs/operacoes/chocolate-cb3-notas-implementacao-20261021.md; src/components/operations/MRPTab.tsx; src/components/operations/PurchasesTab.tsx",
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
  "FM-02": {
    title: "Financeiro — consulta inicial e distinção de fatos (rascunho)",
    body: "Acesse /financeiro e escolha a área conforme a pergunta: dashboard, receber, pagar, contas, contatos, categorias, valores, notas ou motor Shopee; as opções correspondem a abas observadas no código. Consulte competência, vencimento, data de compra, pagamento e movimentação como conceitos distintos; a regra exata depende do contrato financeiro vigente. Navegar e consultar não significa criar, baixar ou conciliar um lançamento. Confrontar o resultado do dashboard com o fato financeiro persistido antes de assumir que determinada liquidação está representada.",
    source: "src/pages/Financeiro.tsx; src/hooks/useFinancial.ts",
  },
  "FM-05": {
    title: "Financeiro — ações técnicas e limites de prova (rascunho)",
    body: "O componente Financeiro.tsx integra listas de recebimentos/pagamentos, gestão de contas, categorias e contatos, notas, precificação e motor Shopee. O uso de useFinancial oferece ações de consulta e alteração que precisam ser analisadas por fluxo específico. A existência de componentes de importação ou conciliação não comprova suas regras de competência, liquidação, idempotência, arredondamento ou efeitos em compras. Não executar importação de extratos, confirmação de pagamento, estorno nem fechamento financeiro pelo Núcleo.",
    source: "src/pages/Financeiro.tsx; src/hooks/useFinancial.ts",
  },
  "FM-03": {
    title: "Financeiro — fronteiras de autoridade (rascunho)",
    body: "O Estado Mestre V1.0 de 03/10 distingue obrigação/competência (financial_entries) de movimento realizado (financial_movements). Operações governa pedido de compra, itens, fornecedor, recebimento físico e estoque; Financeiro governa obrigação, vencimento, pagamento, recebimento, movimento e conciliação; Shopee fornece eventos externos, não comprovação de dinheiro no banco. O documento declara vigência naquela data, não prova estado técnico atual. Alterações transversais de schema e vínculos exigem Camada Mestre.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-FINANCEIRO-V1.0.txt",
  },
  "FM-06": {
    title: "Financeiro — jornada obrigação até movimento (rascunho)",
    body: "Jornada documental: identificar origem da obrigação, consultar lançamento, competência, vencimento, saldo e conta; distinguir confirmação comercial de faturamento. O código de Compras chama register_purchase_billing ou register_purchase_invoice_billing para faturamento. No Financeiro, PaymentDialog apresenta Registrar Pagamento/Recebimento e Confirmar Baixa. useFinancial exige conta, verifica valor contra saldo, registra movimento e atualiza data de pagamento quando totalmente quitado. Confirmar retorno e conciliar origem, obrigação e movimento; não presumir quitação nem atomicidade de todo o fluxo a partir do código. Jornada de consulta e orientação, sem autorização de execução financeira.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-FINANCEIRO-V1.0.txt; src/lib/purchases/confirmPurchaseFinancial.ts; src/components/financial/PaymentDialog.tsx; src/hooks/useFinancial.ts",
  },
  "FM-07": {
    title: "Financeiro — fontes e evidências (rascunho)",
    body: "Estado Mestre V1.0 recuperado de 03/10 é fonte histórica de continuidade, declara estado técnico em tempo real não confirmado. Código consultado: Financeiro.tsx, useFinancial.ts, PaymentDialog.tsx e confirmPurchaseFinancial.ts. Existem referências a financial_entries e registro de pagamentos, além de RPCs de faturamento de compra. A presença dessas funções comprova superfície técnica, não aplicação de migration, consistência contábil, atomicidade, idempotência ou funcionamento publicado. Não incorporar dados bancários, valores privados, credenciais ou registros pessoais à ficha. Conferir provas atuais no especialista competente.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-FINANCEIRO-V1.0.txt; src/pages/Financeiro.tsx; src/hooks/useFinancial.ts; src/lib/purchases/confirmPurchaseFinancial.ts",
  },
  "FM-09": {
    title: "Financeiro — evolução e checkpoint histórico (rascunho)",
    body: "O Estado Mestre de 03/10 registra homologação documental da reconstrução V0.1 como primeira V1.0 vigente naquele momento, sem declarar frentes concluídas. N1 Compra → obrigação; N2 origem → obrigação → pagamento → movimento; N3 Shopee taxa → recebível → repasse → movimento → conciliação; N4 uso real antes de inteligência. Hoje há código de faturamento de compras por RPC e registro de pagamentos, mas estado produtivo e abrangência não comprovados neste recorte. Próxima ação documental: reconciliar a fonte histórica com especialista e evidências atuais; vincular frente real somente após escopo comprovado, sem criar frente fictícia nem declarar fechamento financeiro.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-FINANCEIRO-V1.0.txt; src/lib/purchases/confirmPurchaseFinancial.ts; src/hooks/useFinancial.ts",
  },
  "FM-10": {
    title: "Financeiro — aprendizagem e regras reutilizáveis (rascunho)",
    body: "Diretrizes recuperadas do Estado Mestre: preservar a fundação existente, conectar fatos econômicos sem reconstruir o módulo; obrigação não é caixa; eventos marketplace não provam dinheiro recebido; fechar vínculos canônicos idempotentes antes de custos e inteligência. O código de baixa exige conta e limita valor ao saldo remanescente, incluindo pagamentos parciais no acompanhamento. A existência desses guardas não demonstra segurança de concorrência ou atomicidade: exigir evidência específica antes de declarar tais propriedades. Separar competência, vencimento, liquidação e movimento; preservar origem e histórico. Regras documentais e observações de código, não lições de incidente produtivo homologado nem orientação contábil.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-FINANCEIRO-V1.0.txt; src/hooks/useFinancial.ts; src/lib/purchases/confirmPurchaseFinancial.ts",
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
  "FM-02": {
    title: "Captura Central — leitura e destinação proposta (rascunho)",
    body: "Em /captura, identifique o registro e seus anexos; confira texto, mídia e histórico antes de escolher uma interpretação. O código permite abrir decisão de fazer ou planejar, resolver como referência/arquivada e criar tarefa a partir de captura, mas essas escolhas são fluxos operacionais distintos. A existência de uma captura não equivale a tarefa aprovada ou executada. A ficha do Núcleo serve para consulta, sem escrever ou mover registros.",
    source: "src/pages/CapturaCentral.tsx",
  },
  "FM-05": {
    title: "Captura Central — ações de triagem observadas (rascunho)",
    body: "O código de CapturaCentral.tsx implementa funções de envio e upload de anexos, gravação de áudio, edição, exclusão com confirmação, abertura de decisão, resolução como referência/arquivada e criação de tarefa. Essas rotas exigem autorização, confirmação dos vínculos e preservação dos anexos e da trilha de origem. A ficha não confirma que a classificação por IA ou a execução de tarefas está homologada; não disparar nenhuma dessas ações a partir do Núcleo.",
    source: "src/pages/CapturaCentral.tsx",
  },
  "FM-03": {
    title: "Captura Central — fronteiras e compreensão (rascunho)",
    body: "O Estado Mestre de 03/10 define a captura como entrada universal e descarga mental: nem toda captura precisa gerar ação, toda captura deve gerar compreensão. Captura, interpretação, decisão, tarefa, planejamento e execução são eventos distintos. O código permite referência e arquivamento sem tarefa, ou fazer/planejar com vínculo a tarefa. A visão de relações múltiplas, enriquecimento, RAG e memória universal não equivale à implementação atual. Não transferir anexos privados ao Núcleo nem inferir autorização de execução.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-CAPTURA-CENTRAL-V1.0.txt; src/pages/CapturaCentral.tsx",
  },
  "FM-06": {
    title: "Captura Central — jornada de decisão até planejamento e foco (rascunho)",
    body: "Na Caixa de decisão, consultar registro, anexos e contexto. A interface oferece Fazer agora, Planejar, Referência e Arquivar. As duas primeiras opções exigem título e nó; Fazer agora com fila cheia solicita escolha de tarefa para retornar ao Planejamento, sem exclusão. O código cria tarefa e vincula a captura, depois atualiza o plano; se sincronização falhar, informa preservação da tarefa e orientação para reabrir Planejamento. Conferir vínculo e estado antes de afirmar sucesso ou repetir. Referência/arquivo não exigem tarefa. Roteiro baseado em código, não prova de atomicidade nem autorização para operar.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-CAPTURA-CENTRAL-V1.0.txt; src/pages/CapturaCentral.tsx",
  },
  "FM-07": {
    title: "Captura Central — evidências e limites (rascunho)",
    body: "Fonte documental: Estado Mestre V1.0 recuperado, declara vigência em 03/10 e implementação transversal parcial naquele checkpoint. Código CapturaCentral.tsx consulta inbox_entries, estados, anexos e linked_task_id; cria tasks e atualiza fluxo de planejamento/foco. São evidências de superfície técnica, não prova de isolamento, persistência completa, atomicidade, entrega de mídia ou revisão servida. O mapa conceitual e método vigente precisam de reconciliação competente. Não coletar registros ou anexos individuais para a ficha.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-CAPTURA-CENTRAL-V1.0.txt; src/pages/CapturaCentral.tsx",
  },
  "FM-09": {
    title: "Captura Central — evolução e checkpoint (rascunho)",
    body: "Checkpoint 03/10: primeira V1.0 documental vigente naquele momento, patrimônio de entrada simples e vínculos manuais preservado. N1 confirmar estados/writers; N2 fechar Captura → Planejamento → Foco; N3 melhorar associação sem carga mental; N4 separar compreensão de execução; N5 validar uso antes de RAG/grafo. Código consultado apresenta decisões e vínculo de tarefas com fila de foco, sem homologação atual. Próxima ação: reconciliar estado e método com especialista e prova real, sem criar frente fictícia ou executar capturas.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-CAPTURA-CENTRAL-V1.0.txt; src/pages/CapturaCentral.tsx",
  },
  "FM-10": {
    title: "Captura Central — aprendizagem reutilizável (rascunho)",
    body: "Diretrizes documentais: preservar simplicidade de registro, compreender antes de propor ação, não transformar toda ideia em tarefa, separar sugestão de execução. O código evidencia etapas de criação, vínculo e atualização de plano distintas, com tratamento de sincronização parcial e tentativa de compensação quando tarefa criada não foi vinculada; isso não prova transação atômica ou compensação garantida. Conferir origem e vínculo antes de repetir e preservar tarefas deslocadas da fila. Não tratar objetivos de IA/RAG como capacidade implementada. São observações documentais e técnicas, não incidentes homologados.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-CAPTURA-CENTRAL-V1.0.txt; src/pages/CapturaCentral.tsx",
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
  "FM-02": {
    title: "Rotina — consulta por período e escopo (rascunho)",
    body: "Na rota /rotina, selecione o escopo disponível (pessoal ou empresa) e a visualização dia, semana ou mês. Consulte primeiro os blocos e sua situação antes de alterar ordem, horário ou recorrência. O código usa useRoutine e componentes específicos para cada período, mas não demonstra que alarmes foram entregues ou que replanejamento automático obteve resultado correto. Este modelo não dispara blocos, notificações nem tarefas.",
    source: "src/pages/Rotina.tsx; src/hooks/useRoutine.ts",
  },
  "FM-05": {
    title: "Rotina — ações previstas no hook (rascunho)",
    body: "O contrato de useRoutine contém iniciar, completar, pular, adicionar, atualizar, excluir, pausar e reordenar blocos, além de planejamento de dia/semana. A página Rotina.tsx utiliza diálogos de edição e conclusão e controles de alarmes. Cada ação pode mudar o estado real da rotina e deve ser exercida pelo operador autorizado, com conferência do resultado; a mera presença do hook não prova persistência, notificações recebidas ou cumprimento dos blocos. O Núcleo documenta e supervisiona, não executa.",
    source: "src/pages/Rotina.tsx; src/hooks/useRoutine.ts",
  },
  "FM-03": {
    title: "Rotina — fronteiras do Sistema de Execução (rascunho)",
    body: "Estado Mestre de 03/10 distingue recorrente → Rotina, estruturante → Projeto/Planejamento, próxima ação relevante → Foco. Não duplicar obrigação entre módulos. Rotina possui vínculos task_id e escopos pessoal/empresa no código; vínculo não comprova execução de tarefa ou fato comercial/financeiro/produtivo. Preservar autoridade dos módulos respectivos, privacidade e permissões. Planejamento automático não equivale a autorização irrestrita de IA.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-ROTINA-V1.0.txt; src/pages/Rotina.tsx; src/hooks/useRoutine.ts",
  },
  "FM-06": {
    title: "Rotina — jornada de acompanhamento e execução (rascunho)",
    body: "Consultar escopo disponível e período Dia/Semana/Mês, identificar bloco, método de trabalho, horário e vínculo com tarefa. Distinguir iniciar, pausar, completar e pular, presentes no hook useRoutine; consultar estado e confirmação após ação autorizada. Planejamento do dia/semana e templates são preparação, não conclusão de execução. Arquivamento de bloco é ação distinta de conclusão e exige conferir histórico. Este roteiro descreve código e diretrizes, não operação autenticada comprovada; não alterar blocos ou alarmes pelo Núcleo.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-ROTINA-V1.0.txt; src/pages/Rotina.tsx; src/hooks/useRoutine.ts",
  },
  "FM-07": {
    title: "Rotina — fontes e evidências (rascunho)",
    body: "Estado Mestre V1.0 de 03/10 lista routine_blocks, routine_templates, routine_mts, routine_prefs, routine_stats e timer_state, além de integrações e visões Dia/Semana/Mês. Código Rotina.tsx e useRoutine.ts apresenta escopo mine/company, consulta por intervalo e ações sobre blocos, planejamento e estatísticas. Não confundir lista documental de tabelas com schema vigente verificado. Não comprova RLS efetiva, alarmes entregues, persistência, concorrência ou execução real. Não importar agenda individual ou dados privados.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-ROTINA-V1.0.txt; src/pages/Rotina.tsx; src/hooks/useRoutine.ts",
  },
  "FM-09": {
    title: "Rotina — evolução e checkpoint (rascunho)",
    body: "Checkpoint histórico 03/10: V1.0 documental preserva fundação, prioridade de uso real e integrações. N1 consolidar capacidades existentes; N2 fronteira Rotina/Tarefa/Foco/Planejamento; N3 integrações CRM/Financeiro/Produção/Digital; N4 IA somente conforme necessidade comprovada. Registro Universal, Action Executor e arquivamento lógico eram temas em observação; código atual contém arquivamento de bloco, mas não autoriza concluir os demais temas. Próxima ação: reconciliar mapa e especialista, testar atritos reais e vincular frente fundamentada; não redesenhar módulo ou criar frente artificial.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-ROTINA-V1.0.txt; src/pages/Rotina.tsx; src/hooks/useRoutine.ts",
  },
  "FM-10": {
    title: "Rotina — aprendizagem e continuidade (rascunho)",
    body: "Diretriz recuperada: consolidar uso antes de redesenhar; distinguir recorrência, projeto e próxima ação; não duplicar obrigações. Código distingue concluído e pulado e calcula estatísticas de blocos; quantidade planejada ou duração nominal não demonstra produtividade ou tempo efetivamente trabalhado. Alarme configurado não prova entrega, bloco iniciado não prova conclusão, tarefa vinculada não equivale a fato de outro módulo. Preservar histórico e revisar resultado antes de repetir ou replanejar. São regras documentais/observações técnicas, não prova de eficácia ou incidentes homologados.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-ROTINA-V1.0.txt; src/pages/Rotina.tsx; src/hooks/useRoutine.ts",
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
  "FM-02": {
    title: "Digital — visão rápida orientada a resultado (rascunho)",
    body: "Estado Mestre V1.0 de 03/10 define Digital como inteligência e execução de marketing orientada a resultado. Jornada desejada: Campanha/Conteúdo → Lead → CRM → Venda/Não venda → Resultado → Digital aprende. A página Digital contém ideias, calendário, mídia, métricas, plataformas, tendências, engajamento, FAQ, atendimento e campanhas. Estratégia e interpretação de performance pertencem ao Digital; atendimento e semântica comercial ao CRM. Consultar calendário, plano semanal e campanha conforme necessidade. O ciclo completo é objetivo documental, não integração homologada.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-DIGITAL-V1.0.txt; src/pages/Digital.tsx",
  },
  "FM-05": {
    title: "Digital — catálogo de ações de campanha (rascunho)",
    body: "CampaignsPanel mostra Nova Campanha, Criar campanha, Aprovar campanha e Concluir campanha, com bloqueio quando conta autenticada não possui colaborador ativo. Criação depende de ideia existente; useCampaigns registra campaign_applications e campaign_executions. Aprovação, confirmação de execução e conclusão chamam RPCs específicas. Evidências, métricas e aprendizados são registros próprios. Não confundir aprovação com publicação externa ou confirmação comercial; criação em operações separadas não prova atomicidade. Presença do controle no código não confirma permissão efetiva ou runtime. Não acionar ações pelo Núcleo.",
    source: "src/components/digital/CampaignsPanel.tsx; src/hooks/useCampaigns.ts",
  },
  "FM-06": {
    title: "Digital — jornada de campanha e retorno comercial (rascunho)",
    body: "Jornada documentada e observada em código: partir de ideia, definir objetivo, criar campanha essencial, submeter à aprovação, registrar evidência de execução, confirmar execução, registrar métrica e aprendizado, concluir conforme critérios competentes. Confrontar resultado comercial com fatos do CRM e pedidos oficiais, preservando origem e identidade. CampaignPerformancePanel não apresenta total parcial como resultado completo. Venda informada na Inbox não equivale a recebimento, origem rastreada não prova causalidade. A associação canônica Digital/CRM/Meta ainda requer reconciliação; não presumir vínculo entre IDs ou publicar campanhas por esta ficha.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-DIGITAL-V1.0.txt; src/components/digital/CampaignsPanel.tsx; src/hooks/useCampaigns.ts; src/components/crm/CampaignPerformancePanel.tsx",
  },
  "FM-09": {
    title: "Digital — evolução e checkpoint documental (rascunho)",
    body: "Estado Mestre de 03/10 declara homologação documental da reconstrução V0.1 como V1.0 vigente naquele momento; não conclui frentes. N1 fechar resultado Digital/CRM; N2 identidade canônica de campanha; N3 auditar origem/atribuição; N4 uso real de calendário, plano semanal, campanhas e dashboard; N5 aprendizado antes de ampliar Ads/automações. Código atual consultado possui campaign_applications e visão CRM de desempenho; não comprova identidade compartilhada nem integração produtiva. Próxima ação: reconciliar fontes atuais e método 03_MARKETING_CAMPANHAS/00_METODO_VIGENTE com especialista competente, sem criar frente fictícia. Método original referido na fonte não foi inspecionado neste recorte.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-DIGITAL-V1.0.txt; src/hooks/useCampaigns.ts; src/components/crm/CampaignPerformancePanel.tsx",
  },
  "FM-10": {
    title: "Digital — aprendizagem e regras de atribuição (rascunho)",
    body: "Diretriz do Estado Mestre: não criar três verdades concorrentes de Campanha em Digital, CRM e Meta; preservar estratégia, atendimento e infraestrutura em suas autoridades. Aprender com resultado comercial antes de ampliar Ads e automações. Código CampaignPerformancePanel explicita que falha de leitura não vira zero, destinatários podem repetir entre campanhas, vínculos ambíguos de pedidos exigem tratamento, origem rastreada não prova causalidade e valor de Pedido/status pago não equivale a recebimento/conciliação. São regras documentais e guardas observados no código, não prova de eficácia de campanhas ou experiência produtiva homologada. Não expor dados pessoais de leads.",
    source: "docs/architecture/knowledge-recovery/2026-10-03/PCL-MST-ESTADO-DIGITAL-V1.0.txt; src/components/crm/CampaignPerformancePanel.tsx",
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
