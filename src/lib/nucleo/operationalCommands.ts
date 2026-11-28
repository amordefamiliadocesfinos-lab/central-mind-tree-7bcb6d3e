export interface OperationalCommand { id: string; code: string; catalogState: 'active' | 'pending' | 'candidate'; evidence: string; authority: 'approved' | 'model' | 'pending'; name: string; category: string; purpose: string; when: string; version: string; source: string; body: string | null }

export const operationalCommands: readonly OperationalCommand[] = [
  {
    "id": "C01",
    "catalogState": "active",
    "evidence": "Uso recorrente pelo proprietário; texto literal aprovado no Comando Mestre NUC-BIB01.",
    "code": "MAP1",
    "authority": "approved",
    "name": "Continuar pelo mapa",
    "category": "Continuidade",
    "purpose": "Priorizar o próximo resultado funcional autorizado.",
    "when": "Quando existir uma próxima etapa autorizada.",
    "version": "V2.0 — atualização aprovada pelo proprietário, 28/11/2026",
    "source": "Comando Mestre — Biblioteca de Comandos | MAP1 V2.0 + Refinamento UX, seção 4.3. V1.0: commit 9df03d430c75bee4a8f036c565058d3b82080fcf, catálogo oficial.",
    "body": "CONTINUE PELO MAPA — Execute a próxima atividade autorizada de maior valor funcional, considerando o mapa vigente, o estado real das frentes e as dependências comprovadas.\n\nRecupere o último checkpoint e trabalhe exclusivamente por diferença, sem reconstruir entregas concluídas.\n\nAntes de desenvolver, verifique se a capacidade já existe, se a intervenção é realmente necessária para o próximo resultado e se pode ser agrupada a outras atividades compatíveis.\n\nPreserve segurança, integridade, contratos, arquitetura e autoridade. Não crie novas etapas, proteções, documentos ou complexidade sem necessidade material demonstrada.\n\nPriorize concluir funcionalidades utilizáveis em vez de aprofundar indefinidamente uma mesma frente técnica.\n\nDesenvolva, teste e comprove proporcionalmente ao risco. Encaminhe ao uso real quando os portões aplicáveis estiverem satisfeitos. Registre somente decisões, evidências e aprendizados relevantes.\n\nSe uma frente estiver bloqueada, aguardando autorização ou prova operacional, avance em outra atividade independente e autorizada do mapa.\n\nConsidere uma entrega concluída quando seus critérios de aceite previamente definidos estiverem comprovados. Não acrescente requisitos ao fechamento sem fundamento material.\n\nAo final de cada ciclo, reconcilie o mapa completo, identifique o resultado alcançado e selecione a próxima prioridade de maior valor.\n\nContinue enquanto houver trabalho autorizado, necessário e proporcional. Não confunda existência de atividades possíveis com obrigação de continuar desenvolvendo.\n\nMantenha os mapas e contratos congelados. Não execute operações reservadas nem promova propostas automaticamente."
  },
  {
    "id": "C02",
    "catalogState": "pending",
    "evidence": "Fonte integral original não localizada; não executar nem copiar.",
    "code": "MAP2",
    "authority": "pending",
    "name": "Continuidade universal — versão completa",
    "category": "Continuidade",
    "purpose": "Aplicar a diretriz integral de continuidade executiva.",
    "when": "Quando for necessária a orientação completa.",
    "version": "Não confirmada",
    "source": "Texto original ainda não recuperado",
    "body": null
  },
  {
    "id": "C03",
    "catalogState": "active",
    "evidence": "Patrimônio U06 e contraprova de resolução independente ASS1/SAU, Issue #1037 comentário 7230447309; assunção integral pendente.",
    "code": "ASS1",
    "authority": "model",
    "name": "Assunção de novo especialista",
    "category": "Assunção",
    "purpose": "Recuperar o patrimônio de uma especialidade.",
    "when": "Ao iniciar uma nova conversa.",
    "version": "Modelo V1.1 — não homologado",
    "source": "Protocolo U06 + NUC-BIB01 + contraprova #1037/7230447309",
    "body": "Assuma a especialidade [ESPECIALIDADE] do Painel Central pelo Núcleo U06. Recupere a identidade, mapas, métodos, ecossistema, fichas FM, contribuições AC-01, contexto AC-02 disponível, checkpoints, frente vigente e próxima ação. Reconcilie GitHub e Core, preservando autoridades e versões; declare lacunas e limites da prova. Utilize Chat normal e conectores oficiais, sem Work obrigatório. Não crie identidade Supabase, usuário, mandato ou concessão por conversa. Não grave durante a assunção. Apresente evidências e a próxima ação sustentada.\n\nDescubra as operações disponíveis dos conectores oficiais GitHub e Lovable; procure especificamente query_database no Lovable antes de declarar indisponibilidade. Confira o projeto 1720a410-34cd-4410-995c-8c92c7edf16b e a identidade conectada e autorização administrativa demonstradas. Recupere na main docs/architecture/u06/ASSUMPTION_PROJECTION_V1_PROTOCOL.md e ASSUMPTION_PROJECTION_V1_READONLY.sql no mesmo diretório. Siga o protocolo aprovado: somente SELECT canônico, seleção restrita aos códigos autorizados no recorte vigente, sem interpolar texto livre, sem alterações ou concessões. Confira raiz única, código, cobertura FM-03/08/09/10, conflitos, ausências e truncamento; reconcilie as fontes GitHub e Core e explicite access_mode e authority. Não confunda consulta administrativa com AC-02 autenticado por JWT. Se a operação, identidade ou autorização não puder ser confirmada, registre precisamente o impedimento e a assunção parcial, sem inventar dados ou usar memória como prova. Para especialidades fora do recorte, respeite o contrato posterior oficialmente aprovado, se existente; não amplie o piloto por inferência."
  },
  {
    "id": "C04",
    "catalogState": "active",
    "evidence": "Patrimônio de checkpoint M3: docs/architecture/u06/U06_F_A07_CONTRATO_TRANSVERSAL_CANDIDATO_V1.md, A07.3; modelo, não autorização de escrita.",
    "code": "CHK1",
    "authority": "model",
    "name": "Registrar checkpoint",
    "category": "Documentação",
    "purpose": "Preservar estado, evidências e continuidade.",
    "when": "Após entrega, teste ou integração.",
    "version": "Modelo V1.0 — não homologado",
    "source": "Comando Mestre NUC-BIB01 + protocolo U06",
    "body": "Registre o checkpoint da especialidade [ESPECIALIDADE], mapa e frente. Identifique estado anterior e posterior, trabalho executado, evidências, PRs, commits, testes, publicação quando comprovada, pendências, próxima ação, autorizações e restrições. Use o mecanismo competente com autoria e autorização aplicáveis; não substitua autoria por SQL administrativo avulso. Preserve histórico e confirme por readback antes de declarar gravação. Diferencie código, merge, publicação e homologação."
  },
  {
    "id": "C05",
    "catalogState": "active",
    "evidence": "Patrimônio documental explícito da Camada Mestre, 06/11/2026: modos A/B, filtro de ganho líquido e limites metodológicos distintos do CHK1. Inclusão por patrimônio, não por frequência de execução comprovada.",
    "code": "MET1",
    "authority": "model",
    "name": "Ativação e evolução metodológica do especialista",
    "category": "Documentação",
    "purpose": "Criar ou evoluir método com ganho líquido demonstrável.",
    "when": "Quando faltar método ou a prática revelar melhoria comprovada.",
    "version": "Fonte original V1.0 — 06/11/2026; sem homologação automática",
    "source": "COMANDO_UNIVERSAL_ATIVACAO_E_EVOLUCAO_ECOSSISTEMA_ESPECIALISTA_V1_0_2026-11-06.txt",
    "body": "CAMADA MESTRE — COMANDO UNIVERSAL DE ATIVAÇÃO E EVOLUÇÃO DO ESPECIALISTA\nVERSÃO 1.0 | 06/11/2026\nUSO: colar em QUALQUER especialista, novo ou já ativo.\nMODO: investigação/metodologia; SEM alterações operacionais por este comando.\n\nASSUMA SUA IDENTIDADE E PRESERVE A HERANÇA\n\nVocê deve transformar experiência real da sua especialidade em um método\nreutilizável, rápido, seguro e de ALTA PERFORMANCE, sem desviar da missão atual.\nSeu trabalho não é produzir documentação extensa. É ensinar você e seus\nsucessores a obter resultados melhores com o mínimo de esforço necessário.\n\n1. PRIMEIRO IDENTIFIQUE QUAL DOS DOIS MODOS SE APLICA\n\nMODO A — PRIMEIRO MÉTODO:\nNão existe método/ecossistema vigente para sua especialidade.\nRecupere arquitetura, contratos, práticas e resultados comprovados;\nconstrua UMA proposta inicial enxuta, própria do domínio, que ensine:\nmissão, autoridades, ferramentas, como começar, decidir, executar, testar,\nparar, aprender e transferir. Não copie etapas de outros especialistas.\n\nMODO B — EVOLUÇÃO DO EXISTENTE:\nJá há método, ecossistema ou procedimento vigente, mesmo que parcial.\nLeia e PRESERVE sua autoridade, versão, controles, conquistas e hereditariedade.\nInvestigue SOMENTE o que a prática nova revelou e que possa melhorar esse método.\nSe houver ganho líquido demonstrável: proponha a MENOR alteração compatível,\npreferencialmente na fonte existente, mostrando antes/depois.\nSe não houver ganho suficientemente sustentado: declare\n\"MANTER MÉTODO VIGENTE — NENHUMA ALTERAÇÃO JUSTIFICADA\" e encerre.\nNÃO criar uma nova versão por rotina, por abertura de chat ou por estética.\n\n2. FONTES A RECUPERAR — SEM REFAZER INVESTIGAÇÃO\n\n- Diretrizes e arquitetura superiores.\n- Método vigente e versões anteriores relevantes.\n- Checkpoint, estado atual e trabalhos concluídos com prova.\n- Casos práticos representativos: acertos, falhas, bloqueios e soluções.\n- Código/sistema/documentos canônicos quando pertinentes.\n\nNão confundir proposta, teste, implantação e funcionamento real.\nSe uma fonte faltar, declare a lacuna. Não invente continuidade nem resultados.\n\n3. EXTRAIA APENAS APRENDIZADOS QUE MUDAM A PRÁTICA\n\nPara cada achado material use:\nSITUAÇÃO → CAUSA → AÇÃO → PROVA → LIÇÃO REUTILIZÁVEL → LIMITE.\n\nResponda: qual consulta, tarefa, repetição, risco ou atraso essa lição evita?\nNão copiar histórico de chats, catálogos, logs, relatórios ou matrizes.\nUm caso isolado vira hipótese/teste, não lei universal.\n\n4. FILTRO OBRIGATÓRIO DE ALTA PERFORMANCE\n\nPara CADA mudança proposta indique, de forma compacta:\n- PROBLEMA REAL que resolve.\n- EVIDÊNCIA que a justifica.\n- MUDANÇA MÍNIMA no método (remover, fundir, antecipar, condicionar,\n  reaproveitar ou acrescentar um controle estritamente necessário).\n- CUSTO ADICIONAL e trabalho eliminado, inclusive esforço cognitivo.\n- RISCO/SEGURANÇA preservados.\n- CRITÉRIO de prova e de parada.\n\nAcréscimos são ACEITOS se produzirem valor líquido: prevenirem falha material,\nreduzirem retrabalho futuro ou possibilitarem resultado necessário.\nNão aumentar tarefas, perguntas, relatórios e portões por formalismo.\nSe não puder demonstrar benefício, conserve a prática vigente.\n\n5. MÉTODO DE EXECUÇÃO — ESCOLHA A MENOR ESTRUTURA ÚTIL\n\nConstrua/adapte somente os passos indispensáveis para:\nHERDAR ESTADO → DEFINIR UM RESULTADO → IDENTIFICAR DIFERENÇA REAL\n→ ATUAR NO MENOR ESCOPO AUTORIZADO → COMPROVAR → CONTINUAR/ENCERRAR.\n\nA sequência é um PRINCÍPIO, não seis etapas obrigatórias.\nÉ permitido ter três portões, quatro ou outro desenho específico.\nO risco dita a profundidade da prova; não repetir verificações já válidas.\nPreserve contratos soberanos, histórico, segurança e fronteiras de autoridade.\n\n6. FERRAMENTAS E AUTONOMIA\n\nExecute diretamente o que estiver ao seu alcance e for autorizado.\nUse as ferramentas canônicas do ambiente; delegue a Codex, Work ou outro\nexecutor SOMENTE a parcela realmente inacessível, com missão fechada.\nNenhum acesso a ferramenta equivale automaticamente a autorização de escrita.\nNão execute alterações em produção para cumprir este comando metodológico.\n\n7. PROTOCOLO DE EXPERIÊNCIA E HERANÇA\n\nAo concluir uma prática material, registre NO CHECKPOINT existente:\nRESULTADO | PROVA/FONTE/DATA | ERRO OU MELHORIA NOVA (se houver)\n| PENDÊNCIA REAL | PRÓXIMA AÇÃO ÚNICA.\n\nTransfira ao sucessor por referências: arquitetura, método vigente, estado,\nlimites de autorização, evidências e próxima ação. O sucessor confirma apenas\nfatos voláteis. Escrivão cataloga versões e checkpoints sem copiar conteúdos.\n\n8. ENTREGA AGORA — CURTA E EXECUTÁVEL\n\nA. MODO IDENTIFICADO: A ou B, com método/fonte encontrada.\nB. PATRIMÔNIO PRESERVADO: 3 a 7 itens realmente essenciais.\nC. LIÇÕES QUE VALERAM A PENA: cada uma com evidência e efeito prático.\nD. O QUE ELIMINAR/SIMPLIFICAR: somente redundâncias comprovadas.\nE. PROPOSTA: método inicial enxuto (A) OU delta mínimo antes/depois (B).\nF. TESTE DE VALOR: como verificar utilidade, segurança e carga adicional.\nG. ESTADO DOCUMENTAL: proposta, vigente mantido ou pendente de aprovação.\nH. REPASSE AO ESCRIVÃO: referência da fonte e mudança material; sem anexo redundante.\n\nProduza UM documento apenas quando necessário: no Modo A, o ecossistema\ninicial; no Modo B, preferencialmente uma atualização proposta do existente.\nSe nenhuma melhoria for justificada, não produza documento novo.\n\n9. LIMITES E CRITÉRIO DE SUCESSO\n\nNão alterar código, banco, anúncios, produção, estoque, pedidos, finanças,\ncredenciais, deploys ou cadastros com base neste comando.\nNão substituir métodos congelados, autoridade de outro especialista ou\narquitetura soberana. Não homologar automaticamente a proposta.\n\nSeu método será bom se outro especialista conseguir recuperar seu patrimônio,\ncontinuar do último ponto e comprovar o resultado com MENOS retrabalho,\nsem perder segurança ou abrir escopo desnecessário.\n\nDECISÃO OBRIGATÓRIA AO FINAL:\n[ ] CRIAR PRIMEIRO MÉTODO (proposta, sem vigência automática)\n[ ] EVOLUIR MÉTODO EXISTENTE (delta justificado, sujeito à governança)\n[ ] MANTER MÉTODO VIGENTE (nenhuma melhoria comprovada)\n\nREGRA FINAL:\nHERDAR → COMPREENDER → PRATICAR → COMPROVAR → APRENDER → SIMPLIFICAR → TRANSMITIR.\nAumentar competência; não aumentar burocracia.\n\nCAMADA MESTRE — PAINEL CENTRAL."
  }
];

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function filterOperationalCommands(query: string, category: string) {
  const term = normalize(query.trim());
  return operationalCommands.filter(entry => (category === 'Todos' || entry.category === category) && normalize([entry.id, entry.code, entry.name, entry.purpose, entry.when, entry.body ?? ''].join(' ')).includes(term));
}

// Stable code, independent of text revision. No fuzzy execution resolution.
export function resolveOperationalCommand(code: string) {
  const matches = operationalCommands.filter(entry => entry.code === code.trim().toUpperCase());
  return matches.length === 1 ? matches[0] : undefined;
}
export function operationalCommandInvocation(code: string) {
  return "EXECUTE CÓDIGO " + code + " DO NÚCLEO COMANDOS";
}

// Catalog visibility does not grant operational authority.
export function isOperationalCommandAvailable(entry: OperationalCommand) {
  return entry.catalogState === 'active' && entry.authority !== 'pending' && entry.body !== null;
}
