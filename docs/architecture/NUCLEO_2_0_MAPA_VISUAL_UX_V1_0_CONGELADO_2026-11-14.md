# MAPA VISUAL UX — NÚCLEO 2.0 V1.0
**Projeto:** Painel Central — Amor de Família  
**Escopo:** Entrega A+ do Núcleo existente, UX, navegação, arquitetura de informação e experiência visual  
**Estado:** CONGELADO COMO REFERÊNCIA DE EXECUÇÃO DA FRENTE UX, por determinação expressa do proprietário em 14/11/2026.  
**Autoridade superior:** Camada Mestre e MAPA_MESTRE_NUCLEO_2_0_V1_3_AC01_CONHECIMENTO_ESPECIALISTAS_CONGELADO_2026-11-14.  
**Natureza:** mapa de EXPERIÊNCIA (como apresentar e navegar), subordinado ao mapa soberano (o que e sob qual autoridade). Não modifica CA-01–CA-29, M0–M5, schema, governança ou aceites.

## 1. Missão e desenho congelado
Construir UM Núcleo visual compreensível para o gestor: ver o todo, selecionar um módulo, compreender seu especialista e suas frentes, localizar conhecimento, comparar versões e acompanhar decisões com evidência honesta. Não aumentar telas por padrão, não replicar Biblioteca, não iniciar Entrega B ou M6. A operação GitHub/Supabase e demais especialistas não depende de o Núcleo estar disponível.

**Estrutura de três níveis, em uma experiência integrada:**
1. **VISÃO GERAL — decidir onde olhar:** módulos reais e cobertura, prioridades e bloqueios demonstrados, ações pendentes, dados e data de conferência. A governança NUC é distinta dos módulos operacionais.
2. **MÓDULO — compreender:** objetivo, telas/funções, especialista/competência, desenvolvimento e conhecimento. Um módulo selecionado mantém identidade e orientação visíveis.
3. **DETALHE/PROVA — agir com contexto:** frente/checkpoint/evidências, especialista/mandatos, documento/versão/diferenças, refinamento/solicitação/ato/publicação/histórico. A profundidade é contextual, não outra base ou uma sequência obrigatória de páginas.

A rota atual /nucleo permanece; as oito áreas legadas e os dados originais são preservados. O Núcleo usa vistas complementares sobre as MESMAS fontes e IDs, não duplicação de registros.

## 2. Arquitetura de informação por contexto
### 2.1 Visão Geral
- Cabeçalho com título, função, recorte e última leitura quando comprovada.
- Área de atenção: pendências e bloqueios com motivo e origem; sem inventar percentual, previsão ou progresso.
- Catálogo de módulos com busca, indicação de cobertura (cadastrado, parcial, não verificado) e entrada para a ficha.
- Consulta das frentes e supervisão em contexto distinto, acessível por navegação curta; evitar renderizar simultaneamente todas as seções longas.
- Contagens indicam o universo real consultado, distinguindo NUC/governança de módulos externos e limite de paginação.

### 2.2 Ficha do módulo — quatro áreas estáveis
1. **Operação:** o que é/faz, rotas, telas, controles, tarefas guiadas e fonte de verificação.
2. **Desenvolvimento:** frentes e subfrentes, prioridade, bloqueio, próxima ação, critérios, estado, lista/árvore/Kanban, histórico e evidência.
3. **Especialistas:** papel funcional, responsabilidade declarada, método/ecossistema, mandato/certificação, limites e vínculos documentais.
4. **Conhecimento e Evolução:** Ficha Viva FM-01–FM-10, fontes, propostas, versões, revisões, comparações, solicitações, decisões, publicação e histórico.

Selecionar módulo e mudar área não deve reinventar a identidade, os títulos nem os filtros necessários. A ficha pode conter dados parciais claramente qualificados; ausência de cadastro no Core não equivale à ausência do módulo na organização.

### 2.3 Especialista e documentação
- Identidade do especialista é um PAPEL FUNCIONAL persistente, não o nome do chat nem um mandato presumido.
- O especialista mostra: responsabilidade, escopo, método e versão, fontes, histórico de continuidade, conhecimento produzido, pendências e prova de competência quando existente.
- Ingresso na jornada documental: **Módulo → Especialista → Conhecimento/Evolução → Documento/Versão → Comparar → Refinar → Solicitar decisão → Ato competente → Publicação comprovada → Histórico**.
- Essa é uma trilha de CONSULTA e preparação; um passo sem contrato de escrita liberado deve aparecer como indisponível/bloqueado, nunca como concluído.

## 3. Contrato visual documental AC-01
Uma experiência documental coerente reaproveita NucleoSpecialistContributions, NucleoContributionDesk, NucleoAC01DocumentGovernance, NucleoModuleKnowledge, NucleoAC01ReviewTrail e NucleoAC01DecisionIntake/Status. Unificar a apresentação e o contexto, SEM fundir tabelas, eventos ou autoridades.

**Eixos independentes a exibir:**
- **Estado do documento:** recebido, proposta, em análise/evolução, aguardando decisão, vigente declarado, histórico/supersedido, divergente/bloqueado, conforme fonte e taxonomia efetiva.
- **Autoridade:** fonte declarada, competência certificada, decisão efetiva, referência canônica vigente externamente comprovada ou NÃO COMPROVADA. Ter acesso técnico nucleo_manage não cria mandato substantivo.
- **Execução:** contribuição registrada, revisão/solicitação persistida, ato decisório, publicação INTERNA AC-01, atualização canônica de Ficha Viva/Drive/GitHub comprovada. São eventos diferentes.
- **Prova:** quem propôs, revisou, solicitou, decidiu e executou; data, fonte, ID, versão, histórico. Não inventar autor nem atribuir decisão à IA.

**Regra crítica:** a aba/etiqueta "Vigente" jamais pode apresentar publicação interna AC-01 como se fosse vigência canônica externa. Estados de leitura incompleta, zero ocorrências e falta de direito de acesso devem ser distintos. Delegação, revogação, decisão, publicação e CAS permanecem SEM botões executores enquanto respectivos portões INSERT/RPC estiverem fechados.

## 4. Comparação e refinamento
- Escolher explicitamente versão A e versão B, exibindo título, origem, estado, data e versão de cada uma.
- Resumo da comparação + inclusão/remoção por linhas, marcação textual além de cor e contexto antes/depois; não atribuir equivalência semântica ou conflito de autoridade a um diff textual.
- O comparador atual de FM é determinístico, local e limitado a 12.000 caracteres e 180 linhas por lado; acima disso, mostrar "comparação integral indisponível" e link/referência à fonte, NUNCA diff parcial como integral.
- Refinar prepara nova revisão/rascunho, preserva original e história; não equivale a homologação.
- Rascunho não salvo deve permanecer protegido ao navegar/trocar visão, com confirmação quando houver risco de descarte.
- Minutas consultivas, pedidos, atos de decisão e publicação devem ter rótulos e efeitos diferentes.

## 5. Padrão de interface e acessibilidade
- Reaproveitar componentes UI, tipografia, ícones, tokens de cor e layout responsivo do Painel Central. Não impor redesign visual global sem necessidade.
- Cabeçalhos curtos, títulos familiares, blocos escaneáveis e detalhes progressivos, sem exigir leitura de documentos extensos na primeira dobra.
- Em cada nível: "Onde estou?", "O que é?", "Qual o estado e a prova?", "O que posso fazer agora?". Caminho de volta sem perder seleção e rascunho.
- Busca e filtros dentro do recorte efetivo, com rótulos, total/limite, vazio orientador e erro sem falso sucesso.
- Não usar somente cor para comunicar estado; indicar texto e significados de bloqueio. Mostrar data da consulta e proveniência quando relevante.
- Teclado: foco visível, controles semânticos, ordem de Tab coerente, Escape/cancelamento quando cabível e alvos de toque confortáveis.
- Testar por código e preview compatível: desktop ≥1366, intermediário ~1024, tablet ~768 e mobile ~390/320 px. Meta de contraste WCAG 2.2 AA; aceites visuais e testes humanos integrais ADIADOS pelo proprietário.
- Evitar rolagem longa como único modo de navegação. Preferir entradas de escopo e transição contextual, preservando seleção e estado.

## 6. Frentes de execução congeladas
| Ordem | Frente | Mudança autorizada de UX | Critério de aceite técnico proporcional |
|---|---|---|---|
| UX-A1 | Entrada progressiva da Central | Separar apresentação geral de acompanhamento detalhado; manter links para fichas e conteúdo sem perder estados | Visão Geral padrão; acesso às frentes em um controle; nenhum writer/contrato alterado; build/CI |
| UX-A2 | Contexto e navegação de módulo | Melhorar hierarquia de navegação das quatro áreas, resumo, retorno e preservação de seleção | Alternância clara, acesso às mesmas funcionalidades/rotas, nenhuma fonte duplicada |
| UX-A3 | Especialista e AC-01 unificados visualmente | Consolidar navegação da fila e contexto do documento sem alterar schema/autoridade | Estados, origem, solicitações, histórico e competências encontráveis; atos não executáveis |
| UX-A4 | Comparador legível e contextual | Melhorar organização da versão A/B e apresentação determinística com limites preservados | Sem diferenças inventadas, sem truncar silenciosamente, acessibilidade |
| UX-A5 | Estados e responsividade | Refinar vazios, falhas, foco, densidade, mobile, acessibilidade | Cobertura estática/automatizada apropriada; UAT real pendente |
| UX-A6 | Consolidação de evidências | Conferir critérios CA impactados e documentação de alteração mínima | Resultado técnico ≠ homologação humana; referencia o mapa existente |

A execução é por **microfrente no GitHub**: branch pequena → alteração mínima → testes/build/CI quando disponíveis → PR → conferência → merge conforme governança. Evitar alterar simultaneamente os arquivos da frente Núcleo técnica; conflitos de backend, RLS e autoridade pertencem ao Especialista Núcleo/Camada Mestre.

## 7. Critérios de aceite de experiência
1. Gestor encontra módulo real e próximo trabalho sem ler logs/chats longos.
2. Do módulo, acessa diretamente Operação, Desenvolvimento, Especialista e Conhecimento, sem sair do Núcleo nem perder contexto.
3. Frentes selecionadas mantêm ID, status, histórico, fontes e ação comprováveis, com lista/árvore/quadro sobre o mesmo registro.
4. Documento selecionado identifica versão e origem; proposta não se torna vigente por ser mais recente.
5. A comparação mostra diferenças textuais reais ou limitação explícita.
6. O gestor distingue proposição, revisão, pedido, ato, publicação AC-01 interna e alteração canônica.
7. A fila de pendências e a trilha de continuidade indicam autoria, data, limites e fonte quando há prova.
8. A experiência informa inacessibilidade e dados incompletos sem apresentar zero como ausência global.
9. Layouts e controles passam por testes técnicos compatíveis sem regredir UX/CRM ou segurança.
10. **Aceite humano completo da Entrega A+ permanece PENDENTE**, ainda que microfrentes de código sejam aprovadas.

## 8. Congelamento, manutenção e prova
- Este documento fixa a **arquitetura de experiência da frente UX V1.0**, não concede vigência a documentos de especialistas nem altera o mapa soberano V1.3.
- Mudança de rótulo, ordem ou agrupamento dentro das quatro áreas é permitida se preservar contrato e evidência; revisão estrutural do mapa exige novo aceite da Camada Mestre/proprietário.
- Registrar mudanças materiais por delta e PR nesta mesma referência ou na auditoria canônica quando pertinente, sem criar plano duplicado por etapa.
- Origem do diagnóstico: código da main inspecionado em 14/11/2026 (Nucleo.tsx, NucleoDevelopmentCenter.tsx, NucleoOperationalAtlas.tsx, Ficha Viva e AC-01), auditoria canônica de 12–14/11 e PRs #793, #797, #798, #799, #800 e #801. A inspeção de código NÃO é homologação visual autenticada.
- **Próxima ação executiva:** UX-A1, isolando a Visão Geral do detalhamento de frentes na Central atual, sem perda de edição, seleção, acesso ou história.

## 9. Registro de execução e reconciliação UX-A6 — 14/11/2026

**Natureza:** adendo de EVIDÊNCIAS ao mapa UX V1.0 já congelado; não altera os níveis, áreas, critérios, ordem das microfrentes ou autoridade do Mapa Mestre Núcleo V1.3. Fontes: PRs GitHub e workflows do repositório oficial, código de `main`, auditoria canônica em `docs/architecture/NUCLEO_2_0_AUDITORIA_FINAL_PENDENCIAS_PRIORIZADAS_2026-11-12.md`. Evidência de CI **não** é homologação de jornada humana nem prova autônoma de deployment.

### 9.1 Matriz de entrega — evidência, estado e limitação

| Frente | Evidência GitHub / CI no head da PR | Situação de integração | Limite que permanece |
|---|---|---|---|
| Mapa UX V1.0 | PR [#803](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/803), merge `559a48d8e9d030dcbcab46cf3f32f6e1e8248df1` | **CONGELADO na main** | Não substitui Mapa Mestre V1.3; nenhum aceite humano concedido |
| UX-A1 — navegação progressiva da Central | PR [#802](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/802), head `c776a221b31ae57258cfc83bfafae2beff5d6ece`; M3 desenvolvimento, M3 no-op/layout e M4 evidências **SUCCESS**; M5 supervisão **FAILURE** (run `43621830123`) | **PENDENTE; não integrada** | [Issue #804](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/issues/804) aberta, asserção estática M5 divergente da condição de revisão AC-01 já vigente; ajuste pertence ao Especialista Núcleo |
| UX-A2 — ficha e navegação dos módulos | PR [#805](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/805), merge `ef7467fff37d1cfb7e6ad74a162ed35a8e4ba1a8`; M3 desenvolvimento **SUCCESS** (run `43622931494`) | **Integrada na main / tecnicamente validada** | Preserva contexto de seleção, não garante rascunhos entre módulos/reloads |
| UX-A3A — contribuições, fila e ciclo AC-01 | PR [#808](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/808), merge `a0b4de4c36d7cd79b832d3bf09312df6216e9e67`; AC-01 **SUCCESS** (run `43624056203`) | **Integrada na main / tecnicamente validada** | Estados de consulta não autorizam atos, aprovações ou publicação |
| UX-A3B — Ficha Viva ↔ especialista | PR [#809](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/809), merge `5118e8bcf8590969d9cdc78bc00e4b3312578db9`; M3 desenvolvimento **SUCCESS** (run `43624367162`) | **Integrada na main / tecnicamente validada** | Mantém painéis montados após visita no mesmo módulo; não prova preservação universal de minutas |
| UX-A4 — comparador de versões FM | PR [#810](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/810), merge `0c3721a7382f7d4616bab912666a195d8f5e1a9d`; M3 desenvolvimento **SUCCESS** no head corrigido (run `43625806198`) | **Integrada na main / tecnicamente validada** | Diff somente textual, até 12.000 caracteres e 180 linhas por versão; não identifica conflito de autoridade |
| UX-A5 — responsividade, acessibilidade e estados | PR [#811](https://github.com/amordefamiliadocesfinos-lab/central-mind-tree-7bcb6d3e/pull/811), merge `98391d7dbd3fcf54da7c475fddf1db0b6414ffa2`; M3 **SUCCESS** (run `43627221451`) e AC-01 **SUCCESS** (run `43627221376`) | **Integrada na main / tecnicamente validada** | Evidência de CSS, markup e testes estáticos/CI, sem comprovação de WCAG AA ou dispositivos autenticados |
| UX-A6 — reconciliação de evidências | Este adendo **após revisão e merge de sua PR específica** | **Documental**, sem mudança operacional | Não homologa automaticamente CA-01–CA-29, módulos ou Entrega A+ |

**Ponto de corte verificado para esta reconciliação:** `main=98391d7dbd3fcf54da7c475fddf1db0b6414ffa2`; projeto Lovable oficial em `ready`, `latest_commit_sha` igual ao SHA da `main` no momento da consulta. Essa igualdade evidencia sincronização do repositório para a versão observada; **não demonstra** publicação integral de site, atualização canônica externa, disponibilidade de funções Cloud, autorização de operadores ou aceite humano.

### 9.2 Critérios UX do próprio mapa, sem extrapolar os CA soberanos

| Critério do item 7 | Prova atual | Avaliação responsável |
|---|---|---|
| UX 1 — encontrar módulo e próximo trabalho | Catálogo/Atlas existentes, UX-A2 e UX-A5; UX-A1 ainda não integrada | **Parcial**: falta entrada progressiva A1 + uso real |
| UX 2 — quatro áreas do módulo | PR #805, testes de navegação; ligação contextual PR #809 | **Técnico atendido**; usabilidade humana pendente |
| UX 3 — ID, status, evidências e visões das frentes | Estruturas M3/M4 reaproveitadas, sem alteração na fonte | **Preservado no código**; não homologado em uso real |
| UX 4 — versão, fonte e autoridade declaradas | PR #810 e rótulos AC-01; sem promoção automática | **Técnico atendido**; validação de fontes reais pendente |
| UX 5 — diferença textual ou limite expresso | Comparador determinístico original + PR #810, teste de limites | **Técnico atendido**; comparação autenticada humana pendente |
| UX 6 — distinguir proposta, ato, publicação interna/canônica | PR #808 e #809, blocos de advertência e portões fechados | **Técnico parcial**; nenhuma decisão/publicação habilitada ou homologada |
| UX 7 — origem, autoria, continuidade e pendências | Campos, fichas M3, AC-01 e consultas por fontes existentes | **Parcial**: conferir completude e interpretação humana dos recortes |
| UX 8 — falta de acesso ≠ ausência global | PR #811, casos de leitura indisponível/sem registro e erro | **Técnico atendido** nos componentes alterados, não comprova cobertura total |
| UX 9 — regressões e acesso coerente | CI proporcional M3 e AC-01 bem-sucedida para A2–A5; A1 M5 falhou | **Parcial**, pendência A1 e teste visual/acessibilidade aprofundado |
| UX 10 — aceite humano completo | Expressamente adiado pelo proprietário | **PENDENTE**, não homologado |

A revisão acima **não altera nem aprova os critérios CA-01–CA-29**. As cautelas de competência, decisão, revogação, publicação interna e canônica tratadas em CA-23–CA-29/AC-01 continuam sob o Mapa Mestre V1.3 e Especialista Núcleo. As decisões e provas desse núcleo técnico não devem ser reclassificadas como homologação UX. Sem nova RLS, migration, delegação, credencial, gravação ou concessão.

### 9.3 Pendências reais e ordem de tratamento

1. **P1 — Concluir UX-A1 sem contornar M5:** responsável pelo teste/contrato é o Especialista Núcleo; reconciliar issue #804, preservar readback e negativos AC-01; executar CI afetada após ajuste, revisar branch da PR #802 frente à `main` atual (rebase/merge caso necessário), e integrar somente com verificações compatíveis aprovadas. UX acompanha impacto visual, sem assumir autoridade técnica.
2. **P2 — Homologação visual/autenticada ADIADA:** quando o proprietário retomar, observar desktop ≥1366px, 1024px, tablet 768px, mobile 390 e 320px; ordem do teclado, foco, rolagem horizontal, alvos de toque, rótulos e contraste; fluxo Visão Geral → Módulo → Especialista → FM → Comparar → Histórico; estados sem acesso, vazios, dados parciais, sem sinal, falha e retorno. Verificar preservação de minuta em transição e risco de descarte; não afirmar conformidade WCAG 2.2 AA sem medições apropriadas.
3. **P3 — Limites de rascunho e foco:** alternância entre áreas no mesmo módulo retém partes montadas; mudar módulo, recarregar e outras navegações ainda não estão protegidos universalmente. Investigar no uso real ou em microfrente futura autorizada; não interpretar a preservação parcial como garantia de não perda.
4. **P4 — Contrato AC-02 recente:** a auditoria canônica, itens 57 e 58, registra fonte global AC-02 e projeção autenticada `include_ac02` pela Edge Function existente. É uma **dependência visual adicional**: Especialista UX deverá consumir projeção autorizada e diferenciar diretriz/fonte observada/desatualização/conflito/acesso não verificado, com proveniência, sem duplicar configuração. A inclusão como microfrente no mapa **não é automática**: coordenar com Camada Mestre/Especialista Núcleo antes de qualquer mudança visual, preservando o escopo congelado.
5. **P5 — Atualização canônica e publicação:** os portões decisórios/publicação AC-01 permanecem fechados; ensaios positivos em PostgreSQL descartável não autorizam execução em ambiente real. Uma publicação interna não comprova atualização da Ficha Viva/Drive/GitHub.

### 9.4 Encerramento da fase documental

- **UX-A6:** reconciliação documental executada neste mesmo mapa, sem segundo mapa ou base paralela, sem código funcional.
- **UX A2–A5:** integradas e cobertas por CI declarada acima; **UX-A1** segue pendente; **UX A+ integral** e critérios CA não homologados.
- **Próxima ação:** tratar P1 pela frente Núcleo técnica; após seu aceite e nova CI, revisar a UX-A1 e consolidar as evidências finais; manter UAT humano adiado até decisão expressa.
